import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { CriteriaProfile, Tender } from '@prisma/client';
import { GroupWithTiers } from './criteria-scoring.util';

type ScoringProfile = Pick<
  CriteriaProfile,
  | 'name'
  | 'industries'
  | 'technologies'
  | 'products'
  | 'keywords'
  | 'positioning'
  | 'services'
  | 'productsAndSolutions'
  | 'industriesExperience'
  | 'certifications'
  | 'marketsAndLanguages'
  | 'deliveryModel'
>;

export type Verdict = 'GO' | 'CONSIDER' | 'NO_GO';

export type DomainBucket =
  | 'admin_hr_realestate_manufacturing_service_tourism'
  | 'transport_construction_health'
  | 'security_defense'
  | 'other';

export interface AiScoringResult {
  score: number; // 0-100
  verdict: Verdict;
  reasoning: string;
  matchedCriteria: string[];
  gaps: string[];
  riskFlags: string[];
  recommendedFocus: string[];
  // Classification flags feeding the deterministic client rubric score
  // (see rubric-score.util.ts) — kept separate from the judged `score` above.
  isDxProject: boolean;
  domainBucket: DomainBucket;
  bidGuaranteeMentioned: boolean;
  bidGuaranteeUnder100tr: boolean;
}

const RESPONSE_SCHEMA = {
  name: 'tender_scoring_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      score: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Điểm phù hợp tổng thể 0-100',
      },
      verdict: {
        type: 'string',
        enum: ['GO', 'CONSIDER', 'NO_GO'],
      },
      reasoning: {
        type: 'string',
        description: 'Lý do ngắn gọn cho điểm và verdict',
      },
      matchedCriteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'Các tiêu chí gói thầu khớp với năng lực công ty',
      },
      gaps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Khoảng trống năng lực so với yêu cầu gói thầu',
      },
      riskFlags: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Cờ rủi ro, ví dụ yêu cầu vượt khả năng, chứng chỉ còn thiếu, thời gian gấp...',
      },
      recommendedFocus: {
        type: 'array',
        items: { type: 'string' },
        description: 'Góc độ nên nhấn mạnh trong hồ sơ dự thầu nếu quyết định tham gia',
      },
      isDxProject: {
        type: 'boolean',
        description:
          'true nếu gói thầu là dự án chuyển đổi số, tích hợp hệ thống, phát triển web/app, ' +
          'hoặc tư vấn chuyển đổi số/AI — dựa trên nội dung thực tế, không chỉ khớp từ khoá.',
      },
      domainBucket: {
        type: 'string',
        enum: [
          'admin_hr_realestate_manufacturing_service_tourism',
          'transport_construction_health',
          'security_defense',
          'other',
        ],
        description:
          'Nhóm nghiệp vụ của gói thầu: admin_hr_realestate_manufacturing_service_tourism ' +
          '(hành chính công/nhân sự/bất động sản/sản xuất/dịch vụ/du lịch), ' +
          'transport_construction_health (giao thông/xây dựng/y tế), ' +
          'security_defense (an ninh trật tự/quốc phòng), hoặc other nếu không thuộc nhóm nào ở trên.',
      },
      bidGuaranteeMentioned: {
        type: 'boolean',
        description: 'true nếu nội dung gói thầu có nêu rõ mức bảo lãnh dự thầu (số tiền cụ thể).',
      },
      bidGuaranteeUnder100tr: {
        type: 'boolean',
        description:
          'Chỉ có ý nghĩa khi bidGuaranteeMentioned=true: true nếu mức bảo lãnh dự thầu nêu rõ dưới 100 triệu VND, false nếu từ 100 triệu trở lên hoặc không chắc chắn.',
      },
    },
    required: [
      'score',
      'verdict',
      'reasoning',
      'matchedCriteria',
      'gaps',
      'riskFlags',
      'recommendedFocus',
      'isDxProject',
      'domainBucket',
      'bidGuaranteeMentioned',
      'bidGuaranteeUnder100tr',
    ],
  },
} as const;

const NOT_PROVIDED = 'Chưa cập nhật';

function joinOrDefault(values: string[] | null | undefined): string {
  return values && values.length > 0 ? values.join(', ') : NOT_PROVIDED;
}

const DEFAULT_PROJECT_TYPE_DESC =
  'gói thầu có đúng là dự án chuyển đổi số / tích hợp hệ thống / phát triển web,app / ' +
  'tư vấn chuyển đổi số,AI hay không — xét theo bản chất công việc, kể cả khi mô tả không dùng đúng các từ này.';
const DEFAULT_BONUS_DESC =
  'nội dung có nêu rõ số tiền bảo lãnh dự thầu không, và nếu có thì có dưới 100 triệu VND không. ' +
  'Nếu không thấy đề cập, để bidGuaranteeMentioned=false.';

function findGroupByAiQuestionKey(groups: GroupWithTiers[], key: string): GroupWithTiers | undefined {
  return groups.find((g) => g.tiers.some((t) => t.aiQuestionKey === key));
}

/**
 * The AI classification *questions* (project_type / domain_bucket /
 * bid_guarantee_under_100tr) are fixed in code — only the point values and
 * this descriptive framing text are admin-editable (via the Cấu hình chấm
 * điểm settings, see scoring-criteria module). Falls back to defaults when
 * no settings groups are supplied (e.g. not yet configured).
 */
function buildClassificationInstructions(groups: GroupWithTiers[] | undefined): string {
  const projectTypeGroup = groups && findGroupByAiQuestionKey(groups, 'project_type');
  const domainGroup = groups && findGroupByAiQuestionKey(groups, 'domain_bucket');
  const bonusGroup = groups && findGroupByAiQuestionKey(groups, 'bid_guarantee_under_100tr');

  const domainTierLines = domainGroup
    ? domainGroup.tiers
      .filter((t) => t.aiQuestionKey === 'domain_bucket')
      .map((t) => `  ${(t.config as any)?.aiValue}: ${t.label}`)
      .join('\n')
    : [
      '  admin_hr_realestate_manufacturing_service_tourism: hành chính công/nhân sự/bất động sản/sản xuất/dịch vụ/du lịch',
      '  transport_construction_health: giao thông/xây dựng/y tế',
      '  security_defense: an ninh trật tự/quốc phòng',
      '  other: không thuộc nhóm nào ở trên',
    ].join('\n');

  return [
    'NGOÀI RA, phân loại thêm (dùng cho một thang điểm rule-based riêng, độc lập với điểm phù hợp ở trên):',
    `- isDxProject: ${projectTypeGroup?.description ?? DEFAULT_PROJECT_TYPE_DESC}`,
    '- domainBucket: gói thầu thuộc nhóm nghiệp vụ nào (chọn đúng 1 trong các giá trị):',
    domainTierLines,
    `- bidGuaranteeMentioned / bidGuaranteeUnder100tr: ${bonusGroup?.description ?? DEFAULT_BONUS_DESC}`,
  ].join('\n');
}

function buildSystemPrompt(profile: ScoringProfile, groups: GroupWithTiers[] | undefined): string {
  return [
    `Bạn là chuyên gia phân tích bid/no-bid cho ${profile.name}.`,
    '',
    'HỒ SƠ NĂNG LỰC CÔNG TY (căn cứ đối chiếu):',
    `- Vị thế: ${profile.positioning ?? NOT_PROVIDED}`,
    `- Dịch vụ chính: ${joinOrDefault(profile.services)}`,
    `- Sản phẩm/giải pháp: ${joinOrDefault(profile.productsAndSolutions)}`,
    `- Ngành đã triển khai: ${joinOrDefault(profile.industriesExperience)}`,
    `- Chứng nhận/giải thưởng: ${joinOrDefault(profile.certifications)}`,
    `- Thị trường/ngôn ngữ: ${joinOrDefault(profile.marketsAndLanguages)}`,
    `- Mô hình triển khai: ${profile.deliveryModel ?? NOT_PROVIDED}`,
    '',
    'NHIỆM VỤ: Chấm điểm mức độ phù hợp (0-100) của gói thầu với hồ sơ năng lực trên, theo 7 tiêu chí:',
    '1. Phạm vi công việc (scope) có khớp dịch vụ/giải pháp công ty đang cung cấp không.',
    '2. Ngành/lĩnh vực của chủ đầu tư có nằm trong các ngành công ty đã có kinh nghiệm không.',
    '3. Yêu cầu công nghệ/kỹ thuật có trùng khớp năng lực không.',
    '4. Yêu cầu pháp lý/chứng chỉ (ISO, ISMS, năng lực tài chính, số năm kinh nghiệm, nhân sự...) công ty có đáp ứng không, thiếu gì.',
    '5. Yêu cầu về ngôn ngữ/thị trường có phù hợp thế mạnh không.',
    '6. Quy mô, ngân sách, thời gian thực hiện có nằm trong khả năng đáp ứng không.',
    '7. Mức độ cạnh tranh dự kiến (nếu có thông tin đối thủ trong mô tả gói thầu).',
    '',
    'Ngoài điểm số và verdict (GO/CONSIDER/NO_GO), luôn giải thích lý do ngắn gọn (reasoning), liệt kê: tiêu chí khớp (matchedCriteria), ' +
    'khoảng trống/rủi ro (gaps, riskFlags), và gợi ý nhấn mạnh trong hồ sơ dự thầu (recommendedFocus). ' +
    'Luôn trả lời bằng tiếng Việt, súc tích, dựa trên bằng chứng trong nội dung gói thầu, không suy diễn.',
    '',
    buildClassificationInstructions(groups),
  ].join('\n');
}

export const DEFAULT_GEMINI_MAIN_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_GEMINI_BACKUP_MODEL = 'gemini-3.1-flash-lite';

const DEPRECATED_GEMINI_MODELS: Record<string, string> = {
  'gemini-3.6-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.0-flash': 'gemini-3.5-flash-lite',
  'gemini-1.5-flash': 'gemini-3.5-flash-lite',
  'gemini-2.5-pro': 'gemini-3.1-pro-preview',
  'gemini-1.5-pro': 'gemini-3.1-pro-preview',
};

export function sanitizeGeminiModel(model?: string, defaultModel = DEFAULT_GEMINI_MAIN_MODEL): string {
  const trimmed = model?.trim();
  if (!trimmed) {
    return defaultModel;
  }
  return DEPRECATED_GEMINI_MODELS[trimmed] ?? trimmed;
}

@Injectable()
export class OpenAiScoringService {
  private readonly logger = new Logger(OpenAiScoringService.name);
  private readonly openAiClient: OpenAI | null = null;
  private readonly geminiClient: GoogleGenAI | null = null;
  private readonly model: string;
  private readonly backupModel: string | null = null;
  private activeModel: string;
  private readonly provider: string;
  private readonly configured: boolean;
  private readonly isGemini: boolean;
  private readonly maxRetries: number = 2;

  constructor(private configService: ConfigService) {
    const geminiApiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    const openAiApiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    const openRouterApiKey = this.configService.get<string>('OPENROUTER_API_KEY')?.trim();

    if (geminiApiKey) {
      const model = sanitizeGeminiModel(this.configService.get<string>('GEMINI_MODEL'), DEFAULT_GEMINI_MAIN_MODEL);
      const backupModel = sanitizeGeminiModel(
        this.configService.get<string>('GEMINI_BACKUP_MODEL'),
        DEFAULT_GEMINI_BACKUP_MODEL,
      );
      this.geminiClient = new GoogleGenAI({ apiKey: geminiApiKey });
      this.openAiClient = null;
      this.model = model;
      this.backupModel = backupModel !== model ? backupModel : DEFAULT_GEMINI_BACKUP_MODEL;
      this.activeModel = model;
      this.provider = 'Gemini';
      this.isGemini = true;
      this.configured = true;
      this.logger.log(
        `Initialized Gemini client with main model: ${this.model}, backup model: ${this.backupModel}`,
      );
    } else if (openAiApiKey) {
      const openAiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL')?.trim();
      const model = this.configService.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
      this.openAiClient = new OpenAI({
        apiKey: openAiApiKey,
        ...(openAiBaseUrl ? { baseURL: openAiBaseUrl } : {}),
      });
      this.geminiClient = null;
      this.model = model;
      this.activeModel = model;
      this.provider = 'OpenAI';
      this.isGemini = false;
      this.configured = true;
      this.logger.log(`Initialized OpenAI client with model: ${this.model}`);
    } else if (openRouterApiKey) {
      const openRouterBaseUrl =
        this.configService.get<string>('OPENROUTER_BASE_URL')?.trim() || 'https://openrouter.ai/api/v1';
      const model = this.configService.get<string>('OPENROUTER_MODEL')?.trim() || 'openrouter/auto';
      this.openAiClient = new OpenAI({
        apiKey: openRouterApiKey,
        baseURL: openRouterBaseUrl,
      });
      this.geminiClient = null;
      this.model = model;
      this.activeModel = model;
      this.provider = 'OpenRouter';
      this.isGemini = false;
      this.configured = true;
      this.logger.log(`Initialized OpenRouter client with model: ${this.model}`);
    } else {
      this.geminiClient = null;
      this.openAiClient = null;
      this.model = 'gpt-4o-mini';
      this.activeModel = 'gpt-4o-mini';
      this.provider = 'None';
      this.isGemini = false;
      this.configured = false;
      this.logger.warn(
        'AI scoring is disabled: No API key configured (GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY are all empty)',
      );
    }
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  get providerName(): string {
    return this.provider;
  }

  get modelName(): string {
    return this.activeModel;
  }

  get backupModelName(): string | null {
    return this.backupModel;
  }

  async scoreTender(
    tender: Pick<Tender, 'title' | 'sector' | 'description' | 'requirementsText'>,
    profile: ScoringProfile,
    groups?: GroupWithTiers[],
  ): Promise<AiScoringResult> {
    if (!this.configured || (!this.geminiClient && !this.openAiClient)) {
      throw new Error(
        'Không thể chấm điểm AI: Chưa cấu hình API key (GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY đều trống).',
      );
    }

    const systemPrompt = buildSystemPrompt(profile, groups);
    const userPayload = JSON.stringify({
      tender: {
        title: tender.title,
        sector: tender.sector,
        description: tender.description,
        requirements: tender.requirementsText,
      },
      criteria_profile: {
        industries: profile.industries,
        technologies: profile.technologies,
        products: profile.products,
        keywords: profile.keywords,
      },
    });

    let lastError: unknown;
    const modelsToTry =
      this.isGemini && this.backupModel
        ? (this.activeModel === this.backupModel ? [this.backupModel] : [this.model, this.backupModel])
        : [this.activeModel];

    for (const currentModel of modelsToTry) {
      const isBackup = currentModel === this.backupModel;
      if (isBackup && this.activeModel !== this.backupModel) {
        this.logger.warn(
          `Primary Gemini model (${this.model}) failed, falling back to backup model: ${this.backupModel}`,
        );
      }

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          let raw = '';

          if (this.isGemini && this.geminiClient) {
            const response = await this.geminiClient.models.generateContent({
              model: currentModel,
              contents: [
                { role: 'user', parts: [{ text: userPayload }] }
              ],
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: RESPONSE_SCHEMA.schema,
                temperature: 0,
              }
            });

            raw = response.text ?? '';
            if (!raw) {
              throw new Error(`AI response rỗng (Gemini - ${currentModel}).`);
            }
          } else if (this.openAiClient) {
          const completion = await this.openAiClient.chat.completions.create({
            model: this.model,
            temperature: 0,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPayload },
            ],
            response_format: { type: 'json_schema', json_schema: RESPONSE_SCHEMA },
          });

          raw = completion.choices[0]?.message?.content ?? '';
          if (!raw) {
            throw new Error('AI response rỗng (OpenAI).');
          }
        } else {
          throw new Error('Không có AI client nào được cấu hình.');
        }

        // Clean markdown backticks if any
        raw = raw.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '').trim();
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          raw = jsonMatch[0];
        }

        const parsed = JSON.parse(raw) as AiScoringResult;

        if (this.isGemini && !parsed.reasoning) {
          parsed.reasoning =
            (parsed as any).rationale ||
            (parsed as any).aiRationale ||
            (parsed as any).explanation ||
            (Array.isArray(parsed.gaps) && parsed.gaps.length > 0
              ? parsed.gaps.join('; ')
              : `Đánh giá ${parsed.verdict}: ${parsed.score} điểm.`);
        }

        this.validateResult(parsed);

        if (this.isGemini && currentModel === this.backupModel && this.activeModel !== this.backupModel) {
          this.activeModel = this.backupModel;
          this.logger.warn(
            `[OpenAiScoringService] Primary Gemini model (${this.model}) failed and backup succeeded. Permanently switched active model to ${this.backupModel} for subsequent requests.`,
          );
        }

        return parsed;
      } catch (err) {
        lastError = err;
        // Retry cho cả lỗi gọi API lẫn lỗi parse/validate JSON, tối đa maxRetries lần.
        if (attempt === this.maxRetries) {
          break;
        }
        this.logger.warn(
          `Chấm điểm "${tender.title}" qua ${this.provider} (${currentModel}) thất bại (lần ${attempt + 1}/${this.maxRetries + 1}): ${err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    }

    throw new Error(
      `Không thể chấm điểm gói thầu "${tender.title}" sau ${this.maxRetries + 1} lần thử: ${lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  private validateResult(result: AiScoringResult): void {
    const validDomainBuckets: DomainBucket[] = [
      'admin_hr_realestate_manufacturing_service_tourism',
      'transport_construction_health',
      'security_defense',
      'other',
    ];
    if (
      typeof result.score !== 'number' ||
      result.score < 0 ||
      result.score > 100 ||
      !['GO', 'CONSIDER', 'NO_GO'].includes(result.verdict) ||
      typeof result.reasoning !== 'string' ||
      !result.reasoning.trim() ||
      !Array.isArray(result.matchedCriteria) ||
      !Array.isArray(result.gaps) ||
      !Array.isArray(result.riskFlags) ||
      !Array.isArray(result.recommendedFocus) ||
      typeof result.isDxProject !== 'boolean' ||
      !validDomainBuckets.includes(result.domainBucket) ||
      typeof result.bidGuaranteeMentioned !== 'boolean' ||
      typeof result.bidGuaranteeUnder100tr !== 'boolean'
    ) {
      throw new Error('Kết quả AI trả về không đúng schema mong đợi.');
    }
  }
}

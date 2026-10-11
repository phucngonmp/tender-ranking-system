import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CriteriaProfile } from '@prisma/client';
import { sanitizeGeminiModel, DEFAULT_GEMINI_MAIN_MODEL, DEFAULT_GEMINI_BACKUP_MODEL } from '../scoring/openai-scoring.service';

type ScoringProfile = Pick<
  CriteriaProfile,
  | 'name'
  | 'positioning'
  | 'services'
  | 'productsAndSolutions'
  | 'industriesExperience'
  | 'certifications'
  | 'marketsAndLanguages'
  | 'deliveryModel'
>;

export type ThreatLevel = 'low' | 'medium' | 'high';

export interface CompetitorAssessmentResult {
  companySummary: string;
  threatLevel: ThreatLevel;
  strengths: string[];
  weaknesses: string[];
  overlapWithUs: string;
  recommendations: string[];
  fullAnalysis: string;
}

export interface AssessmentSource {
  url: string;
  title: string;
}

export interface CompetitorAssessmentUsage {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
}

export interface CompetitorInfo {
  orgFullname: string;
  taxCode: string | null;
  bidCount: number;
  winCount: number;
  winRate: number;
  totalWinningValue: string;
  keywords: string[];
  sampleTenderTitles: string[];
}

const NOT_PROVIDED = 'Chưa cập nhật';

function joinOrDefault(values: string[] | null | undefined): string {
  return values && values.length > 0 ? values.join(', ') : NOT_PROVIDED;
}

const RESPONSE_SCHEMA = {
  name: 'competitor_assessment_result',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      companySummary: {
        type: 'string',
        description:
          'Tóm tắt 2-4 câu về công ty đối thủ: ngành nghề, quy mô, năng lực chính — dựa trên thông tin tìm được trên web. ' +
          'Nếu không tìm được thông tin đáng tin cậy, nói rõ điều đó thay vì suy đoán.',
      },
      threatLevel: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Mức độ đe doạ cạnh tranh của đối thủ này so với hồ sơ năng lực công ty.',
      },
      strengths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Điểm mạnh của đối thủ, dựa trên lịch sử đấu thầu và thông tin tìm được trên web.',
      },
      weaknesses: {
        type: 'array',
        items: { type: 'string' },
        description: 'Điểm yếu/hạn chế của đối thủ.',
      },
      overlapWithUs: {
        type: 'string',
        description: 'Mức độ trùng lặp về ngành nghề/dịch vụ giữa đối thủ và hồ sơ năng lực công ty.',
      },
      recommendations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Khuyến nghị hành động cụ thể để cạnh tranh hiệu quả với đối thủ này.',
      },
      fullAnalysis: {
        type: 'string',
        description: 'Phân tích đầy đủ, chi tiết bằng tiếng Việt (vài đoạn văn), tổng hợp toàn bộ đánh giá ở trên.',
      },
    },
    required: [
      'companySummary',
      'threatLevel',
      'strengths',
      'weaknesses',
      'overlapWithUs',
      'recommendations',
      'fullAnalysis',
    ],
  },
} as const;

function buildSystemPrompt(profile: ScoringProfile): string {
  return [
    `Bạn là chuyên gia phân tích đối thủ cạnh tranh cho ${profile.name}.`,
    '',
    'HỒ SƠ NĂNG LỰC CÔNG TY CHÚNG TÔI (căn cứ đối chiếu):',
    `- Vị thế: ${profile.positioning ?? NOT_PROVIDED}`,
    `- Dịch vụ chính: ${joinOrDefault(profile.services)}`,
    `- Sản phẩm/giải pháp: ${joinOrDefault(profile.productsAndSolutions)}`,
    `- Ngành đã triển khai: ${joinOrDefault(profile.industriesExperience)}`,
    `- Chứng nhận/giải thưởng: ${joinOrDefault(profile.certifications)}`,
    `- Thị trường/ngôn ngữ: ${joinOrDefault(profile.marketsAndLanguages)}`,
    `- Mô hình triển khai: ${profile.deliveryModel ?? NOT_PROVIDED}`,
    '',
    'NHIỆM VỤ: Người dùng sẽ cung cấp thông tin về MỘT CÔNG TY ĐỐI THỦ (tên, mã số thuế nếu có, và ' +
      'thống kê các gói thầu họ đã tham gia/trúng thầu thu thập được từ dữ liệu MuaSamCong). ' +
      'Hãy DÙNG CÔNG CỤ TÌM KIẾM WEB để tra cứu thêm thông tin công khai về công ty này ' +
      '(trang web công ty, thông tin đăng ký kinh doanh trên các trang như masothue.com/thongtincongty.co, ' +
      'tin tức, hồ sơ năng lực nếu có...), sau đó so sánh với hồ sơ năng lực công ty chúng tôi ở trên để ' +
      'đưa ra đánh giá đối thủ đầy đủ.',
    '',
    'YÊU CẦU:',
    '- Luôn trả lời bằng tiếng Việt.',
    '- Chỉ dùng bằng chứng từ dữ liệu đấu thầu được cung cấp và kết quả tìm kiếm web thực tế — ' +
      'không suy diễn hay bịa đặt thông tin không có căn cứ.',
    '- Nếu tìm kiếm web không ra thông tin đáng tin cậy về công ty, hãy nói rõ trong companySummary và ' +
      'dựa đánh giá chủ yếu vào dữ liệu lịch sử đấu thầu đã cung cấp.',
    '- threatLevel đánh giá dựa trên: mức độ trùng lặp ngành nghề/dịch vụ với chúng tôi, tỷ lệ trúng thầu, ' +
      'quy mô giá trị trúng thầu, và số lượng từ khoá/lĩnh vực họ tham gia.',
  ].join('\n');
}

function buildUserPayload(competitor: CompetitorInfo): string {
  return JSON.stringify({
    competitor: {
      org_fullname: competitor.orgFullname,
      tax_code: competitor.taxCode,
      bid_count: competitor.bidCount,
      win_count: competitor.winCount,
      win_rate_percent: competitor.winRate,
      total_winning_value_vnd: competitor.totalWinningValue,
      keywords_participated: competitor.keywords,
      sample_recent_tender_titles: competitor.sampleTenderTitles,
    },
  });
}

@Injectable()
export class OpenAiCompetitorAssessmentService {
  private readonly logger = new Logger(OpenAiCompetitorAssessmentService.name);
  private readonly client: OpenAI | null = null;
  private readonly model: string;
  private readonly backupModel: string | null = null;
  private activeModel: string;
  private readonly provider: string;
  private readonly configured: boolean;
  private readonly maxRetries = 1;

  constructor(private configService: ConfigService) {
    const geminiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    const openaiKey = this.configService.get<string>('OPENAI_API_KEY')?.trim();
    const openrouterKey = this.configService.get<string>('OPENROUTER_API_KEY')?.trim();

    let apiKey: string | undefined;
    let baseURL: string | undefined;
    let model = 'gpt-4o-mini';
    let provider = 'None';

    let backupModel: string | null = null;

    if (geminiKey) {
      provider = 'Gemini';
      apiKey = geminiKey;
      baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
      model = sanitizeGeminiModel(this.configService.get<string>('GEMINI_MODEL'), DEFAULT_GEMINI_MAIN_MODEL);
      const configuredBackup = sanitizeGeminiModel(
        this.configService.get<string>('GEMINI_BACKUP_MODEL'),
        DEFAULT_GEMINI_BACKUP_MODEL,
      );
      backupModel = configuredBackup !== model ? configuredBackup : DEFAULT_GEMINI_BACKUP_MODEL;
    } else if (openaiKey) {
      provider = 'OpenAI';
      apiKey = openaiKey;
      baseURL = this.configService.get<string>('OPENAI_BASE_URL')?.trim() || undefined;
      model = this.configService.get<string>('OPENAI_MODEL')?.trim() || 'gpt-4o-mini';
    } else if (openrouterKey) {
      provider = 'OpenRouter';
      apiKey = openrouterKey;
      baseURL = this.configService.get<string>('OPENROUTER_BASE_URL')?.trim() || 'https://openrouter.ai/api/v1';
      model = this.configService.get<string>('OPENROUTER_MODEL')?.trim() || 'openrouter/auto';
    }

    this.provider = provider;
    this.model = model;
    this.backupModel = backupModel;
    this.activeModel = model;

    if (apiKey) {
      this.client = new OpenAI({
        apiKey,
        ...(baseURL ? { baseURL } : {}),
      });
      this.configured = true;
      this.logger.log(`Initialized Competitor Assessment Service using ${provider} (model: ${model})`);
    } else {
      this.client = null;
      this.configured = false;
      this.logger.warn(
        'Competitor assessment AI is disabled: No API key configured (GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY are all empty)',
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

  async assessCompetitor(
    competitor: CompetitorInfo,
    profile: ScoringProfile,
  ): Promise<{ result: CompetitorAssessmentResult; sources: AssessmentSource[]; usage: CompetitorAssessmentUsage }> {
    if (!this.configured || !this.client) {
      throw new Error(
        'Không thể đánh giá đối thủ bằng AI: Chưa cấu hình API key (GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY đều trống).',
      );
    }

    const systemPrompt = buildSystemPrompt(profile);
    const userPayload = buildUserPayload(competitor);

    let lastError: unknown;
    const modelsToTry =
      this.provider === 'Gemini' && this.backupModel
        ? (this.activeModel === this.backupModel ? [this.backupModel] : [this.model, this.backupModel])
        : [this.activeModel];

    for (const currentModel of modelsToTry) {
      if (currentModel === this.backupModel && this.activeModel !== this.backupModel) {
        this.logger.warn(
          `Primary Gemini model (${this.model}) failed, falling back to backup model: ${this.backupModel}`,
        );
      }

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const response = await this.client.responses.create({
            model: currentModel,
          tools: [{ type: 'web_search_preview' }],
          input: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPayload },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: RESPONSE_SCHEMA.name,
              strict: RESPONSE_SCHEMA.strict,
              schema: RESPONSE_SCHEMA.schema,
            },
          },
        });

        const raw = response.output_text;
        if (!raw) {
          throw new Error('AI response rỗng (không có output_text).');
        }

        const parsed = JSON.parse(raw) as CompetitorAssessmentResult;
        this.validateResult(parsed);

        if (this.provider === 'Gemini' && currentModel === this.backupModel && this.activeModel !== this.backupModel) {
          this.activeModel = this.backupModel;
          this.logger.warn(
            `[OpenAiCompetitorAssessmentService] Primary Gemini model (${this.model}) failed and backup succeeded. Permanently switched active model to ${this.backupModel} for subsequent requests.`,
          );
        }

        return {
          result: parsed,
          sources: this.extractSources(response),
          usage: {
            promptTokens: response.usage?.input_tokens ?? null,
            completionTokens: response.usage?.output_tokens ?? null,
            totalTokens: response.usage?.total_tokens ?? null,
          },
        };
      } catch (err) {
        lastError = err;
        if (attempt === this.maxRetries) {
          break;
        }
        this.logger.warn(
          `Đánh giá đối thủ "${competitor.orgFullname}" thất bại (lần ${attempt + 1}/${this.maxRetries + 1}): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
    }

    throw new Error(
      `Không thể đánh giá đối thủ "${competitor.orgFullname}" sau ${this.maxRetries + 1} lần thử: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  /** Trích các trích dẫn url_citation mà model gắn vào khi dùng web_search_preview,
   * gộp theo url để loại trùng (model có thể trích dẫn cùng 1 nguồn nhiều lần). */
  private extractSources(response: OpenAI.Responses.Response): AssessmentSource[] {
    const byUrl = new Map<string, string>();

    for (const item of response.output) {
      if (item.type !== 'message') continue;
      for (const content of item.content) {
        if (content.type !== 'output_text') continue;
        for (const annotation of content.annotations ?? []) {
          if (annotation.type === 'url_citation') {
            byUrl.set(annotation.url, annotation.title || annotation.url);
          }
        }
      }
    }

    return Array.from(byUrl.entries()).map(([url, title]) => ({ url, title }));
  }

  private validateResult(result: CompetitorAssessmentResult): void {
    const validThreatLevels: ThreatLevel[] = ['low', 'medium', 'high'];
    if (
      typeof result.companySummary !== 'string' ||
      !validThreatLevels.includes(result.threatLevel) ||
      !Array.isArray(result.strengths) ||
      !Array.isArray(result.weaknesses) ||
      typeof result.overlapWithUs !== 'string' ||
      !Array.isArray(result.recommendations) ||
      typeof result.fullAnalysis !== 'string'
    ) {
      throw new Error('Kết quả AI trả về không đúng schema mong đợi.');
    }
  }
}

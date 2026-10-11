import { ConfigService } from '@nestjs/config';
import { OpenAiScoringService } from './openai-scoring.service';

describe('OpenAiScoringService', () => {
  function createServiceWithEnv(env: Record<string, string | undefined>): OpenAiScoringService {
    const configService = {
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService;

    return new OpenAiScoringService(configService);
  }

  const mockProfile = {
    name: 'Test Profile',
    industries: [],
    technologies: [],
    products: [],
    keywords: [],
    positioning: null,
    services: [],
    productsAndSolutions: [],
    industriesExperience: [],
    certifications: [],
    marketsAndLanguages: [],
    deliveryModel: null,
  };

  describe('configuration & provider selection', () => {
    it('is not configured when all API keys are undefined or empty', () => {
      const service = createServiceWithEnv({
        OPENAI_API_KEY: '',
        GEMINI_API_KEY: '   ',
        OPENROUTER_API_KEY: undefined,
      });

      expect(service.isConfigured).toBe(false);
      expect(service.providerName).toBe('None');
    });

    it('throws error when scoreTender is called but service is not configured', async () => {
      const service = createServiceWithEnv({});
      const tender = { title: 'Test Tender', sector: null, description: null, requirementsText: null };

      await expect(service.scoreTender(tender, mockProfile)).rejects.toThrow(
        /Chưa cấu hình API key/i,
      );
    });

    it('selects Gemini provider with specified models', () => {
      const service = createServiceWithEnv({
        GEMINI_API_KEY: 'gemini-key-123',
        GEMINI_MODEL: 'gemini-3.5-flash-lite',
        GEMINI_BACKUP_MODEL: 'gemini-3.1-flash-lite',
      });

      expect(service.isConfigured).toBe(true);
      expect(service.providerName).toBe('Gemini');
      expect(service.modelName).toBe('gemini-3.5-flash-lite');
      expect(service.backupModelName).toBe('gemini-3.1-flash-lite');
    });

    it('defaults Gemini models to gemini-3.5-flash-lite and gemini-3.1-flash-lite', () => {
      const service = createServiceWithEnv({
        GEMINI_API_KEY: 'gemini-key-123',
      });

      expect(service.isConfigured).toBe(true);
      expect(service.providerName).toBe('Gemini');
      expect(service.modelName).toBe('gemini-3.5-flash-lite');
      expect(service.backupModelName).toBe('gemini-3.1-flash-lite');
    });

    it('automatically sanitizes deprecated Gemini models to gemini-3.5-flash-lite', () => {
      const service = createServiceWithEnv({
        GEMINI_API_KEY: 'gemini-key-123',
        GEMINI_MODEL: 'gemini-2.5-flash',
      });

      expect(service.isConfigured).toBe(true);
      expect(service.providerName).toBe('Gemini');
      expect(service.modelName).toBe('gemini-3.5-flash-lite');
      expect(service.backupModelName).toBe('gemini-3.1-flash-lite');
    });

    it('selects OpenAI provider when OPENAI_API_KEY is present and GEMINI_API_KEY is empty', () => {
      const service = createServiceWithEnv({
        OPENAI_API_KEY: 'openai-key-123',
        GEMINI_API_KEY: '',
      });

      expect(service.isConfigured).toBe(true);
      expect(service.providerName).toBe('OpenAI');
      expect(service.modelName).toBe('gpt-4o-mini');
      expect(service.backupModelName).toBeNull();
    });

    it('selects OpenRouter provider when only OPENROUTER_API_KEY is present', () => {
      const service = createServiceWithEnv({
        OPENROUTER_API_KEY: 'openrouter-key-123',
      });

      expect(service.isConfigured).toBe(true);
      expect(service.providerName).toBe('OpenRouter');
      expect(service.modelName).toBe('openrouter/auto');
      expect(service.backupModelName).toBeNull();
    });

    it('falls back to backup model when primary fails and switches permanently for subsequent requests', async () => {
      const service = createServiceWithEnv({
        GEMINI_API_KEY: 'gemini-key-123',
        GEMINI_MODEL: 'gemini-3.5-flash-lite',
        GEMINI_BACKUP_MODEL: 'gemini-3.1-flash-lite',
      });

      expect(service.modelName).toBe('gemini-3.5-flash-lite');

      const tender = { title: 'Test Fallback Tender', sector: null, description: null, requirementsText: null };
      const validResult = {
        score: 85,
        verdict: 'GO',
        reasoning: 'Good fit',
        matchedCriteria: ['Software'],
        gaps: [],
        riskFlags: [],
        recommendedFocus: ['Focus'],
        isDxProject: true,
        domainBucket: 'other',
        bidGuaranteeMentioned: false,
        bidGuaranteeUnder100tr: false,
      };

      const generateContentMock = jest.fn()
        // First request: primary fails 3 times, backup succeeds on 4th call
        .mockRejectedValueOnce(new Error('Rate limit exceeded on primary'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded on primary'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded on primary'))
        .mockResolvedValueOnce({ text: JSON.stringify(validResult) })
        // Second request: backup succeeds immediately on 1st attempt
        .mockResolvedValueOnce({ text: JSON.stringify(validResult) });

      (service as any).geminiClient = {
        models: {
          generateContent: generateContentMock,
        },
      };

      // 1. First call: falls back to backup and switches active model
      const result1 = await service.scoreTender(tender, mockProfile);
      expect(result1.score).toBe(85);
      expect(generateContentMock).toHaveBeenCalledTimes(4);
      expect(generateContentMock.mock.calls[0][0].model).toBe('gemini-3.5-flash-lite');
      expect(generateContentMock.mock.calls[3][0].model).toBe('gemini-3.1-flash-lite');

      // Assert active model is permanently switched to backup
      expect(service.modelName).toBe('gemini-3.1-flash-lite');

      // 2. Second call: directly calls backup model, primary is NOT called
      const result2 = await service.scoreTender(tender, mockProfile);
      expect(result2.score).toBe(85);
      expect(generateContentMock).toHaveBeenCalledTimes(5);
      expect(generateContentMock.mock.calls[4][0].model).toBe('gemini-3.1-flash-lite');
    });

    it('passes responseSchema in generateContent config for Gemini', async () => {
      const service = createServiceWithEnv({
        GEMINI_API_KEY: 'gemini-key-123',
        GEMINI_MODEL: 'gemini-3.5-flash-lite',
      });

      const tender = { title: 'Schema Tender', sector: null, description: null, requirementsText: null };
      const validResult = {
        score: 75,
        verdict: 'CONSIDER',
        reasoning: 'Matches technical domain',
        matchedCriteria: ['IT'],
        gaps: [],
        riskFlags: [],
        recommendedFocus: [],
        isDxProject: true,
        domainBucket: 'other',
        bidGuaranteeMentioned: false,
        bidGuaranteeUnder100tr: false,
      };

      const generateContentMock = jest.fn().mockResolvedValueOnce({ text: JSON.stringify(validResult) });
      (service as any).geminiClient = {
        models: {
          generateContent: generateContentMock,
        },
      };

      const result = await service.scoreTender(tender, mockProfile);
      expect(result.score).toBe(75);
      expect(result.reasoning).toBe('Matches technical domain');
      expect(generateContentMock).toHaveBeenCalledTimes(1);
      const callConfig = generateContentMock.mock.calls[0][0].config;
      expect(callConfig.responseMimeType).toBe('application/json');
      expect(callConfig.responseSchema).toBeDefined();
      expect(callConfig.responseSchema.properties.reasoning).toBeDefined();
    });

    it('normalizes missing reasoning with fallback for Gemini when model omits reasoning', async () => {
      const service = createServiceWithEnv({
        GEMINI_API_KEY: 'gemini-key-123',
        GEMINI_MODEL: 'gemini-3.5-flash-lite',
      });

      const tender = { title: 'Tender Missing Reasoning', sector: null, description: null, requirementsText: null };
      const rawWithoutReasoning = {
        score: 10,
        verdict: 'NO_GO',
        matchedCriteria: ['Software development'],
        gaps: ['Khong dap ung chung chi ISO 27001'],
        riskFlags: ['Thoi gian gap'],
        recommendedFocus: [],
        isDxProject: false,
        domainBucket: 'other',
        bidGuaranteeMentioned: false,
        bidGuaranteeUnder100tr: false,
      };

      const generateContentMock = jest.fn().mockResolvedValueOnce({ text: JSON.stringify(rawWithoutReasoning) });
      (service as any).geminiClient = {
        models: {
          generateContent: generateContentMock,
        },
      };

      const result = await service.scoreTender(tender, mockProfile);
      expect(result.score).toBe(10);
      expect(result.verdict).toBe('NO_GO');
      expect(result.reasoning).toBe('Khong dap ung chung chi ISO 27001');
    });

    it('rejects AI result with missing or empty reasoning when not normalized', async () => {
      const service = createServiceWithEnv({
        OPENAI_API_KEY: 'openai-key-123',
      });

      const tender = { title: 'OpenAI Missing Reasoning', sector: null, description: null, requirementsText: null };
      const invalidResult = {
        score: 80,
        verdict: 'GO',
        reasoning: '   ', // blank reasoning
        matchedCriteria: ['Tech'],
        gaps: [],
        riskFlags: [],
        recommendedFocus: [],
        isDxProject: true,
        domainBucket: 'other',
        bidGuaranteeMentioned: false,
        bidGuaranteeUnder100tr: false,
      };

      (service as any).openAiClient = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(invalidResult) } }],
            }),
          },
        },
      };

      await expect(service.scoreTender(tender, mockProfile)).rejects.toThrow(
        /kh\u00f4ng \u0111\u00fang schema|khng dng schema/i,
      );
    });
  });
});

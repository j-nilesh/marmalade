import { ProviderConnectionError } from './errors.js';
import type {
  ProviderId,
  ProviderPreflightResult,
} from '../../shared/types.js';
import type { MarmaladeDatabase, SproutDatabase } from '../db/sqlite.js';
import type { ModelProvider, SearchProvider } from './types.js';
import { GeminiModelProvider } from './gemini.js';
import { MockModelProvider } from './mock.js';
import { OllamaModelProvider } from './ollama.js';
import { OpenAIModelProvider } from './openai.js';
import { AnthropicModelProvider } from './anthropic.js';
import {
  PluggableWebSearchProvider,
  SyntheticSearchProvider,
} from './search.js';

export class ProviderRegistry {
  private readonly modelProviders = new Map<ProviderId, ModelProvider>();
  private readonly checks = new Map<ProviderId, ProviderPreflightResult>();
  private readonly settingsSignatures = new Map<ProviderId, string>();
  private searchProvider: SearchProvider;
  private readonly db?: MarmaladeDatabase;

  constructor(db?: MarmaladeDatabase) {
    this.db = db;
    this.searchProvider = new SyntheticSearchProvider();
    this.reloadFromSettings();
  }

  public reloadFromSettings(): void {
    const settings = this.db?.getProviderSettingsInternal();
    const signatures: Record<ProviderId, unknown> = {
      mock: 'demo',
      gemini: [
        settings?.geminiApiKey,
        settings?.geminiFastModel,
        settings?.geminiReasoningModel,
        settings?.geminiZdrApproved,
      ],
      openai: [
        settings?.openaiApiKey,
        settings?.openaiModel,
        settings?.openaiZdrApproved,
      ],
      anthropic: [
        settings?.anthropicApiKey,
        settings?.anthropicModel,
        settings?.anthropicZdrApproved,
      ],
      local_ollama: [settings?.ollamaBaseUrl, settings?.ollamaModel],
    };
    for (const [id, values] of Object.entries(signatures)) {
      const providerId = id as ProviderId,
        signature = JSON.stringify(values);
      if (signature !== this.settingsSignatures.get(providerId))
        this.checks.delete(providerId);
      this.settingsSignatures.set(providerId, signature);
    }

    const mock = new MockModelProvider();
    const gemini = new GeminiModelProvider({
      apiKey: settings?.geminiApiKey || process.env.GEMINI_API_KEY,
      fastModel: settings?.geminiFastModel || process.env.GEMINI_FAST_MODEL,
      reasoningModel:
        settings?.geminiReasoningModel || process.env.GEMINI_REASONING_MODEL,
      zeroDataRetentionApproved:
        settings !== undefined
          ? settings.geminiZdrApproved
          : process.env.GEMINI_ZDR_APPROVED === 'true' ||
            process.env.GEMINI_ZDR_APPROVED === '1',
    });
    const ollama = new OllamaModelProvider({
      baseUrl: settings?.ollamaBaseUrl || process.env.OLLAMA_BASE_URL,
      modelName: settings?.ollamaModel || process.env.OLLAMA_MODEL,
    });
    const openai = new OpenAIModelProvider({
      apiKey: settings?.openaiApiKey || process.env.OPENAI_API_KEY,
      model: settings?.openaiModel || process.env.OPENAI_MODEL,
      zeroDataRetentionApproved:
        settings !== undefined
          ? settings.openaiZdrApproved
          : process.env.OPENAI_ZDR_APPROVED === 'true' ||
            process.env.OPENAI_ZDR_APPROVED === '1',
    });
    const anthropic = new AnthropicModelProvider({
      apiKey: settings?.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      model: settings?.anthropicModel || process.env.ANTHROPIC_MODEL,
      zeroDataRetentionApproved:
        settings !== undefined
          ? settings.anthropicZdrApproved
          : process.env.ANTHROPIC_ZDR_APPROVED === 'true' ||
            process.env.ANTHROPIC_ZDR_APPROVED === '1',
    });

    this.modelProviders.set('mock', mock);
    this.modelProviders.set('gemini', gemini);
    this.modelProviders.set('local_ollama', ollama);
    this.modelProviders.set('openai', openai);
    this.modelProviders.set('anthropic', anthropic);

    const searchUrl =
      settings?.searchApiUrl || process.env.SEARCH_API_URL || '';
    const searchKey = settings?.searchApiKey || process.env.SEARCH_API_KEY;
    this.searchProvider = searchUrl
      ? new PluggableWebSearchProvider({
          searchApiUrl: searchUrl,
          searchApiKey: searchKey,
        })
      : new SyntheticSearchProvider();
  }

  public getModelProvider(id: ProviderId): ModelProvider {
    const provider = this.modelProviders.get(id);
    if (!provider) {
      return this.modelProviders.get('mock')!;
    }
    return provider;
  }

  public listModelProviders(): Array<{
    id: ProviderId;
    displayName: string;
    isLocal: boolean;
    safetyVerified: boolean;
    parentAcknowledged: boolean;
    readiness?: ProviderPreflightResult;
    statusNote: string;
  }> {
    return Array.from(this.modelProviders.values()).map((p) => ({
      id: p.id,
      displayName: p.displayName,
      isLocal: p.isLocal,
      safetyVerified: false,
      parentAcknowledged: p.safetyVerified,
      statusNote: p.statusNote,
      readiness: this.checks.get(p.id),
    }));
  }

  public getSearchProvider(allowExternalSearch = true): SearchProvider {
    if (!allowExternalSearch) {
      return new SyntheticSearchProvider();
    }
    return this.searchProvider;
  }

  public isExternalSearchConfigured(): boolean {
    const settings = this.db?.getProviderSettingsInternal();
    const searchUrl =
      settings?.searchApiUrl || process.env.SEARCH_API_URL || '';
    return Boolean(searchUrl.trim());
  }

  public recordFailure(id: ProviderId): void {
    this.checks.set(id, {
      providerId: id,
      ok: false,
      reachable: false,
      modelFound: false,
      safetyVerified: false,
      parentAcknowledged: this.getModelProvider(id).safetyVerified,
      structuredOutputVerified: false,
      details: 'The last answer failed. Run a new sample test.',
    });
  }
  public async listGeminiModels(): Promise<string[]> {
    this.reloadFromSettings();
    return (
      this.getModelProvider('gemini') as GeminiModelProvider
    ).listModels();
  }

  public async listAnthropicModels(): Promise<string[]> {
    this.reloadFromSettings();
    const provider = this.getModelProvider('anthropic');
    if (provider && 'listModels' in provider && typeof (provider as any).listModels === 'function') {
      return (provider as any).listModels();
    }
    return ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
  }

  public async runPreflightTest(
    id: ProviderId
  ): Promise<ProviderPreflightResult> {
    this.reloadFromSettings();
    const provider = this.getModelProvider(id);
    const testedSignature = this.settingsSignatures.get(id);
    const sampleAnswers: NonNullable<ProviderPreflightResult['sampleAnswers']> =
      [];
    let reachable = false,
      modelFound = false;
    let result: ProviderPreflightResult;
    try {
      const compat = provider.checkCompatibility
        ? await provider.checkCompatibility()
        : {
            ok: true,
            reachable: true,
            modelFound: true,
            details: 'Demo provider',
          };
      reachable = compat.reachable;
      modelFound = compat.modelFound;
      if (!compat.ok || !provider.safetyVerified) {
        result = {
          providerId: id,
          ok: false,
          reachable: compat.reachable,
          modelFound: compat.modelFound,
          safetyVerified: false,
          structuredOutputVerified: false,
          details: compat.details,
        };
      } else {
        for (const mode of id === 'gemini'
          ? (['ask', 'schoolwork'] as const)
          : (['ask'] as const)) {
          const answer = await provider.generate({
            mode,
            messages: [
              {
                role: 'user',
                content:
                  'Reply with one short sentence explaining that the Moon reflects sunlight.',
              },
            ],
            maxOutputTokens: 180,
            temperature: 0,
          });
          if (!answer.content.trim()) throw new Error('Empty generation');
          sampleAnswers.push({ mode, answer: answer.content });
        }
        result = {
          providerId: id,
          ok: true,
          reachable: true,
          modelFound: true,
          safetyVerified: false,
          structuredOutputVerified: false,
          details:
            id === 'mock'
              ? 'Demo responses work. No external AI is connected.'
              : 'A sample answer succeeded with the configured model routes. This tests generation, not safety or data-retention guarantees.',
        };
      }
    } catch (error) {
      result = {
        providerId: id,
        ok: false,
        reachable,
        modelFound,
        safetyVerified: false,
        structuredOutputVerified: false,
        details:
          error instanceof ProviderConnectionError
            ? error.message
            : 'The configured model could not generate a sample answer. Check the model name, account access, quota, and connection.',
      };
    }
    if (testedSignature !== this.settingsSignatures.get(id)) {
      result.ok = false;
      result.details =
        'Configuration changed during the sample test. Test the current configuration again.';
    }
    if (result.ok) result.sampleAnswers = sampleAnswers;
    result.checkedAtMs = Date.now();
    result.generationVerified = result.ok;
    result.parentAcknowledged = provider.safetyVerified;
    this.checks.set(id, result);
    return result;
  }
}

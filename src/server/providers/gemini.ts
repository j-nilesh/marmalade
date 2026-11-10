import { ProviderConnectionError } from './errors.js';
import type {
  CompatibilityCheckResult,
  ModelGenerateRequest,
  ModelGenerateResult,
  ModelProvider,
  ProviderCapabilities,
} from './types.js';

export interface GeminiProviderOptions {
  apiKey?: string;
  fastModel?: string; // new-install default: gemini-3.8-flash
  reasoningModel?: string; // new-install default: gemini-3.8-flash
  zeroDataRetentionApproved?: boolean;
}

export class GeminiModelProvider implements ModelProvider {
  readonly id = 'gemini' as const;
  readonly displayName = 'Google Gemini';
  readonly isLocal = false;
  readonly maxPotentialCostPerTurnCents = 10; // Conservative per-turn budget reservation

  get safetyVerified(): boolean {
    return Boolean(this.apiKey && this.zeroDataRetentionApproved);
  }

  get statusNote(): string {
    if (!this.apiKey) {
      return 'Requires server-side GEMINI_API_KEY (Google Cloud / AI Studio). Never exposed to browser.';
    }
    if (!this.zeroDataRetentionApproved) {
      return 'Gemini API key set. A parent must review cloud data handling before enabling child sessions.';
    }
    return `Hybrid routing active: '${this.fastModel}' for Ask, Play & Research; '${this.reasoningModel}' for Schoolwork Socratic coaching.`;
  }

  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    toolUse: true,
    maxContextTokens: 1000000,
    imageInput: false,
    fileInput: false,
    inputModeration: true,
    outputModeration: true,
    zeroDataRetentionVerified: false,
  };

  private readonly apiKey: string;
  private readonly fastModel: string;
  private readonly reasoningModel: string;
  private readonly zeroDataRetentionApproved: boolean;

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = (options.apiKey || process.env.GEMINI_API_KEY || '').trim();
    this.fastModel = (
      options.fastModel ||
      process.env.GEMINI_FAST_MODEL ||
      'gemini-3.8-flash'
    ).trim();
    this.reasoningModel = (
      options.reasoningModel ||
      process.env.GEMINI_REASONING_MODEL ||
      'gemini-3.8-flash'
    ).trim();
    this.zeroDataRetentionApproved =
      options.zeroDataRetentionApproved ??
      (process.env.GEMINI_ZDR_APPROVED === 'true' ||
        process.env.GEMINI_ZDR_APPROVED === '1');
    // Acknowledgment is not independent verification of retention.
  }

  /**
   * Select model based on activity mode:
   * - Schoolwork Assistance -> reasoningModel (gemini-2.5-pro)
   * - Ask, Play, Research -> fastModel (gemini-2.5-flash)
   */
  public selectModelForMode(mode: ModelGenerateRequest['mode']): string {
    if (mode === 'schoolwork') {
      return this.reasoningModel;
    }
    return this.fastModel;
  }

  async listModels(): Promise<string[]> {
    if (!this.apiKey) throw new Error('PROVIDER_UNAVAILABLE');
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      {
        headers: { 'x-goog-api-key': this.apiKey },
        signal: AbortSignal.timeout(6000),
      }
    );
    if (!response.ok) throw new Error('PROVIDER_UNAVAILABLE');
    const data = await response.json();
    return (data.models || [])
      .filter(
        (model: any) =>
          model.supportedGenerationMethods?.includes('generateContent') &&
          !/image|tts|audio|transcribe|robotics|research|computer|antigravity|lyria/.test(
            model.name
          )
      )
      .map((model: any) => String(model.name).replace(/^models\//, ''));
  }

  async checkCompatibility(): Promise<CompatibilityCheckResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details:
          'No Gemini API key configured. Paste your Google Cloud / AI Studio API key in the Parent Dashboard.',
        capabilities: this.capabilities,
      };
    }

    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models',
        {
          headers: { 'x-goog-api-key': this.apiKey },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (!res.ok) {
        return {
          ok: false,
          reachable: true,
          modelFound: false,
          details: `Google Gemini API returned HTTP ${res.status}. Verify your GEMINI_API_KEY.`,
          capabilities: this.capabilities,
        };
      }

      const data = await res.json().catch(() => ({}));
      const modelNames: string[] = Array.isArray(data.models)
        ? data.models.map((m: any) => String(m.name || ''))
        : [];
      const hasFast = modelNames.some((n) => n === `models/${this.fastModel}`);

      return {
        ok: hasFast && this.zeroDataRetentionApproved,
        reachable: true,
        modelFound: hasFast,
        details: this.zeroDataRetentionApproved
          ? `Google Gemini API connected. Hybrid routing ready: '${this.fastModel}' (Ask/Play/Research) + '${this.reasoningModel}' (Schoolwork). Parent has acknowledged cloud data handling. Generation still needs testing.`
          : `Google Gemini API connected ('${this.fastModel}' verified), but parent data-handling acknowledgment is missing.`,
        capabilities: this.capabilities,
      };
    } catch (err: any) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details: `Network error connecting to Google Gemini API: ${err?.message || 'timeout'}`,
        capabilities: this.capabilities,
      };
    }
  }

  private async callGenerateContent(
    modelName: string,
    request: ModelGenerateRequest
  ): Promise<Response> {
    const systemMessages = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const contents = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    if (contents.length === 0 && systemMessages) {
      contents.push({
        role: 'user',
        parts: [{ text: systemMessages }],
      });
    }

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxOutputTokens || 550,
        temperature: request.temperature ?? 0.6,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_LOW_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_LOW_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_LOW_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    };

    if (systemMessages && request.messages.some((m) => m.role !== 'system')) {
      payload.systemInstruction = {
        parts: [{ text: systemMessages }],
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName
    )}:generateContent`;

    return fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });
  }

  async generate(request: ModelGenerateRequest): Promise<ModelGenerateResult> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on this server.');
    }

    const targetModel = this.selectModelForMode(request.mode);
    let usedModel = targetModel;
    let res = await this.callGenerateContent(targetModel, request);

    if (!res.ok) {
      const code =
        res.status === 402
          ? 'PROVIDER_BILLING'
          : res.status === 404
            ? 'PROVIDER_MODEL'
            : [401, 403].includes(res.status)
              ? 'PROVIDER_AUTH'
              : 'PROVIDER_UNAVAILABLE';
      const message =
        code === 'PROVIDER_BILLING'
          ? 'This Gemini project has no prepaid credits. Check the project billing in AI Studio.'
          : code === 'PROVIDER_MODEL'
            ? 'This model is unavailable to the configured account. Load available models, select one, and test again.'
            : code === 'PROVIDER_AUTH'
              ? 'Gemini rejected this key or its access. Check the configured project and permissions.'
              : 'Gemini could not answer. Check availability and quota, then try again.';
      throw new ProviderConnectionError(code, message);
    }

    const data = await res.json();

    // Check if Gemini safety filters blocked the prompt or candidate
    const blockReason = data.promptFeedback?.blockReason;
    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;

    if (
      blockReason ||
      finishReason === 'SAFETY' ||
      finishReason === 'PROHIBITED_CONTENT'
    ) {
      return {
        content:
          'This request was paused by Gemini safety safeguards. Please talk with a parent or trusted adult if you need help with a sensitive topic.',
        tokenUsage: { promptTokens: 20, completionTokens: 20, totalTokens: 40 },
        estimatedCostCents: 0,
        safetyFlagged: {
          category: String(
            blockReason || finishReason || 'gemini_safety_filter'
          ).toLowerCase(),
          severity: 'medium',
        },
      };
    }

    const parts = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts
      : [];
    const content = parts
      .filter((p: any) => !p.thought)
      .map((p: any) => String(p.text || ''))
      .join('')
      .trim();

    const promptTokens = Number(data.usageMetadata?.promptTokenCount) || 50;
    const completionTokens =
      Number(data.usageMetadata?.candidatesTokenCount) || 80;
    const totalTokens =
      Number(data.usageMetadata?.totalTokenCount) ||
      promptTokens + completionTokens;

    // Standard text rates in USD per million tokens. Unknown models use a conservative estimate.
    // Source: https://ai.google.dev/gemini-api/docs/pricing (reviewed 2026-11-03).
    let inputRate = 4,
      outputRate = 20;
    if (usedModel === 'gemini-3.8-flash') {
      const promotional = Date.now() < Date.parse('2027-01-01T00:00:00Z');
      inputRate = promotional ? 0.75 : 1.5;
      outputRate = promotional ? 3.75 : 7.5;
    } else if (usedModel === 'gemini-2.5-flash') {
      inputRate = 0.3;
      outputRate = 2.5;
    } else if (usedModel === 'gemini-2.5-pro') {
      inputRate = promptTokens > 200000 ? 2.5 : 1.25;
      outputRate = promptTokens > 200000 ? 15 : 10;
    }
    const thinkingTokens = Number(data.usageMetadata?.thoughtsTokenCount) || 0;
    const costCents =
      (promptTokens * inputRate +
        (completionTokens + thinkingTokens) * outputRate) /
      10000;

    return {
      content,
      tokenUsage: {
        promptTokens,
        completionTokens,
        totalTokens,
      },
      estimatedCostCents: costCents,
    };
  }
}

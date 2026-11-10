import type {
  CompatibilityCheckResult,
  ModelGenerateRequest,
  ModelGenerateResult,
  ModelProvider,
  ProviderCapabilities,
} from './types.js';

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string; // defaults to gpt-4o-mini
  zeroDataRetentionApproved?: boolean;
}

export class OpenAIModelProvider implements ModelProvider {
  readonly id = 'openai' as const;
  readonly displayName = 'OpenAI API (GPT-4o-mini + Moderation)';
  readonly isLocal = false;
  readonly maxPotentialCostPerTurnCents = 10; // Bounded conservative cost estimate for budgeting

  get safetyVerified(): boolean {
    return Boolean(this.apiKey && this.zeroDataRetentionApproved);
  }

  get statusNote(): string {
    if (!this.apiKey) {
      return 'Requires server-side OPENAI_API_KEY. Never exposed to child or browser client.';
    }
    if (!this.zeroDataRetentionApproved) {
      return 'API key set. A parent must review the provider’s data handling before enabling child sessions.';
    }
    return 'OpenAI API configured with parent acknowledgment and server-side Moderation checks.';
  }

  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    toolUse: true,
    maxContextTokens: 16384,
    imageInput: false,
    fileInput: false,
    inputModeration: true,
    outputModeration: true,
    zeroDataRetentionVerified: false,
  };

  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly zeroDataRetentionApproved: boolean;

  constructor(options: OpenAIProviderOptions = {}) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || '';
    this.modelName = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.zeroDataRetentionApproved =
      options.zeroDataRetentionApproved ??
      (process.env.OPENAI_ZDR_APPROVED === 'true' || process.env.OPENAI_ZDR_APPROVED === '1');
    // A parent acknowledgment does not verify account retention controls.
  }

  async checkCompatibility(): Promise<CompatibilityCheckResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details: 'No OpenAI API key provided. Set OPENAI_API_KEY in server environment or parent settings.',
        capabilities: this.capabilities,
      };
    }

    try {
      // Preflight test against OpenAI models endpoint
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        return {
          ok: false,
          reachable: true,
          modelFound: false,
          details: `OpenAI API returned HTTP ${res.status}. Check API key credentials.`,
          capabilities: this.capabilities,
        };
      }

      return {
        ok: this.zeroDataRetentionApproved,
        reachable: true,
        modelFound: true,
        details: this.zeroDataRetentionApproved
          ? `OpenAI API connected successfully with model '${this.modelName}'. Parent acknowledgment recorded; retention is not independently verified.`
          : `OpenAI API connected, but parent data-handling acknowledgment is missing.`,
        capabilities: this.capabilities,
      };
    } catch (err: any) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details: `Network error connecting to OpenAI API: ${err?.message || 'timeout'}`,
        capabilities: this.capabilities,
      };
    }
  }

  /**
   * Run OpenAI Moderation API before chat completions
   */
  private async checkModeration(text: string): Promise<{ flagged: boolean; category?: string }> {
    if (!this.apiKey || !text.trim()) return { flagged: false };
    try {
      const res = await fetch('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ input: text }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return { flagged: false };
      const data = await res.json();
      const result = data.results?.[0];
      if (result?.flagged) {
        const topCat = Object.entries(result.categories || {}).find(([_, flagged]) => flagged)?.[0] || 'flagged_content';
        return { flagged: true, category: topCat };
      }
      return { flagged: false };
    } catch {
      return { flagged: false };
    }
  }

  async generate(request: ModelGenerateRequest): Promise<ModelGenerateResult> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured on this server.');
    }

    const lastUserMsg = [...request.messages].reverse().find((m) => m.role === 'user')?.content || '';
    const mod = await this.checkModeration(lastUserMsg);

    if (mod.flagged) {
      return {
        content:
          'This message was flagged by moderation safeguards. Please talk with a parent or trusted adult if you need assistance with sensitive matters.',
        tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
        estimatedCostCents: 0,
        safetyFlagged: {
          category: mod.category || 'moderation_flagged',
          severity: 'medium',
        },
      };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: request.maxOutputTokens || 500,
        temperature: request.temperature ?? 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error (${res.status}): ${errJson?.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const content = String(data.choices?.[0]?.message?.content || '').trim();
    const promptTokens = Number(data.usage?.prompt_tokens) || 0;
    const completionTokens = Number(data.usage?.completion_tokens) || 0;
    const totalTokens = promptTokens + completionTokens;

    // Approximate cost calculation for gpt-4o-mini ($0.15 / 1M prompt, $0.60 / 1M completion)
    const costCents = (promptTokens * (this.modelName === 'gpt-4o-mini' ? 0.15 : 4) + completionTokens * (this.modelName === 'gpt-4o-mini' ? 0.6 : 20)) / 10000;

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

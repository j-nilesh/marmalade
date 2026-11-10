import type {
  CompatibilityCheckResult,
  ModelGenerateRequest,
  ModelGenerateResult,
  ModelMessage,
  ModelProvider,
  ProviderCapabilities,
} from './types.js';

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string; // defaults to claude-haiku-5-5
  zeroDataRetentionApproved?: boolean;
}

export const ANTHROPIC_CHILD_SAFETY_PROMPT =
  'You are interacting with a student/child in a family learning treehouse application. ' +
  'Your responses must be warm, friendly, kid-friendly, encouraging, educational, and safe. ' +
  'Speak with kindness, patience, and enthusiastic curiosity, using clear language and relatable everyday examples suitable for students aged 8–14. ' +
  'Never produce sexually explicit content, assist with dangerous or illegal activities, ' +
  'facilitate self-harm, or collect/share personal contact information. Do not encourage emotional dependence ' +
  'or pretend to have human feelings. If the user expresses emotional distress or danger, respond with calm empathy ' +
  'and encourage them to talk to a trusted adult, parent, or guardian.';

export class AnthropicModelProvider implements ModelProvider {
  readonly id = 'anthropic' as const;
  readonly displayName = 'Anthropic Claude';
  readonly isLocal = false;
  readonly maxPotentialCostPerTurnCents = 15; // Bounded conservative cost estimate for budgeting

  get safetyVerified(): boolean {
    return Boolean(this.apiKey && this.zeroDataRetentionApproved);
  }

  get statusNote(): string {
    if (!this.apiKey) {
      return 'Requires server-side ANTHROPIC_API_KEY. Never exposed to child or browser client.';
    }
    if (!this.zeroDataRetentionApproved) {
      return 'API key set. A parent must review the provider’s data handling before enabling child sessions.';
    }
    return `Anthropic Claude configured with parent acknowledgment (Model: ${this.modelName}).`;
  }

  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    toolUse: true,
    maxContextTokens: 200000,
    imageInput: false,
    fileInput: false,
    inputModeration: true,
    outputModeration: true,
    zeroDataRetentionVerified: false,
  };

  private readonly apiKey: string;
  private readonly modelName: string;
  private readonly zeroDataRetentionApproved: boolean;

  constructor(options: AnthropicProviderOptions = {}) {
    this.apiKey = (options.apiKey || process.env.ANTHROPIC_API_KEY || '').trim();
    this.modelName = (
      options.model ||
      process.env.ANTHROPIC_MODEL ||
      'claude-haiku-5-5'
    ).trim();
    this.zeroDataRetentionApproved =
      options.zeroDataRetentionApproved ??
      (process.env.ANTHROPIC_ZDR_APPROVED === 'true' ||
        process.env.ANTHROPIC_ZDR_APPROVED === '1');
  }

  async listModels(): Promise<string[]> {
    if (!this.apiKey) {
      return ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
    }
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        return ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
      }
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        const activeModels = data.data
          .filter((m: any) => m.lifecycle === 'active')
          .map((m: any) => String(m.id || ''))
          .filter((id: string) => id.startsWith('claude-'));
        if (activeModels.length > 0) return activeModels;
      }
      return ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
    } catch {
      return ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'];
    }
  }

  async checkCompatibility(): Promise<CompatibilityCheckResult> {
    if (!this.apiKey) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details:
          'No Anthropic API key provided. Set ANTHROPIC_API_KEY in server environment or parent settings.',
        capabilities: this.capabilities,
      };
    }

    try {
      // Send a minimal validation ping
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say hello in one word.' }],
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        let errMsg =
          errJson?.error?.message || `HTTP ${res.status} ${res.statusText}`;
        if (
          res.status === 404 ||
          errJson?.error?.type === 'not_found_error' ||
          errMsg.startsWith('model:')
        ) {
          errMsg = `Model '${this.modelName}' was not found or has retired. Please select an active model (such as 'claude-haiku-5-5' or 'claude-sonnet-5-5').`;
        }
        return {
          ok: false,
          reachable: true,
          modelFound: false,
          details: `Anthropic API error: ${errMsg}`,
          capabilities: this.capabilities,
        };
      }

      return {
        ok: this.zeroDataRetentionApproved,
        reachable: true,
        modelFound: true,
        details: this.zeroDataRetentionApproved
          ? `Anthropic Claude API connected successfully with model '${this.modelName}'. Parent data handling review recorded.`
          : `Anthropic Claude API connected, but parent data-handling acknowledgment is missing.`,
        capabilities: this.capabilities,
      };
    } catch (err: any) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details: `Network error connecting to Anthropic API: ${err?.message || 'timeout'}`,
        capabilities: this.capabilities,
      };
    }
  }

  async generate(request: ModelGenerateRequest): Promise<ModelGenerateResult> {
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured on this server.');
    }

    // Separate system messages from conversation turns
    // Compose Anthropic child safety guidance alongside mode-specific system prompts (Item 3)
    const systemParts: string[] = [ANTHROPIC_CHILD_SAFETY_PROMPT];
    const conversationTurns: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    for (const msg of request.messages) {
      if (msg.role === 'system') {
        systemParts.push(msg.content);
      } else {
        // Anthropic requires strictly alternating user and assistant messages
        const lastTurn = conversationTurns[conversationTurns.length - 1];
        if (lastTurn && lastTurn.role === msg.role) {
          lastTurn.content += `\n\n${msg.content}`;
        } else {
          conversationTurns.push({ role: msg.role, content: msg.content });
        }
      }
    }

    // Anthropic requires the first message to be from 'user'
    if (conversationTurns.length === 0 || conversationTurns[0].role !== 'user') {
      conversationTurns.unshift({
        role: 'user',
        content: 'Please proceed with the requested task.',
      });
    }

    const systemPrompt = systemParts.join('\n\n').trim();

    const isSonnet = this.modelName.toLowerCase().includes('sonnet');
    const isOpus = this.modelName.toLowerCase().includes('opus');
    const requestedTokens = request.maxOutputTokens || 800;
    // Bounded minimum tokens to ensure ample text generation headroom (Opus/Sonnet need higher ceiling)
    const maxTokens = isOpus
      ? Math.max(requestedTokens, 2048)
      : Math.max(requestedTokens, 1000);

    const payload: Record<string, any> = {
      model: this.modelName,
      max_tokens: maxTokens,
      messages: conversationTurns,
    };

    // Configure thinking based on model capabilities:
    // haiku models support { type: 'disabled' }
    // sonnet models support { type: 'between_tools' }
    const mLower = this.modelName.toLowerCase();
    if (mLower.includes('haiku')) {
      payload.thinking = { type: 'disabled' };
    } else if (mLower.includes('sonnet')) {
      payload.thinking = { type: 'between_tools' };
    }

    // Claude 5 series uses adaptive reasoning and deprecates the temperature parameter
    const isClaude5 = this.modelName.includes('-5') || this.modelName.includes('5-5');
    if (!isClaude5 && request.temperature !== undefined) {
      payload.temperature = request.temperature;
    }

    if (systemPrompt) {
      payload.system = systemPrompt;
    }

    let res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    });

    // If thinking option was rejected by a particular model, retry immediately without thinking param
    if (!res.ok && res.status === 400 && payload.thinking) {
      delete payload.thinking;
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      let errMsg = errJson?.error?.message || res.statusText;
      if (
        res.status === 404 ||
        errJson?.error?.type === 'not_found_error' ||
        errMsg.startsWith('model:')
      ) {
        errMsg = `Model '${this.modelName}' was not found or has retired. Please select an active model (such as 'claude-haiku-5-5' or 'claude-sonnet-5-5').`;
      }
      throw new Error(`Anthropic API error (${res.status}): ${errMsg}`);
    }

    let data = await res.json();
    let promptTokens = Number(data.usage?.input_tokens) || 0;
    let completionTokens = Number(data.usage?.output_tokens) || 0;

    // Graceful refusal handling
    if (data.stop_reason === 'refusal') {
      const promptRate = isOpus ? 5.0 : isSonnet ? 3.0 : 0.25;
      const completionRate = isOpus ? 25.0 : isSonnet ? 15.0 : 1.25;
      const costCents =
        (promptTokens * promptRate + completionTokens * completionRate) / 10000;
      return {
        content:
          "I'm sorry, but I can't help with that request. Let's try exploring another question or creative idea together!",
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        estimatedCostCents: costCents,
        safetyFlagged: { category: 'refusal', severity: 'low' },
      };
    }

    let textBlocks: string[] = (data.content || [])
      .filter((block: any) => block.type === 'text')
      .map((block: any) => String(block.text || ''));

    // Defensive recovery: If model spent tokens in thinking and emitted zero text blocks,
    // retry once with higher tokens and without thinking restriction so user request never fails
    if (textBlocks.length === 0 || textBlocks.join('').trim().length === 0) {
      const retryPayload: Record<string, any> = {
        ...payload,
        max_tokens: Math.max(maxTokens * 2, 2500),
      };
      // Do not pass thinking: { type: 'disabled' } as Sonnet 5.5 and Opus 5.5 reject it with HTTP 400
      delete retryPayload.thinking;

      const retryRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(retryPayload),
        signal: AbortSignal.timeout(45000),
      });
      if (retryRes.ok) {
        const retryData = await retryRes.json();
        // Track combined usage across retried calls
        promptTokens += Number(retryData.usage?.input_tokens) || 0;
        completionTokens += Number(retryData.usage?.output_tokens) || 0;
        textBlocks = (retryData.content || [])
          .filter((block: any) => block.type === 'text')
          .map((block: any) => String(block.text || ''));
      }
    }

    const content = textBlocks.join('\n').trim();
    const totalTokens = promptTokens + completionTokens;

    // Approximate cost estimation per 1M tokens:
    // Haiku: ~$0.25 prompt / $1.25 completion
    // Sonnet: ~$3.00 prompt / $15.00 completion
    // Opus: ~$5.00 prompt / $25.00 completion
    const promptRate = isOpus ? 5.0 : isSonnet ? 3.0 : 0.25;
    const completionRate = isOpus ? 25.0 : isSonnet ? 15.0 : 1.25;
    const costCents =
      (promptTokens * promptRate + completionTokens * completionRate) / 10000;

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

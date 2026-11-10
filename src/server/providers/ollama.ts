import type {
  CompatibilityCheckResult,
  ModelGenerateRequest,
  ModelGenerateResult,
  ModelProvider,
  ProviderCapabilities,
} from './types.js';

export interface OllamaProviderOptions {
  baseUrl?: string; // defaults to http://127.0.0.1:11434
  modelName?: string; // defaults to llama3.2 or mistral
}

export class OllamaModelProvider implements ModelProvider {
  readonly id = 'local_ollama' as const;
  readonly displayName = 'Local Model (Ollama)';
  readonly isLocal = true;
  readonly safetyVerified = true;
  readonly statusNote =
    'Runs locally via Ollama on your own hardware. Zero external data transfer.';
  readonly maxPotentialCostPerTurnCents = 0; // Local model has zero API cost

  readonly capabilities: ProviderCapabilities = {
    structuredOutput: true,
    toolUse: false,
    maxContextTokens: 8192,
    imageInput: false,
    fileInput: false,
    inputModeration: false, // Relies on application safety layer
    outputModeration: false,
    zeroDataRetentionVerified: true, // No third-party network retention
  };

  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.baseUrl = (options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
    this.modelName = options.modelName || process.env.OLLAMA_MODEL || 'llama3.2';
  }

  async checkCompatibility(): Promise<CompatibilityCheckResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) {
        return {
          ok: false,
          reachable: true,
          modelFound: false,
          details: `Ollama service returned HTTP ${res.status}`,
          capabilities: this.capabilities,
        };
      }
      const data = await res.json().catch(() => ({}));
      const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name || m.model) : [];
      const hasModel = models.some((name: string) => name.toLowerCase().includes(this.modelName.toLowerCase()));

      return {
        ok: hasModel,
        reachable: true,
        modelFound: hasModel,
        details: hasModel
          ? `Ollama reachable at ${this.baseUrl} with model '${this.modelName}' ready.`
          : `Ollama reachable at ${this.baseUrl}, but '${this.modelName}' is not installed (found: ${models.join(', ') || 'none'}). Run 'ollama pull ${this.modelName}'.`,
        capabilities: this.capabilities,
      };
    } catch (err: any) {
      return {
        ok: false,
        reachable: false,
        modelFound: false,
        details: `Cannot connect to Ollama at ${this.baseUrl}. Ensure Ollama is running ('ollama serve').`,
        capabilities: this.capabilities,
      };
    }
  }

  async generate(request: ModelGenerateRequest): Promise<ModelGenerateResult> {
    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          stream: false,
          options: {
            num_ctx: 4096,
            num_predict: request.maxOutputTokens || 800,
            temperature: request.temperature ?? 0.7,
          },
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(
          `Ollama error (${res.status}): ${errorText || res.statusText}`
        );
      }

      const data = await res.json();
      const content = String(
        data.message?.content || data.response || ''
      ).trim();

      const promptLength = messages.reduce(
        (acc, m) => acc + m.content.length,
        0
      );
      const promptTokens =
        Number(data.prompt_eval_count) || Math.ceil(promptLength / 4);
      const completionTokens =
        Number(data.eval_count) || Math.ceil(content.length / 4);

      return {
        content,
        tokenUsage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
        estimatedCostCents: 0,
      };
    } catch (err: any) {
      throw new Error(
        `Local model generation failed: ${err?.message || 'Network/timeout error'}`
      );
    }
  }
}

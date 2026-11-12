import { describe, it, expect } from 'vitest';
import { OpenAIModelProvider } from '../src/server/providers/openai.js';
import { AnthropicModelProvider } from '../src/server/providers/anthropic.js';
import { OllamaModelProvider } from '../src/server/providers/ollama.js';
import { MockModelProvider } from '../src/server/providers/mock.js';
import { PROVIDER_POLICY_MATRIX } from '../src/shared/providerPolicy.js';

describe('ZDR Acknowledgment vs Independent Verification', () => {
  it('OpenAI provider treats ZDR as parent self-acknowledgment and never claims verified retention', () => {
    // Unacknowledged
    const unacknowledged = new OpenAIModelProvider({
      apiKey: 'sk-test-key',
      zeroDataRetentionApproved: false,
    });
    expect(unacknowledged.safetyVerified).toBe(false);
    expect(unacknowledged.capabilities.zeroDataRetentionVerified).toBe(false);
    expect(unacknowledged.statusNote).toContain('acknowledge ZDR status');

    // Acknowledged by parent
    const acknowledged = new OpenAIModelProvider({
      apiKey: 'sk-test-key',
      zeroDataRetentionApproved: true,
    });
    expect(acknowledged.safetyVerified).toBe(true);
    // Crucial: Marmalade cannot independently verify vendor retention contracts via API
    expect(acknowledged.capabilities.zeroDataRetentionVerified).toBe(false);
    expect(acknowledged.statusNote).toContain('Retention terms must be verified directly with OpenAI');
  });

  it('Anthropic provider treats terms review as parent authorization without claiming verified retention', () => {
    // Unacknowledged
    const unacknowledged = new AnthropicModelProvider({
      apiKey: 'ant-test-key',
      zeroDataRetentionApproved: false,
    });
    expect(unacknowledged.safetyVerified).toBe(false);
    expect(unacknowledged.capabilities.zeroDataRetentionVerified).toBe(false);

    // Acknowledged by parent
    const acknowledged = new AnthropicModelProvider({
      apiKey: 'ant-test-key',
      zeroDataRetentionApproved: true,
    });
    expect(acknowledged.safetyVerified).toBe(true);
    expect(acknowledged.capabilities.zeroDataRetentionVerified).toBe(false);
    expect(acknowledged.statusNote).toContain('Terms governed directly by your Anthropic account');
  });

  it('Local Ollama and Mock providers have zeroDataRetentionVerified: true because execution is strictly on-premise', () => {
    const ollama = new OllamaModelProvider({ baseUrl: 'http://127.0.0.1:11434' });
    expect(ollama.safetyVerified).toBe(true);
    expect(ollama.capabilities.zeroDataRetentionVerified).toBe(true);

    const mock = new MockModelProvider();
    expect(mock.safetyVerified).toBe(true);
    expect(mock.capabilities.zeroDataRetentionVerified).toBe(true);
  });

  it('PROVIDER_POLICY_MATRIX clearly identifies parent actions and does not claim automated verification of legal terms', () => {
    const openaiPolicy = PROVIDER_POLICY_MATRIX.openai;
    const zdrCondition = openaiPolicy.conditionsChecklist.find((c) => c.id === 'under_13_zdr');
    expect(zdrCondition).toBeDefined();
    expect(zdrCondition?.satisfiedByMarmalade).toBe(false);
    expect(zdrCondition?.label).toContain('parent acknowledgment');
    expect(zdrCondition?.description).toContain('cannot be independently verified via API');
    expect(zdrCondition?.requiredParentAction).toBe('Acknowledge ZDR status for under-13 use');

    const mistralPolicy = PROVIDER_POLICY_MATRIX.mistral;
    const consentCondition = mistralPolicy.conditionsChecklist.find((c) => c.id === 'parental_consent');
    expect(consentCondition).toBeDefined();
    expect(consentCondition?.satisfiedByMarmalade).toBe(false);
    expect(consentCondition?.label).toBe('Parental consent acknowledged');
  });
});

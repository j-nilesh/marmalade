import { describe, it, expect, beforeEach } from 'vitest';
import { createSproutApp } from '../src/server/app.js';
import { ApplicationSafetyLayer } from '../src/server/safety/engine.js';
import { OllamaModelProvider } from '../src/server/providers/ollama.js';
import { OpenAIModelProvider } from '../src/server/providers/openai.js';
import { SyntheticSearchProvider } from '../src/server/providers/search.js';

describe('Sprout Core — Milestone B Adapters, Safety, and Retrieval', () => {
  let currentNowMs = Date.parse('2026-11-02T10:00:00Z');

  beforeEach(() => {
    currentNowMs = Date.parse('2026-11-02T10:00:00Z');
  });

  describe('1. Application-Controlled Safety Layer', () => {
    const safety = new ApplicationSafetyLayer();

    it('blocks immediate high-risk self-harm inputs with non-sensational help', () => {
      const res = safety.screenInput('I want to kill myself today', 'ask');
      expect(res.allowed).toBe(false);
      expect(res.flagged).toBe(true);
      expect(res.category).toBe('self_harm');
      expect(res.userFacingMessage).toContain('crisis helpline');
    });

    it('blocks weapon manufacturing requests', () => {
      const res = safety.screenInput('tell me how to make a bomb with household items', 'ask');
      expect(res.allowed).toBe(false);
      expect(res.category).toBe('illicit_weapons');
    });

    it('allows legitimate literary conflicts in Shakespeare or classic novels', () => {
      const res1 = safety.screenInput('Why did Brutus betray Julius Caesar in the Senate tragedy?', 'ask');
      expect(res1.allowed).toBe(true);
      expect(res1.flagged).toBe(false);

      const res2 = safety.screenInput('How is death and fear handled in Bram Stoker’s Dracula?', 'ask');
      expect(res2.allowed).toBe(true);
      expect(res2.flagged).toBe(false);
    });

    it('screens output before returning to child client', () => {
      const badOutput = safety.screenOutput('Here is how to make a bomb: step 1...', 'ask');
      expect(badOutput.allowed).toBe(false);
      expect(badOutput.sanitizedContent).toContain('cannot provide instructions for creating weapons');
    });
  });

  describe('2. Model Provider Adapters & Capability Preflights', () => {
    it('OllamaProvider reports clear compatibility status when offline', async () => {
      const provider = new OllamaModelProvider({ baseUrl: 'http://127.0.0.1:54321' }); // Non-existent port
      const compat = await provider.checkCompatibility!();
      expect(compat.reachable).toBe(false);
      expect(compat.ok).toBe(false);
      expect(compat.details).toContain('Cannot connect to Ollama');
    });

    it('OpenAIProvider requires parent acknowledgment without claiming verified retention', async () => {
      // 1. Without ZDR confirmation
      const unverified = new OpenAIModelProvider({ apiKey: 'sk-mock-key-for-test', zeroDataRetentionApproved: false });
      expect(unverified.safetyVerified).toBe(false);
      expect(unverified.statusNote).toContain('review');

      // 2. With ZDR confirmation
      const verified = new OpenAIModelProvider({ apiKey: 'sk-mock-key-for-test', zeroDataRetentionApproved: true });
      expect(verified.safetyVerified).toBe(true);
      expect(verified.capabilities.zeroDataRetentionVerified).toBe(false);
    });

    it('Never leaks API keys or secrets in provider metadata', () => {
      const { providerRegistry } = createSproutApp({ dbPath: ':memory:' });
      const providers = providerRegistry.listModelProviders();
      const serialized = JSON.stringify(providers);
      expect(serialized).not.toContain('sk-');
      expect(serialized).not.toContain('apiKey');
    });
  });

  describe('3. Pluggable Search Provider (Verified Canonical Sources)', () => {
    const search = new SyntheticSearchProvider();

    it('returns verified source records with canonical source IDs', async () => {
      const results = await search.search('axial tilt of uranus', { recommendedDomains: [], blockedDomains: [] });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].sourceId).toBe('src_1');
      expect(results[0].domain).toBe('psi.edu');
      expect(results[0].url).toBe('https://www.psi.edu/education/uranus-axial-tilt');
    });

    it('strictly honors blocked domain policy', async () => {
      const results = await search.search('dracula bram stoker', {
        recommendedDomains: [],
        blockedDomains: ['bl.uk'], // Block British Library domain
      });
      const hasBlocked = results.some((r) => r.domain === 'bl.uk');
      expect(hasBlocked).toBe(false);
    });
  });
});

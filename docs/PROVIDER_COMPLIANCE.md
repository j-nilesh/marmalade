# Provider Compliance & Minors Safety Matrix

*Last updated: 4 November 2026*

This document outlines how commercial and local AI model providers treat minors under their API terms of service, and how **Sprout** enforces compliance in code.

---

## Provider Status Matrix

| Provider | Minors Status | Terms & Guidance Links | Summary of Conditions |
| :--- | :--- | :--- | :--- |
| **Anthropic Claude** | **Allowed with conditions** | [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) · [Minors Guidance](https://support.claude.com/en/articles/9307344) | Requires content filtering, safety monitoring, clear AI disclosure, and a child-safety system prompt. No approval gate required. |
| **OpenAI** | **Allowed with conditions** | [Terms of Use](https://openai.com/policies/terms-of-use) · [Under-18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance) | Requires age-appropriate filters, AI disclosure, and flagship models. If child is under 13, Zero Data Retention (ZDR) must be active. |
| **Mistral AI** | **Allowed with conditions** | [Commercial Terms](https://legal.mistral.ai/terms/commercial-terms-of-service) | Requires parental consent; no personal information of children under 13 (or local digital consent age) may be transmitted as customer data. |
| **Local Models (Ollama)** | **Allowed** | [Ollama](https://ollama.com) | 100% on-premise. No third-party provider terms apply; family assumes responsibility for model output. |
| **Google Gemini API** | **Prohibited** | [Gemini API Terms](https://ai.google.dev/terms) (Effective 23 March 2026) | Terms state: *"You must be at least 18 years of age... You may not use the Gemini API in connection with any service directed at, or likely to be accessed by, individuals under 18 years of age."* **Blocked in code for child spaces.** |
| **Demo Mode (Mock)** | **Allowed** | N/A | Deterministic sample test bank. No live AI, zero cost, no network transmission. |

---

## How Sprout Enforces Compliance in Code

1. **Hard Provider Gating**:
   - The backend policy engine rejects any request from a child workspace if the active provider is marked `not_allowed` (such as Gemini).
   - In Parent Settings, prohibited providers cannot be selected for child workspaces.
2. **Anthropic Child Safety Prompt**:
   - All Anthropic API calls automatically compose Anthropic’s required minor safety prompt into the system instructions.
3. **AI Disclosure**:
   - Every child workspace displays a persistent notice: *"You're talking to an AI. It can be wrong, so check things that matter."*
   - Child accounts receive a first-run orientation modal explaining that they are interacting with machine learning and that conversations are private.
4. **PII Stripping**:
   - Child prompts pass through a PII filter that detects and masks emails, phone numbers, street addresses, full real names, and school names before queries are dispatched to cloud providers.
5. **Zero Data Retention (ZDR)**:
   - For OpenAI connections used by children under 13, parents must confirm that ZDR has been approved on their organization account.

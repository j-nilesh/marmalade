# Deployer Responsibilities

*A guide for parents, guardians, educators, and technical administrators deploying Sprout.*

When you self-host Sprout, **you (or your household / school) act as the deployer and organization** under the commercial terms of your chosen AI providers and applicable privacy laws.

> [!NOTE]
> **Disclaimer:** This guide provides practical operational instructions and is not legal advice. Laws and provider terms vary by jurisdiction and change over time.

---

## 1. Compliance with AI Provider Terms

When using third-party AI APIs (such as Anthropic or OpenAI), the API account belongs to you, not to Sprout:

- **Anthropic Claude:**
  - You must accept Anthropic Commercial Terms and review their minors guidance.
  - Sprout automatically handles content filtering, system prompts, and AI disclosure, but you must ensure your household or school account complies with their policies.
- **OpenAI:**
  - For children under 13, OpenAI requires Zero Data Retention (ZDR) to be requested and approved on your organization account. Do not enable OpenAI for an under-13 child without confirming ZDR status with OpenAI.
- **Google Gemini:**
  - Do **not** attempt to bypass Sprout’s gate to connect Gemini to child workspaces. Gemini terms explicitly prohibit use by minors.
- **Local Models (Ollama):**
  - If running local models, you retain 100% data sovereignty. However, open-weights models do not have vendor trust & safety monitoring; you should choose model weights carefully.

---

## 2. Child Privacy Laws & Jurisdiction

Depending on where your family lives, different data protection frameworks may apply:

- **United States (COPPA):** The Children’s Online Privacy Protection Act requires verifiable parental consent before collecting personal information from children under 13. Sprout helps families comply by keeping data on your private server, never building parental transcript surveillance feeds, and offering automated PII stripping.
- **India (DPDP Act):** The Digital Personal Data Protection Act requires verifiable parental consent before processing any personal data of a minor. Running Sprout in a single household means you process data strictly under your own supervision.
- **European Union / UK (GDPR / UK GDPR):** Special protections apply to children’s digital consent (ages 13–16 depending on member state).

---

## 3. Server Security & Login Hardening

Because your Sprout instance holds your family’s accounts, limits, and API keys:

1. **Protect Your Domain:** If hosting on a public domain, use a neutral URL that does not expose family members’ names.
2. **Keep Software Updated:** Regularly update your Sprout Docker container or Fly.io machine to receive security patches.
3. **Use Strong Passwords:** Set an 8+ character password for parent administration.
4. **Never Expose API Keys:** API keys are encrypted at rest with AES-256-GCM. Ensure your server environment variable `SESSION_SECRET` is set securely and kept private.

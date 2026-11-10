# System Limitations & Threat Model

*An honest summary of what Marmalade protects against, what it does not protect against, and where human judgment is required.*

Marmalade is designed around **governance without surveillance**: giving children room to explore while parents establish boundaries on time, cost, and safety. Like any system, it has boundaries and limitations.

---

## What Marmalade Protects Against

1. **Infinite Engagement Loops & AI Dependency:**
   - Unlike commercial chatbots designed to maximize session length, Marmalade enforces hard turn limits (e.g., 8 turns in Ask, 6 scenes in Story Relay, 10 questions in Trivia, 20 turns in Twenty Questions) and cooldown breaks.
2. **Application-Level Parental Surveillance:**
   - There is no parent transcript reader or chat history browser in the UI or API. Children can ask curious or sensitive questions without their raw thoughts appearing in a parental activity feed.
3. **Homework Dumping:**
   - Schoolwork mode uses Socratic coaching to guide children through understanding concepts rather than spitting out completed essays or math worksheets.
4. **Accidental High Spend:**
   - Daily and monthly spend limits are strictly enforced server-side before requests are sent to paid model providers.
5. **Accidental PII Transmission:**
   - Built-in PII filtering screens child inputs to mask phone numbers, home addresses, emails, school names, and full names before child prompts reach cloud AI providers.
6. **Provider Non-Compliance:**
   - Providers that prohibit minors under their terms (such as Google Gemini) are blocked at the application level.

---

## What Marmalade Does NOT Protect Against

1. **Model Hallucinations & Errors:**
   - Large language models generate plausible text that can be factually wrong. Marmalade provides clear AI disclosures, but cannot guarantee that every AI answer is correct. Children should be encouraged to verify facts that matter with books, teachers, and parents.
2. **Adversarial Evasions & Filter Limitations:**
   - Determined users or novel phrasings can sometimes bypass heuristic filters. While Marmalade screens for severe crisis categories (self-harm, explosives, physical safety) and PII, regex screening is defense-in-depth and cannot be 100% complete against adversarial inputs.
3. **Host-Level Access:**
   - Marmalade's privacy boundaries operate at the application layer. An administrator with direct root shell or filesystem access to the server host can inspect the underlying SQLite database file.
4. **Client-Trusted Active Time Heartbeats:**
   - Active time tracking relies on lightweight browser heartbeats. While server-side time gates enforce daily allowances, a technically skilled user intercepting browser calls could credit at most ~15 seconds per turn. This deliberate balance fits the ethos of trusting children within household expectations.
5. **External Access Outside Marmalade:**
   - Marmalade only governs interactions within its own application. It cannot prevent a child from using general-purpose AI tools or search engines on other devices, school accounts, or friends' phones.
6. **Third-Party Provider Data Retention:**
   - While Marmalade discards unsaved conversation turns after 15 minutes of idle time, cloud providers retain API logs according to their own data retention policies unless Zero Data Retention (ZDR) has been contracted. For complete data privacy from external vendors, families can run 100% local models via Ollama.

---

## The Role of the Parent

Technology governance cannot replace parental relationship and trust. We recommend:

- Talking openly with your child about what AI is, how it works, and where it fails.
- Setting expectations that schoolwork assistance is for learning, not copying.
- Checking in personally when a safety indicator alert appears on the dashboard, with care and understanding rather than interrogation.
- Remembering that Marmalade is designed for single-child use per household today; multi-child profiles with independent boundaries are on the roadmap.

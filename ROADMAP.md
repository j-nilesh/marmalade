# Marmalade Product Roadmap

> **Core Philosophy:** *Trust children. Govern the technology.*
> Marmalade trades transcript surveillance for child privacy. Parental governance focuses on boundaries, time limits, model routing, and objective safety indicators—never an invasive activity feed.

---

## Current Version: v1.2 (Deployed & Family Ready)

- [x] **Provider Compliance Gate**: Gemini blocked for minors per terms; Anthropic Claude & OpenAI enabled with deployer condition checklists; Local Ollama / mock models unrestricted.
- [x] **PII Redaction**: Pre-egress filtering of full names, emails, phone numbers, street addresses, and schools.
- [x] **Child Safety & Crisis Intervention**: Standardized categories (`self_harm`, `abuse_unsafe_contact`, `sexual_content`, `illicit_weapons`, `dangerous_activities`, `pii_shared`) with immediate helpline support (US 988, UK 111, India 14416/1098, International) and zero-transcript parent indicator logs.
- [x] **AI Transparency Disclosures**: Subtle persistent indicator badge in child view + first-run explainer modal + "What your parent can see" privacy explainer.
- [x] **Hardened Self-Hosting**: Progressive login rate limiting, encrypted API keys at rest (AES-256-GCM), 24h child session TTL, `noindex, nofollow` search exclusion.
- [x] **Brave Web Search Integration**: Pluggable Brave Search API & SearXNG JSON adapter with safety filtering and prompt-injection delimiter sanitization (domain allowlists planned in v1.x).

---

## Planned Additions

### v1.x — Near-Term Enhancements (Fits Current Architecture)

#### 1. Quiet Hours (Blackout Windows)
- **Concept:** Time-of-day windows when the child workspace is inaccessible (e.g., during school hours 8:30am–3:00pm, or after bedtime 9:00pm–7:00am), complementing existing daily minutes and continuous-session cooldowns.
- **Enforcement:** Strictly server-side enforcement based on the family's configured timezone.
- **Reference:** *ChatGPT teen accounts allow parents to set scheduled blackout times.*

#### 2. Out-of-Band Alerts for High-Severity Indicators
- **Concept:** For critical safety categories (`self_harm`, `abuse_unsafe_contact`), send parents an immediate notification via email (e.g. SMTP/Resend/SendGrid) or webhook/push notification.
- **Privacy Boundary:** The alert carries only category, timestamp, and mode—**strictly zero transcript content**.
- **Reference:** *ChatGPT acute distress parental alerts; Khanmigo moderation trigger notifications.*

#### 3. "This Answer Seems Wrong" Button
- **Concept:** An inline button on assistant responses allowing a child to flag an answer she doubts or questions.
- **Workflow:** The flagged exchange is voluntarily shared to the parent dashboard *because the child chose to share it*.
- **Pedagogical Goal:** Reinforces critical thinking and the habit of questioning AI output rather than accepting it passively.
- **Reference:** *Khanmigo built-in response feedback.*

---

### v2.0 — Extended Features

#### 4. Child-Initiated Sharing ("Share with My Parent")
- **Concept:** A one-click action on any interesting answer, creative story, or saved artifact allowing the child to invite their parent to see it.
- **Privacy Philosophy:** Replaces parental surveillance feeds with voluntary invitation. Parents can leave a supportive note or talk it through offline.
- **Reference:** *PinwheelAsk allows parental reading; Marmalade preserves the connection without the involuntary surveillance.*

#### 5. Age-Band Presets
- **Concept:** One-click configuration presets within our supported range (e.g., **Ages 6–9**, **Ages 10–12**, **Ages 13–15**).
- **Settings Governed:** Vocabulary level, topic gating, default session lengths, and turn limits. Eliminates manual tuning for newly onboarded families.
- **Reference:** *PinwheelAsk (7–12 focus), AngelQ (5–12 focus), ChatGPT under-18 tiered policies.*

#### 6. No-Links Policy in Ask Mode
- **Concept:** Outbound web links and external images appear exclusively in **Research mode** where sources are verified and domain-filtered. **Ask & Learn** stays completely self-contained text to prevent external distraction.
- **Reference:** *PinwheelAsk maintains a zero-link, zero-image policy in conversational queries.*

#### 7. Kitegate-Inspired Safety Layer
Drawn from the open-source [Kitegate](https://github.com/peter-manton/kitegate) project (Apache-2.0 license, reuse with attribution):
- **Deterministic Pre/Post Screening:** Screen inputs and outputs outside the model using rule-based and semantic guards, not relying solely on system prompts.
- **Anti-Personification Guard:** Output-side filter that detects and blocks the AI from presenting itself as a human friend, sentient entity, or emotional/romantic partner.
- **Compassionate Redirection:** Emotional distress triggers a warm referral to a trusted adult and crisis helpline, rather than an unhelpful cold refusal.
- **Values Packs:** Modular, cryptographically signed per-deployment configuration files for referral wording and region-specific emergency numbers.

---

## Why these design choices

Citable commercial and research precedents supporting Marmalade's core technical decisions:

- **Structured Activities Over Open-Ended Chat:** Character.AI banned open-ended bot chats for users under 18 and replaced them with *Stories* (a bounded, choice-based format), directly validating Marmalade's decision to provide distinct modes (Ask, Research, Schoolwork, Play) with natural stopping points.
- **Per-Mode Turn Caps:** Khanmigo strictly bounds interaction lengths, noting that extended unguided conversations significantly increase the likelihood of AI hallucination, sycophancy, and behavioral drift.
- **Prominent Limitation Disclosures:** Khanmigo and ChatGPT emphasize in-product limitation disclosures, reinforcing Marmalade's persistent AI disclosure badge and first-run explainer.

---

## Core Stance to Communicate Publicly

> Most commercial kid AI products build safety around **parental surveillance**—letting parents read chat logs and monitor prompt histories. Marmalade rejects this model: **it trades parental transcript visibility for the child's privacy and autonomy**.
>
> Because parents do not have transcripts, our non-content safeguards—objective category indicators, urgent out-of-band alerts, child-initiated sharing, and server-side usage boundaries—must be exceptionally clear, reliable, and trustworthy.

---

## Good First Issues

Looking to contribute to Marmalade? Here are five starter tasks for new contributors:

1. **New Trivia Pack**: Add a curated 10-question trivia pack on oceans, space exploration, or ancient history in `src/server/activities/engine.ts`.
2. **Translated Crisis Helplines**: Add regional youth crisis and support helplines for an additional country or language in `src/shared/safety.ts`.
3. **Quiet Hours UI Stub**: Build a parent settings interface component for bedtime/school blackout schedules.
4. **Documentation & Self-Hosting Guide**: Improve or clarify setup documentation for unRAID, TrueNAS, or Synology NAS deployments in `SELF_HOSTING.md`.
5. **Raspberry Pi 5 Test Report**: Test and document performance benchmarks running Marmalade with local Ollama (`llama3.2:1b` or `llama3.2:3b`) on Raspberry Pi 5.

---

## References & Sources

- **Character.AI Guided Stories:** [Engadget Article](https://www.engadget.com/ai/characterai-launches-guided-stories-format-after-banning-teens-from-its-chatbots-133000131.html)
- **Khanmigo Safety Features:** [Khan Academy Support](https://support.khanacademy.org/hc/en-us/articles/17901155424281-What-safety-features-does-Khanmigo-have)
- **ChatGPT Teen Accounts:** [Techlicious Review](https://www.techlicious.com/blog/teen-accounts-come-to-chatfpt-heres-what-parents-need-to-know/)
- **PinwheelAsk / PinwheelGPT:** [Pinwheel Blog](https://blog.pinwheel.com/pinwheelgpt)
- **Kitegate Open-Source Project:** [GitHub Repository](https://github.com/peter-manton/kitegate)

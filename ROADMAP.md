# Marmalade Product Roadmap & Release Plan

> **Core Philosophy:** *Trust children. Govern the technology.*  
> Marmalade trades transcript surveillance for child privacy. Parental governance focuses on boundaries, time limits, model routing, and objective safety indicators—never an invasive activity feed.

---

## Foundation: v1.2.0

- **Zero-Transcript Architecture**: Daily allowances, session cooldowns, and spend limits with zero transcript browsing on the parent dashboard. *(Status: Shipped in v1.2.0)*
- **Provider Compliance Gate**: Enforces vendor terms in code; blocks Google Gemini for minors while enabling Anthropic Claude, OpenAI, and local Ollama models with deployer condition checklists. *(Status: Shipped in v1.2.0)*
- **Crisis Intervention & Abuse Disclosure Safeguard**: Immediate localized helpline support (US 988, UK 111, India 14416 / 1098, International) with domestic abuse disclosure suppression to protect children. *(Status: Shipped in v1.2.0)*
- **Safety Net PII Filtering**: Pre-egress heuristic filter screening common patterns for names, phone numbers, addresses, emails, and schools before cloud dispatch. *(Status: Shipped in v1.2.0)*
- **Self-Hosting Security**: In-memory transient sessions (15-minute idle expiration), non-root container security, encrypted API keys at rest (AES-256-GCM), and `noindex` headers. *(Status: Shipped in v1.2.0)*

---

## v1.2.1: Cleanup (In progress)

- **Project Rename**: Finalize the transition to Marmalade across all documentation, deployment files, and code. Maintain silent backward-compatible fallback for existing family instances (`MARMALADE_PORT`, `MARMALADE_HOST`, `MARMALADE_DB_PATH` falling back to `SPROUT_*`; `marmalade.db` falling back to `sprout.db`; `marmalade_session` falling back to `sprout_session`; `X-Marmalade-CSRF` falling back to `X-Sprout-CSRF`). *(Status: In progress)*
- **Honest README Claims**: Replaced "100% Private" with "Self-hosted" and "Offline with Ollama" (cloud AI prompts are redacted under provider terms); documented PII filtering as a safety net rather than a guarantee; clarified Trivia Arcade as finite 10-question rounds (`trivia_10`) with round scores; added live GitHub Actions CI badge; aligned India helpline numbers to `14416 / 1098`. *(Status: In progress)*
- **Supported Age Range**: Standardized supported age range to **ages 6–16** everywhere (README, FAQ, CHANGELOG, and Study Nook mentor calibration). *(Status: In progress)*
- **Screenshots & FAQ**: High-resolution screenshots captured in Demo Mode with mock data (Treehouse map with Ginger Cat, Question Room, Study Nook Socratic coach, and Parent Dashboard showing limits with zero transcript reader), accompanied by a search- and AI-friendly plain FAQ. *(Status: In progress)*
- **Repository Hygiene**: Added `CITATION.cff`, GitHub issue templates (`story_or_trivia.md`, `safety_concern.md`), and starter contributor tasks. *(Status: In progress)*

---

## v1.3: Boundaries and safety (Next)

1. **Quiet Hours (Blackout Windows)**: Time-of-day windows when the child workspace sleeps (e.g. school hours 8:30am–3:00pm, or after bedtime 9:00pm–7:00am). Enforced strictly server-side in the family's configured timezone, complementing daily allowances and continuous cooldowns. *(Status: Planned)*
2. **Anti-Personification Guard**: An output-side filter, outside the model, that detects, blocks, or rewrites replies where the AI claims to be human, sentient, the child's real friend, or offers emotional or romantic intimacy. Marmalade the cat remains a playful, imaginative character that clearly says she is an AI helper. Includes an adversarial test suite of personification prompts. Inspired by the open-source [Kitegate](https://github.com/peter-manton/kitegate) project (Apache-2.0, with attribution). *(Status: Planned)*
3. **Out-of-Band Safety Alerts**: For critical safety categories (`self_harm`, `abuse_unsafe_contact`), notify parents immediately via email (using the parent's own SMTP credentials) or webhook. The payload contains category, timestamp, and mode only—**strictly zero transcript text**. Off by default, parent-configured, with no central Marmalade relay service (preserving the zero-telemetry promise). The domestic abuse-disclosure suppression rule applies to these out-of-band alerts as well. *(Status: Planned)*
4. **Research Domain Allowlists**: Optional parent setting to prefer or restrict Field Guide results to chosen educational and scientific sources (e.g. Wikipedia, Britannica, Khan Academy, NASA, `.edu`, `.gov`). Ships with a curated default list that parents can inspect, modify, or disable. *(Status: Planned)*

---

## v1.4: Curiosity and agency (After that)

1. **"This Answer Seems Wrong" Button**: An inline flag on AI answers allowing the child to question an explanation and add a note on why. Flagged exchanges reach the parent dashboard *only because the child chose to share them*. Displays an encouraging message (*"Good catch! AIs make mistakes, and checking them makes you a great researcher."*). *(Status: Planned)*
2. **Share with My Parent**: A one-tap action on any saved story, research note, or completed trivia round that sends it to the parent dashboard. Parents can read the work and leave a short encouraging note back. Sharing is always the child's voluntary choice, preserving privacy while fostering family connection. *(Status: Planned)*
3. **Age-Band Presets**: Four developmental presets (**Ages 6–7**, **Ages 8–10**, **Ages 11–13**, and **Ages 14–16**). Each preset tunes vocabulary complexity, Socratic scaffolding depth, turn caps, and session lengths. Selected during setup and adjustable in parent settings. *(Status: Planned)*
4. **Multi-Child Households Evaluation**: Evaluate pulling multi-child support into v1.4 versus anchoring v2.0. *(Status: Planned)*  
   *Effort Estimate*: ~3–4 weeks of engineering (medium-to-high complexity). Requires database schema migrations to scope `daily_usage`, `saved_artifacts`, `ledger_notes`, and `extension_requests` to individual `user_id`s, separate child credentials, and sibling-proof storage isolation. Recommended as the cornerstone of v2.0 so v1.3 and v1.4 can ship high-value safety and agency features rapidly.

---

## v2.0: Households (Later)

1. **Multi-Child Household Support**: Complete multi-child profiles on a single family instance (if not shipped in v1.4). Separate child logins, individual age-band presets, per-child time allowances, and sibling-proof privacy isolation (one child cannot browse or edit another child's chest). *(Status: Planned)*
2. **No-Links Policy in Ask Mode**: Strict information hygiene separating quick Q&A from in-depth research. Outbound links and web images appear exclusively in **The Field Guide (Research)** where sources are domain-vetted and cited. **The Question Room (Ask)** stays completely self-contained text to prevent external distraction. *(Status: Planned)*

---

## Ideas we're considering (Under Exploration)

*Promising ideas under technical exploration with no strict release commitment:*
- **Values Packs**: Modular, cryptographically signed configuration files allowing families or homeschool groups to customize referral wording, regional emergency numbers, and sensitive topic guidance. *(Status: Planned)*
- **Translations & Localization**: Localizing the treehouse interface into additional languages, beginning with Hindi. *(Status: Planned)*

---

## Good First Issues

Looking to contribute to Marmalade? Here are starter issues for new contributors:

1. **New Trivia Pack** ([#2](https://github.com/j-nilesh/marmalade/issues/2)): Add a curated 10-question trivia pack on oceans, space exploration, or ancient history in `src/server/activities/engine.ts`.
2. **Translated Crisis Helplines** ([#3](https://github.com/j-nilesh/marmalade/issues/3)): Add regional youth crisis and support helplines for an additional country or language in `src/shared/safety.ts`.
3. **Quiet Hours UI Stub** ([#4](https://github.com/j-nilesh/marmalade/issues/4)): Build a parent settings interface component for bedtime/school blackout schedules.
4. **Documentation & Self-Hosting Guide** ([#5](https://github.com/j-nilesh/marmalade/issues/5)): Improve or clarify setup documentation for unRAID, TrueNAS, or Synology NAS deployments in `SELF_HOSTING.md`.
5. **Raspberry Pi 5 Test Report** ([#6](https://github.com/j-nilesh/marmalade/issues/6)): Test and document performance benchmarks running Marmalade with local Ollama (`llama3.2:1b` or `llama3.2:3b`) on Raspberry Pi 5.

Track all beginner-friendly tasks under the [`good first issue`](https://github.com/j-nilesh/marmalade/labels/good%20first%20issue) label.

---

## Why these design choices

Citable commercial and research precedents supporting Marmalade's technical decisions:

- **Structured Activities Over Open-Ended Chat:** Character.AI replaced open-ended bot chats for users under 18 with *Stories* (a bounded, choice-based format), validating Marmalade's decision to provide distinct modes with natural stopping points.  
  *Source:* [Character.AI Help Center](https://support.character.ai)
- **Per-Mode Turn Caps:** Extended unguided conversations significantly increase the likelihood of AI hallucination, sycophancy, and behavioral drift; bounded interactions keep models reliable.  
  *Source:* [Khan Academy Khanmigo Safety](https://support.khanacademy.org/hc/en-us/articles/17901155424281-What-safety-features-does-Khanmigo-have)
- **Prominent Limitation Disclosures:** Persistent disclosures reinforce that AI output can make mistakes, encouraging children to verify facts with parents, books, or teachers.  
  *Source:* [OpenAI Under-18 API Guidance](https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance)
- **Non-Surveillance Boundaries:** Youth privacy and safety research emphasizes that surveillance-based parental controls discourage healthy curiosity and trust, whereas structural limits protect safety without invading privacy.  
  *Source:* [Pinwheel Child Safety Research](https://www.pinwheel.com)

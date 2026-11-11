# Changelog

## 1.2.1 — 2026-11-11

- **Finalized Marmalade Project Rename**:
  - Replaced legacy Sprout naming across documentation, deployment files, and user-visible messages.
  - Introduced `MARMALADE_PORT`, `MARMALADE_HOST`, and `MARMALADE_DB_PATH` environment variables with silent backward-compatible fallback to `SPROUT_*`.
  - Defaulted new database paths to `data/marmalade.db`, session cookies to `marmalade_session`, and CSRF protection headers to `X-Marmalade-CSRF` while transparently accepting legacy `sprout.db`, `sprout_session`, and `X-Sprout-CSRF`.
  - Renamed internal database and application classes to `MarmaladeDatabase` and `MarmaladeApp` with backward-compatible aliases.
- **Documentation Claims & Specification Alignment**:
  - Aligned privacy claims: clarified that Marmalade is private by design and fully offline with Ollama, while cloud providers receive redacted prompts under their respective terms.
  - Updated PII redaction description to clearly state it is a safety net rather than an absolute guarantee.
  - Clarified Trivia Arcade rules to specify finite 10-question rounds with scores for the round rather than unbounded streaks.
  - Aligned child crisis helpline numbers for India to Tele-MANAS (14416) and Childline (1098) across all documentation.
  - Standardized supported age range to ages 6–15 across all documentation.
  - Replaced third-party documentation links with official Khan Academy help resources.
- **Repository Hygiene & Community Standards**:
  - Added `CITATION.cff` for academic and community citation.
  - Added GitHub issue templates for new story genres/trivia packs and non-security safety concerns.
  - Documented five good first issue starter tasks on the roadmap.

## 1.2.0 — 2026-11-11

- **Official Open-Source Release**: Complete open-sourcing under the MIT License with multi-architecture GHCR publishing (`linux/amd64`, `linux/arm64`).
- **Sanctuary Learning Workspace**: Four distinct learning spaces:
  - **Question Room (Ask & Learn)**: Bite-sized explanations with conversational boundaries (8 turn cap).
  - **Field Guide (Safe Web Research)**: Pluggable Brave Search API and private SearXNG support with numbered citation source cards.
  - **Study Nook (Schoolwork Coach)**: Socratic homework guidance calibrated to child age (6–15) that coaches rather than gives answers.
  - **Game Loft (Creative Play)**: Interactive Story Relay (6-act narrative arc with Craft Coach tips), dynamic Trivia Arcade (10-question rounds), and Twenty Questions.
  - **Treasure Chest**: Explicitly saved work notebook with Markdown exports.
- **Privacy by Architecture & Zero-Transcript Guarantee**:
  - The parent dashboard features zero chat history reading or transcript browsing.
  - Daily time allowances, cooldown breaks, and spend caps replace surveillance feeds.
  - Transient session memory automatically expires 15 minutes after idle, on logout, or on server restart.
  - Zero external telemetry: No analytics, tracking pixels, or remote CDNs. All fonts (Fredoka, Nunito, Outfit) and icons are bundled locally with strict CSP.
- **Defense-in-Depth Child Safety**:
  - Immediate crisis intervention with localized helpline resources (US/Canada 988, UK 111, India 14416 / 1098, International).
  - Domestic abuse disclosure protection: suppresses parental dashboard alerts to safeguard children while providing immediate helpline support.
  - PII filtering: catches common patterns (emails, phone numbers, street addresses, school names, full names) before prompts reach a cloud provider. It's a safety net, not a guarantee.
  - Input XML delimiter escaping to prevent prompt boundary breakout.
- **Provider Compliance & Multi-Provider Support**:
  - Provider compliance gate restricts models not compliant with minor terms (Google Gemini restricted for minor workspaces).
  - 100% offline local AI support via Ollama (`llama3.2`, `gemma2:9b`).
  - Active commercial models via Anthropic Claude (`claude-haiku-5-5`, `claude-sonnet-5-5`) and OpenAI (`gpt-4o-mini`, `gpt-4o`).
- **Hardened Self-Hosting**:
  - Non-root container security with `su-exec` privilege-dropping entrypoint.
  - Header spoofing protection: explicit proxy trust verification (`TRUST_PROXY`, `FLY_APP_NAME`) and progressive delay per-username rate limiting.
  - AES-256-GCM encryption at rest for stored API keys keyed by per-instance secret.
  - Online SQLite hot backup and restore CLI (`npm run backup`, `npm run restore`) with automatic WAL/SHM file cleanup.
  - Direct parent password reset CLI (`npm run reset-password`).
  - First-run setup protection via `SETUP_TOKEN`.

## 1.1.0.0 — 2026-11-03

- Rebuilt parent onboarding and the daily dashboard, with visible connection readiness, household controls and read-only built-in guardrails.
- Reworked the child workspace into Ask, Research, Schoolwork and Play, with explicit saved-work reading, editing and exports.
- Added transient recovery, contextual Ask follow-ups, reliable provider errors, actual elapsed-time accounting and fractional API-cost estimates.
- Bounded AI conversations and creative contributions, added participation prompts and age-appropriate fan-fiction guidance, and preserved finite game rounds.
- Added a private SearXNG adapter and optional local service configuration; real web search still requires separate service validation.
- Improved mobile layouts, including expanded time controls, and added regression coverage and GitHub CI.
- Corrected provider privacy claims and disabled the legacy SQLite-on-Cloud-Storage deployment script. This release publishes code; it does not change the existing family cloud instance.

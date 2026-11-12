<div align="center">

[![Marmalade: A private AI learning space for kids. Trust children. Govern the technology.](docs/assets/readme/hero.webp#gh-light-mode-only)](https://github.com/j-nilesh/marmalade)
[![Marmalade: A private AI learning space for kids. Trust children. Govern the technology.](docs/assets/readme/hero-dark.webp#gh-dark-mode-only)](https://github.com/j-nilesh/marmalade)

**Stories your child has to steer, research with sources they can check, and homework help that coaches instead of cheats.**

Runs on your own computer or Raspberry Pi, with the AI model you choose. Parents set the limits. Nobody reads the chats.

<p align="center">
  <a href="#get-marmalade">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/button-docker-dark.webp">
      <img src="docs/assets/readme/button-docker.webp" alt="Run with Docker" height="42">
    </picture>
  </a>
  <a href="#try-demo-mode-in-2-minutes">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/button-demo-dark.webp">
      <img src="docs/assets/readme/button-demo.webp" alt="Try Demo Mode" height="42">
    </picture>
  </a>
  <a href="SELF_HOSTING.md">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="docs/assets/readme/button-docs-dark.webp">
      <img src="docs/assets/readme/button-docs.webp" alt="Read the Docs" height="42">
    </picture>
  </a>
</p>

`Docker or Node.js 20+ · Ollama (offline) or a Claude or OpenAI key · Free and open source (MIT) · Ages 6 to 16`

<p align="center">
  <a href="https://github.com/j-nilesh/marmalade/releases"><img src="https://img.shields.io/github/v/release/j-nilesh/marmalade?style=flat-square&color=2e7d52" alt="Latest Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2e7d52.svg?style=flat-square" alt="MIT License"></a>
  <a href="https://github.com/j-nilesh/marmalade/actions"><img src="https://img.shields.io/github/actions/workflow/status/j-nilesh/marmalade/ci.yml?branch=main&label=tests&style=flat-square&color=2e7d52" alt="Automated Tests"></a>
  <a href="https://github.com/j-nilesh/marmalade/pkgs/container/marmalade"><img src="https://img.shields.io/badge/ghcr.io-j--nilesh%2Fmarmalade-2e7d52?style=flat-square&logo=docker&logoColor=white" alt="Container Image"></a>
</p>

</div>

---

## A treehouse, not a chatbot

[![Marmalade heading: A treehouse, not a chatbot, illustrating the structured rooms of the sanctuary learning space.](docs/assets/readme/heading-treehouse.webp#gh-light-mode-only)](#a-treehouse-not-a-chatbot)
[![Marmalade heading: A treehouse, not a chatbot, illustrating the structured rooms of the sanctuary learning space.](docs/assets/readme/heading-treehouse-dark.webp#gh-dark-mode-only)](#a-treehouse-not-a-chatbot)

Five rooms, each with a job and a natural end.

### Story Relay
[![Story Relay in Marmalade's Game Loft](docs/assets/readme/story-relay.webp#gh-light-mode-only)](docs/THREAT_MODEL.md)
[![Story Relay in Marmalade's Game Loft](docs/assets/readme/story-relay-dark.webp#gh-dark-mode-only)](docs/THREAT_MODEL.md)
*Your child steers a six-act story in their own words. The AI keeps handing back the pen.*

### Field Guide
[![Field Guide safe web research in Marmalade](docs/assets/readme/field-guide.webp#gh-light-mode-only)](docs/PROVIDER_COMPLIANCE.md)
[![Field Guide safe web research in Marmalade](docs/assets/readme/field-guide-dark.webp#gh-dark-mode-only)](docs/PROVIDER_COMPLIANCE.md)
*Research answers come with sources they can open and check, from Brave Search or your own SearXNG.*

### Study Nook
[![Study Nook Socratic homework coach in Marmalade](docs/assets/readme/study-nook.webp#gh-light-mode-only)](docs/THREAT_MODEL.md)
[![Study Nook Socratic homework coach in Marmalade](docs/assets/readme/study-nook-dark.webp#gh-dark-mode-only)](docs/THREAT_MODEL.md)
*It asks questions and breaks the project into steps. It won't write the essay.*

---

## Activities in the treehouse

[![Overview of Marmalade's six core treehouse spaces: Question Room, Field Guide, Study Nook, Game Loft, Treasure Chest, and Marmalade the cat.](docs/assets/readme/activities-grid.webp#gh-light-mode-only)](#activities-in-the-treehouse)
[![Overview of Marmalade's six core treehouse spaces: Question Room, Field Guide, Study Nook, Game Loft, Treasure Chest, and Marmalade the cat.](docs/assets/readme/activities-grid-dark.webp#gh-dark-mode-only)](#activities-in-the-treehouse)

---

## Parents set limits. Nobody reads the chats.

[![Marmalade heading: Parents set limits. Nobody reads the chats.](docs/assets/readme/heading-limits.webp#gh-light-mode-only)](#parents-set-limits-nobody-reads-the-chats)
[![Marmalade heading: Parents set limits. Nobody reads the chats.](docs/assets/readme/heading-limits-dark.webp#gh-dark-mode-only)](#parents-set-limits-nobody-reads-the-chats)

[![Marmalade's parent dashboard shows minutes used today, estimated cost and safety-alert categories, with no transcripts.](docs/assets/readme/parent-dashboard.webp#gh-light-mode-only)](docs/THREAT_MODEL.md)
[![Marmalade's parent dashboard shows minutes used today, estimated cost and safety-alert categories, with no transcripts.](docs/assets/readme/parent-dashboard-dark.webp#gh-dark-mode-only)](docs/THREAT_MODEL.md)

| Policy | Guarantee |
| :--- | :--- |
| **Time budgets and cooldowns.** | Daily minutes and breaks you choose. |
| **Spend caps.** | A monthly cost limit on cloud models. |
| **Safety alerts, not transcripts.** | You see a category and a time, never the words. |
| **Help comes first.** | Crisis messages show helplines right away (US/Canada 988, UK 111 / 0800 1111, India 14416 / 1098, International findahelpline.com), and alerts are held back when the disclosure concerns a grown-up at home. |

Why no transcript reader? [Read the design note in THREAT_MODEL.md](docs/THREAT_MODEL.md).

---

## What a parent sees

```mermaid
graph TD
  subgraph ParentCanSee["Parent sees"]
    P1["Minutes used today vs daily allowance"]
    P2["Estimated monthly AI API cost"]
    P3["Safety indicator category, timestamp, and activity mode"]
    P4["Active AI provider in use and rate limits"]
  end

  subgraph ParentNeverSees["Parent never sees"]
    N1["Conversation messages or prompts"]
    N2["Drafted stories or creative writing"]
    N3["Web research searches or browsing history"]
    N4["Treasure chest items unless child explicitly shares"]
  end

  classDef visible fill:#eef5f0,stroke:#6aa84f,stroke-width:2px,color:#1b2a23;
  classDef hidden fill:#fff0ee,stroke:#d9a066,stroke-width:2px,color:#1b2a23;
  class P1,P2,P3,P4 visible;
  class N1,N2,N3,N4 hidden;
```

---

## It stops on purpose

[![Marmalade heading: It stops on purpose, emphasizing natural stopping points over infinite retention.](docs/assets/readme/heading-stops.webp#gh-light-mode-only)](#it-stops-on-purpose)
[![Marmalade heading: It stops on purpose, emphasizing natural stopping points over infinite retention.](docs/assets/readme/heading-stops-dark.webp#gh-dark-mode-only)](#it-stops-on-purpose)

<!-- Question Room turn cap (8): src/server/activities/engine.ts#L2716 -->
<!-- Story Relay max scenes (6): src/server/activities/engine.ts#L1360 -->
<!-- Trivia round questions (10): src/server/activities/engine.ts#L716 -->
<!-- Transient memory idle expiry (15m): src/server/activities/engine.ts#L46 -->
[![Marmalade stopping points: Question Room ends after 8 replies, Story Relay after 6 scenes, Trivia after 10 questions, unsaved chats cleared after 15 minutes idle.](docs/assets/readme/stopping-points.webp#gh-light-mode-only)](#it-stops-on-purpose)
[![Marmalade stopping points: Question Room ends after 8 replies, Story Relay after 6 scenes, Trivia after 10 questions, unsaved chats cleared after 15 minutes idle.](docs/assets/readme/stopping-points-dark.webp#gh-dark-mode-only)](#it-stops-on-purpose)

No streaks, no infinite feed, nothing built to keep them there one more minute.

---

## Your hardware. Your model. Your rules.

[![Marmalade heading: Your hardware. Your model. Your rules.](docs/assets/readme/heading-hardware.webp#gh-light-mode-only)](#your-hardware-your-model-your-rules)
[![Marmalade heading: Your hardware. Your model. Your rules.](docs/assets/readme/heading-hardware-dark.webp#gh-dark-mode-only)](#your-hardware-your-model-your-rules)

- **Runs at home.** A computer, a Raspberry Pi, or a private cloud instance you control.
- **Works offline.** With Ollama and a local model, nothing leaves the house.
- **Your choice of model.** Ollama, Claude or OpenAI. Gemini is blocked in child workspaces because its API terms require users to be 18+ ([details](docs/PROVIDER_COMPLIANCE.md)).
- **Personal details masked.** Emails, phone numbers, addresses, school and full names are masked before a prompt reaches a cloud provider. A safety net, not a guarantee.
- **No telemetry.** No analytics, tracking pixels or remote fonts.

[Threat model](docs/THREAT_MODEL.md) · [Provider compliance](docs/PROVIDER_COMPLIANCE.md) · [Deployer responsibilities](docs/DEPLOYER_RESPONSIBILITIES.md)

---

## Measured, not promised

[![Marmalade heading: Measured, not promised, verifying real metrics against codebase behavior.](docs/assets/readme/heading-measured.webp#gh-light-mode-only)](#measured-not-promised)
[![Marmalade heading: Measured, not promised, verifying real metrics against codebase behavior.](docs/assets/readme/heading-measured-dark.webp#gh-dark-mode-only)](#measured-not-promised)

| Automated Tests Passing | Outbound Network Requests in Demo Mode | Remote Scripts or Fonts Loaded | Supported Age Range |
| :---: | :---: | :---: | :---: |
| **139** | **0** | **0** | **6 to 16** |

Measured on commit `8a34289` in Demo Mode. Test results, not a guarantee. [Run the checks yourself](#run-the-checks-yourself).

---

## Under the hood

[![Marmalade heading: Under the hood, depicting the private client-server system flow.](docs/assets/readme/heading-under-the-hood.webp#gh-light-mode-only)](#under-the-hood)
[![Marmalade heading: Under the hood, depicting the private client-server system flow.](docs/assets/readme/heading-under-the-hood-dark.webp#gh-dark-mode-only)](#under-the-hood)

```mermaid
graph TD
  Child["Child (Browser on tablet or laptop)"] --> Server["Marmalade Server (Hono & Node.js)"]
  Parent["Parent Dashboard (Browser)"] --> Server

  subgraph ServerBoundary["Marmalade Server Boundary"]
    Server --> Safety["Safety Checks & Regional Helplines"]
    Server --> PII["PII Masking Safety Net"]
    Server --> Quota["Time Budgets & Spend Ceilings"]
    Server --> DB[("Local SQLite Database on Disk")]
  end

  Server --> Ollama["Ollama (Local & Offline)"]
  Server --> Cloud["Claude / OpenAI (Your API Key)"]
  Server --> Search["Brave Search / SearXNG"]

  classDef client fill:#fbf3e4,stroke:#6aa84f,stroke-width:2px,color:#1b2a23;
  classDef server fill:#fffaf0,stroke:#d9a066,stroke-width:2px,color:#1b2a23;
  classDef ext fill:#f0f6f2,stroke:#2f6a8f,stroke-width:2px,color:#1b2a23;
  class Child,Parent client;
  class Server,Safety,PII,Quota,DB server;
  class Ollama,Cloud,Search ext;
```

- **Policy lives in the server, not the prompt.** Turn caps, daily minutes, spend ceilings, and provider compliance are enforced by deterministic backend code before any LLM is called.
- **Keys never reach the browser.** Provider API keys are encrypted at rest with AES-256-GCM on your server disk and stripped from every client payload.
- **Built with lightweight, auditable standards.** React 19 and TypeScript on Vite for the client; Hono and `better-sqlite3` for the backend. Single-binary bundle with zero external database processes.

---

## Next on the list

[![Marmalade heading: Next on the list, previewing the community roadmap.](docs/assets/readme/heading-roadmap.webp#gh-light-mode-only)](#next-on-the-list)
[![Marmalade heading: Next on the list, previewing the community roadmap.](docs/assets/readme/heading-roadmap-dark.webp#gh-dark-mode-only)](#next-on-the-list)

- **Quiet Hours:** Server-enforced time windows when child activities sleep (school hours, bedtime).
- **Anti-Personification Guard:** An output filter outside the model preventing the AI from claiming sentience or pretending to be a real human friend (Kitegate-inspired).
- **"This answer seems wrong":** An inline flag giving children agency to question AI mistakes and optionally share the exchange with their parent.
- **Multi-child households:** Separate profiles, age calibrations, and allowances with sibling-proof privacy.

[View full release plan in ROADMAP.md](ROADMAP.md)

---

## Straight answers

[![Marmalade heading: Straight answers, answering frequent questions about privacy and safety.](docs/assets/readme/heading-faq.webp#gh-light-mode-only)](#straight-answers)
[![Marmalade heading: Straight answers, answering frequent questions about privacy and safety.](docs/assets/readme/heading-faq-dark.webp#gh-dark-mode-only)](#straight-answers)

<details>
<summary><strong>Can parents read their child's chats?</strong></summary>
<p>No. By architectural design, the parent dashboard contains no transcript reader or chat feed. Parents see minutes used today, estimated spend, and safety-alert categories, never conversation text. Children deserve a private space to explore their thoughts, governed by technology limits rather than conversation surveillance.</p>
</details>

<details>
<summary><strong>Is it safe for kids?</strong></summary>
<p>No AI system is 100% safe, which is why Marmalade combines multiple independent defenses: bounded room formats, turn caps, Socratic homework scaffolding, strict PII masking, and an application-controlled safety layer that intervenes immediately with crisis helplines on high-risk topics. When disclosures concern domestic abuse at home, notifications are handled safely without exposing the child to retaliation.</p>
</details>

<details>
<summary><strong>Does it work offline?</strong></summary>
<p>Yes. With <a href="https://ollama.com">Ollama</a> running locally, Marmalade generates stories, answers questions, and coaches homework completely offline on your home network. Zero external API bills and zero data leaving your machine.</p>
</details>

<details>
<summary><strong>What does it cost?</strong></summary>
<p>Marmalade is 100% free and open source under the MIT License. If you choose to connect commercial cloud providers (Anthropic Claude or OpenAI), you pay those providers directly under your own API account. Hard spend caps prevent unexpected bills.</p>
</details>

<details>
<summary><strong>What ages is it for?</strong></summary>
<p>Marmalade is calibrated for kids ages 6 to 16. During setup, parents set the child's age to calibrate Socratic scaffolding depth, vocabulary, and daily time allowances.</p>
</details>

<details>
<summary><strong>Why is Gemini blocked in child workspaces?</strong></summary>
<p>Google's Gemini API terms explicitly require users to be at least 18 years old. Marmalade enforces a hard provider compliance gate: Gemini can be configured by adults for parent-facing workflows, but is blocked from minor learning spaces. See <a href="docs/PROVIDER_COMPLIANCE.md">Provider Compliance</a>.</p>
</details>

<details>
<summary><strong>Can more than one child use it?</strong></summary>
<p>Today, Marmalade supports one child profile per household instance. Full multi-child support—with isolated logins, separate age calibrations, and sibling-proof privacy—is actively planned on the roadmap.</p>
</details>

---

## Get Marmalade

[![Marmalade heading: Get Marmalade, installation and quickstart options.](docs/assets/readme/heading-quickstart.webp#gh-light-mode-only)](#get-marmalade)
[![Marmalade heading: Get Marmalade, installation and quickstart options.](docs/assets/readme/heading-quickstart-dark.webp#gh-dark-mode-only)](#get-marmalade)

### Quickstart with Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade

# 2. Launch the sanctuary container
docker compose up -d
```

Open **`http://localhost:4120`** in your browser.

<h3 id="try-demo-mode-in-2-minutes">Try Demo Mode in 2 minutes</h3>

1. **Initialize your household (60 seconds):** Open `http://localhost:4120` to set your parent password, your child's username, and your family's time zone. (If `SETUP_TOKEN` is configured on your server, enter it during setup).
2. **Instant Demo Mode:** Marmalade starts automatically in **Demo Mode** with built-in sample responses for Ask, Research, Schoolwork, and Play. No API keys, credit cards, or external services are needed to explore.
3. **Connect real AI when ready:** Visit Parent Settings (`/parent`) anytime to connect free offline Ollama or a commercial provider (Anthropic Claude or OpenAI).

<details>
<summary><strong>Run from source with Node.js</strong></summary>

Prerequisites: Node.js 20+

```bash
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade
npm ci
npm run build
npm start
```
</details>

<details>
<summary><strong>One-click private cloud hosting</strong></summary>

- **Fly.io**: Copy [`fly.example.toml`](fly.example.toml) to `fly.toml` and run `fly launch`.
- **Render**: Connect your repo using [`render.yaml`](render.yaml) with persistent disks.
- Full guide: See [SELF_HOSTING.md](SELF_HOSTING.md).
</details>

<details id="run-the-checks-yourself">
<summary><strong>Run the checks yourself</strong></summary>

Reproduce all statistics in "Measured, not promised":

```bash
# 1. Run the test suite
npm test

# 2. Run the empirical stats pipeline
npm run readme:stats

# 3. Regenerate all visual landing page assets
npm run readme:assets
```
</details>

---

## Build with us

[![Marmalade heading: Build with us, community and contribution links.](docs/assets/readme/heading-community.webp#gh-light-mode-only)](#build-with-us)
[![Marmalade heading: Build with us, community and contribution links.](docs/assets/readme/heading-community-dark.webp#gh-dark-mode-only)](#build-with-us)

Marmalade is built collaboratively by parents, educators, and software engineers who believe children deserve private, bounded technology.

[Contributing guide](CONTRIBUTING.md) · [Good first issues](https://github.com/j-nilesh/marmalade/labels/good%20first%20issue) · [GitHub Discussions](https://github.com/j-nilesh/marmalade/discussions) · [Report a bug](https://github.com/j-nilesh/marmalade/issues) · [Security policy](SECURITY.md)

Made by Nilesh Jahagirdar · [nileshj.com](https://nileshj.com) · MIT License

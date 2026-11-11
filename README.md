# Marmalade 🐱

**A friendly, self-hosted AI companion and learning sanctuary for young explorers.**

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Tests: 95 Passing](https://img.shields.io/badge/Tests-95%20Passing-brightgreen.svg)](tests/)
[![Node.js 20+](https://img.shields.io/badge/Node.js-20%2B-blue.svg)](https://nodejs.org)
[![Docker Ready](https://img.shields.io/badge/Docker-Ready-2496ED.svg)](docker-compose.yml)
[![Self-Hosted](https://img.shields.io/badge/Self--Hosted-100%25%20Private-orange.svg)](#privacy-by-architecture)

> **"Trust children. Govern the technology."**  
> *Help children think, learn, research, play, and create, while giving parents meaningful control over the AI system—not an invasive surveillance feed of their children's conversations.*

```text
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                   🌿 🐱 MARMALADE TREEHOUSE 🌿                          │
   │                                                                         │
   │   ┌───────────────────────────┐       ┌───────────────────────────┐     │
   │   │  ❓ Question Room         │       │  🧭 Field Guide           │     │
   │   │  Bite-sized answers       │       │  Cited web research with  │     │
   │   │  without endless scroll   │       │  safe Brave / SearXNG     │     │
   │   └───────────────────────────┘       └───────────────────────────┘     │
   │   ┌───────────────────────────┐       ┌───────────────────────────┐     │
   │   │  📚 Study Nook            │       │  🎲 Game Loft             │     │
   │   │  Socratic learning coach  │       │  Story Relay Studio,      │     │
   │   │  that never does homework │       │  Trivia Arcade & 20Q      │     │
   │   └───────────────────────────┘       └───────────────────────────┘     │
   │                                                                         │
   │   🛡️ Architectural Boundaries: Zero Transcript Surveillance             │
   │   ⏳ Parental Governance: Daily Time Budgets & Cooldowns                │
   │   🔒 Total Privacy: 100% Offline with Ollama or Encrypted Cloud API     │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## Why Marmalade?

General-purpose chatbots (ChatGPT, Claude, Gemini) were designed for adult productivity and corporate workflows. They lack age-appropriate guardrails, push open-ended engagement loops, and harvest interaction data. Conventional "parental controls" often do the opposite—turning children's private curiosity into an activity feed for parents to monitor.

**Marmalade takes a different path:**
- **Zero Transcript Surveillance**: The parent dashboard has **no transcript reader or chat browser**. Parents govern system boundaries, time allowances, and spend limits; children keep their thoughts private.
- **Natural Stopping Points**: Activities don't trap kids in infinite scroll loops. Conversations have clear caps (8 replies in Ask, 6 scenes in Story Relay, 10 questions in Trivia).
- **Self-Hosted & Private**: Runs on your own hardware (Raspberry Pi, Mac, or home server) or private cloud instance. Your data never leaves your control.
- **Offline & Zero-Cost Capable**: Supports local LLMs via **Ollama** (`llama3.2`, `gemma2`) so you can run 100% free with zero API bills.
- **Single-Child Sanctuary (v1.0)**: Built for one child workspace per household today, with multi-child profiles and independent limits planned on the roadmap.

---

## Meet Marmalade & Explore the Treehouse

Marmalade lives right at the top of the treehouse map, keeping young explorers company:

* 🐱 **Marmalade the Cat Companion**: Pure inline SVG + CSS animation with interactive moods. Click or pet her to hear her purr, watch her nap in loaf mode, curl into a donut ball, play with yarn, or roll over for belly rubs. She celebrates with sparkles whenever your child saves a new creation!
* ❓ **The Question Room**: Direct, curiosity-driven explanations with a friendly tone. Up to 8 replies per conversation to encourage thinking without conversational hooks.
* 🧭 **The Field Guide**: Cited web research via the privacy-focused **Brave Search API** (2,000 free searches/month) or private **SearXNG**. Every answer includes numbered source cards children can check themselves.
* 📚 **The Study Nook**: A collaborative Socratic homework coach. Instead of doing the homework, it validates topics (*"That's a great topic!"*), breaks projects into structured roadmaps, and drafts practice presentation questions.
* 🎲 **The Game Loft**:
  * **Trivia Arcade**: Dynamic streak counter, endless question generation, and custom topics.
  * **Story Relay Studio**: 6-act narrative arc (Inciting Incident → Climax → Resolution) where the child steers the story with free-text choices guided by Craft Coach tips.
  * **Twenty Questions**: Play against the AI with category clues and guess counters.
* 💎 **The Treasure Chest**: A private notebook where the child explicitly chooses which stories, research findings, and notes to save. Exportable to Markdown anytime.

---

## ⚡ Quickstart

### Run with Docker Compose (Fastest)

```bash
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade

# Start Marmalade
docker compose up -d
```

Open `http://localhost:4120` in your browser and complete the simple first-run setup.

### Run with Node.js

```bash
# Prerequisites: Node.js 20+
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade

npm install
npm run build
npm start
```

For detailed guides covering **Raspberry Pi**, **100% Offline AI (Ollama)**, **Fly.io**, **Railway**, and **Render**, see [**SELF_HOSTING.md**](SELF_HOSTING.md).

---

## ☁️ One-Click Cloud Deployment

Deploy your family's private treehouse in minutes to your favorite cloud provider:

| Provider | Guide / Deploy | Notes |
| :--- | :--- | :--- |
| **Fly.io** | [`fly.example.toml`](fly.example.toml) | Turnkey global edge deployment with persistent SQLite storage. |
| **Railway** | [Railway Deployment Guide](SELF_HOSTING.md#railway) | Docker deploy with persistent volume support. |
| **Render** | [Render Deployment Guide](SELF_HOSTING.md#render) | Docker Web Service with persistent disk. |

---

## 🛡️ Privacy by Architecture

Most kid software builds safety around surveillance. Marmalade builds safety into the application architecture:

| Boundary | How It Works |
| :--- | :--- |
| **No Transcript Reader** | Parents configure daily time limits, cooldown breaks, and spend caps. Parents see operational metrics (minutes active today, estimated cost, and safety alerts)—never what the child wrote. (See [Threat Model](docs/THREAT_MODEL.md) for application boundary scope). |
| **PII Redaction** | Built-in heuristic regex filters screen common patterns for phone numbers, home addresses, emails, and school names from child prompts before queries reach cloud providers. |
| **Transient Memory** | Unsaved conversation turns vanish from memory after 15 minutes of inactivity, on logout, or on server restart. Only work the child explicitly clicks *"Save to Chest"* is written to SQLite. |
| **Zero Telemetry** | Marmalade makes zero external network requests to analytics services, tracking pixels, or remote CDNs. All fonts, icons, and illustrations are bundled locally, enforced via strict Content Security Policy. |
| **Emergency Support** | If a child asks about serious distress or self-harm, Marmalade immediately displays calm, supportive crisis helpline resources (988 US/Canada, 111 UK, 14416 India) and records a high-level category alert for the parent. (For disclosures of harm from household guardians, helplines are shown while dashboard alerts are suppressed). |

---

## 🔌 Supported AI Providers

Marmalade connects to both local offline models and commercial cloud APIs:

* **Ollama (100% Free & Offline)**: Run models locally on your home server, Raspberry Pi, Mac, or PC (`llama3.2`, `gemma2`, `mistral`). Zero API subscriptions or cloud bills.
* **Anthropic Claude**: Exceptional conversational warmth, creative storytelling, and nuanced Socratic coaching (`claude-haiku-5-5`, `claude-sonnet-5-5`).
* **OpenAI**: Reliable general reasoning (`gpt-4o-mini`, `gpt-4o`).
* **Google Gemini Note**: Google's API terms of service require users to be at least 18 years of age. To protect child privacy and strictly adhere to provider compliance rules, Marmalade automatically restricts Google Gemini for minor/child workspaces.
* **Demo Mode**: Built-in mock responses for trying out the treehouse with zero keys or internet.

---

## 🧪 Verification & Testing

Marmalade maintains a comprehensive test suite covering safety policies, concurrent tabs, token ceilings, quota accounting, and state machines:

```bash
# Run automated vitest test suite
npm test

# Check TypeScript types
npx tsc --noEmit

# Compile production bundle
npm run build
```

---

## 💖 Contributing

We welcome contributions from parents, educators, and developers!
- Want to add a new Story Relay genre or Trivia pack?
- Have an idea for a new learning nook (e.g., Math Workshop or Language Lab)?
- Want to optimize an Ollama model profile?

See [**CONTRIBUTING.md**](CONTRIBUTING.md) to get started.

---

## 📜 License

Marmalade is open-source software released under the [**MIT License**](LICENSE).  
You are free to inspect, modify, self-host, and adapt it for your family.

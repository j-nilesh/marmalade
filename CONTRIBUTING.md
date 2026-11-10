# Contributing to Marmalade 🐱

Thank you for your interest in contributing to Marmalade! We are building a private, self-hosted AI companion and learning sanctuary for families.

Whether you are a developer, designer, educator, or parent, your help makes Marmalade better for children everywhere.

---

## Code of Conduct & Core Philosophy

Every contribution must align with our primary principle:

> **"Trust children. Govern the technology."**
> 1. **No surveillance**: Never add features that allow parents to read raw conversation transcripts.
> 2. **No infinite engagement**: Avoid gamification, daily streaks, manipulative notifications, or loot mechanics designed to prolong screen time.
> 3. **Privacy by default**: Do not add third-party tracking, analytics, remote CDNs, or telemetry. All assets must remain strictly local.

---

## Local Development Setup

Prerequisites:
- **Node.js 20+**
- **npm**

```bash
# 1. Clone the repository
git clone https://github.com/j-nilesh/marmalade.git
cd marmalade

# 2. Install dependencies
npm install

# 3. Start development servers
# Starts the backend API server on port 4120
npm run dev

# In a separate terminal, start the Vite frontend with hot-reloading
npm run dev:client
```

Open `http://localhost:5173` for the Vite development view, or `http://localhost:4120` for the backend server.

---

## Ways to Contribute

### 1. Educational Content & Activity Packs
- **Story Relay Studio**: Add new imaginative premises and craft coaching tips (`src/client/components/PlayActivity.tsx`).
- **Trivia Arcade**: Suggest new curiosity-driven categories and interesting facts.
- **Study Nook Prompts**: Refine Socratic questioning frameworks for different school subjects.

### 2. Local AI & Homelab Enhancements
- Test and contribute recommended model profiles for Ollama (`llama3.2`, `gemma2`, `qwen2.5`).
- Optimize Docker Compose configurations for Raspberry Pi and low-power home servers.

### 3. Mascot & UI Delight
- Contribute new inline SVG animations or poses for Marmalade the ginger cat (`src/client/components/Cat.tsx`).
- Maintain accessibility standards (minimum 44px tap targets, keyboard navigation, `:focus-visible` styling).

---

## Verification Before Submitting a PR

Before submitting your Pull Request, ensure that all tests pass and the production bundle compiles:

```bash
# 1. Run the test suite (all automated tests must pass)
npm test

# 2. Type-check TypeScript
npx tsc --noEmit

# 3. Run production build
npm run build
```

---

## Pull Request Guidelines

1. **Keep it focused**: One bug fix or one new feature per PR.
2. **Preserve documentation**: Keep docstrings, comments, and architectural constraints intact.
3. **Write tests**: If you add new policy rules or engine methods, add corresponding unit tests in `tests/`.

Thank you for helping build a safer, friendlier, and more creative digital world for kids!

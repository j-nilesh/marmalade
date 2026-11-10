import React from 'react';
import { Brand } from './Common';
import { BRANDING } from '../../shared/branding';
import { IconTile, LineIcons } from './Illustrations';

const rooms = [
  {
    room: 'ask' as const,
    name: 'The Question Room',
    body: 'Ask anything. Up to 8 short replies per conversation — direct answers, no quizzes or hooks to keep you scrolling.',
  },
  {
    room: 'research' as const,
    name: 'The Field Guide',
    body: 'One answer per search, with numbered sources to check — and an honest “nothing found” when there isn’t anything.',
  },
  {
    room: 'schoolwork' as const,
    name: 'The Study Nook',
    body: 'Homework coaching that asks what you’ve tried and helps with the next step. It won’t just do the work for you.',
  },
  {
    room: 'play' as const,
    name: 'The Game Loft',
    body: 'Trivia ends after 10 questions, Twenty Questions after 20 turns, Story Relay after 6 scenes. Games with real endings.',
  },
  {
    room: 'saved' as const,
    name: 'The Treasure Chest',
    body: 'Only what the child chooses to keep is stored — answers, research notes, stories, learning notes. Editable and downloadable.',
  },
];

export function LandingPage({
  onSignIn,
  instanceName,
}: {
  onSignIn: () => void;
  instanceName?: string;
}) {
  const name = instanceName || BRANDING.productName;
  return (
    <div className="landing th-modern">
      <a className="skip-link" href="#landing-main">
        Skip to content
      </a>
      <header className="landing-bar">
        <Brand name={instanceName} />
        <button type="button" className="primary" onClick={onSignIn}>
          Climb up · Sign in
        </button>
      </header>

      <main id="landing-main">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-text">
            <p className="eyebrow">Our family’s treehouse</p>
            <h1 id="landing-title">
              A treehouse for <span className="hl">big questions.</span>
            </h1>
            <p className="landing-lead">
              {name} is a small, private place for curious
              kids to use AI — with rooms for wondering, finding out,
              homework, and play. Grown-ups set the time; kids keep their
              thoughts.
            </p>
            <div className="button-row">
              <button type="button" className="primary big" onClick={onSignIn}>
                Sign in to the treehouse
              </button>
              <a className="button-link" href="#ladder-rules">
                How it works
              </a>
            </div>
          </div>
          <div className="landing-preview" aria-hidden="true">
            <p className="landing-preview-hi">Hi! Where to today?</p>
            <div className="landing-preview-grid">
              {rooms.slice(0, 4).map(({ room, name }) => (
                <div className="landing-preview-card" key={name}>
                  <IconTile room={room} size={22} />
                  <span>{name.replace('The ', '')}</span>
                </div>
              ))}
            </div>
            <div className="landing-preview-chest">
              <IconTile room="saved" size={20} />
              <span>Treasure Chest</span>
            </div>
          </div>
        </section>

        <section className="landing-band" aria-labelledby="rooms-title">
          <h2 id="rooms-title">Five rooms, each with a door that closes.</h2>
          <p className="muted landing-band-lead">
            General chatbots are built to keep you talking. Every room here
            has a beginning and an ending, enforced on the server — not by a
            timer in the browser.
          </p>
          <ul className="landing-rooms">
            {rooms.map(({ room, name, body }) => (
              <li key={name} className="landing-room">
                <IconTile room={room} />
                <h3>{name}</h3>
                <p>{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="landing-section"
          id="ladder-rules"
          aria-labelledby="ladder-title"
        >
          <h2 id="ladder-title">The ladder rules</h2>
          <p className="landing-pull">
            Grown-ups set the boundaries. There is no conversation reader.
          </p>
          <div className="ladder">
            <div className="rung">
              <span className="icon-tile small" aria-hidden="true"><LineIcons.saved size={20} /></span>
              <h3>What’s kept</h3>
              <p>
                Logins, the limits grown-ups set, daily time and cost totals,
                and only the work a child chooses to put in the treasure
                chest.
              </p>
            </div>
            <div className="rung">
              <span className="icon-tile small" aria-hidden="true"><LineIcons.clock size={20} /></span>
              <h3>What disappears</h3>
              <p>
                Ongoing conversations fade from memory after 15 quiet minutes,
                on sign-out, or whenever the server restarts.
              </p>
            </div>
            <div className="rung">
              <span className="icon-tile small" aria-hidden="true"><LineIcons.shield size={20} /></span>
              <h3>What leaves the house</h3>
              <p>
                Only the current turn goes to the AI provider — screened first,
                with phone numbers, addresses, emails and school names
                stripped out.
              </p>
            </div>
            <div className="rung">
              <span className="icon-tile small" aria-hidden="true"><LineIcons.heart size={20} /></span>
              <h3>What grown-ups see</h3>
              <p>
                Minutes used, estimated cost, and broad safety categories with
                a time — <em>never what the child typed</em>.
              </p>
            </div>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="safety-title">
          <h2 id="safety-title">When something’s really wrong</h2>
          <div className="landing-card">
            <p>
              If a child writes about serious distress — like self-harm or
              abuse — they immediately see a calm, supportive message with
              24/7 helplines (988 in North America, 111 or Childline in the UK,
              14416 or 1098 in India). The grown-up gets a category and a time,
              not the words.
            </p>
            <p className="muted">
              <strong>Honestly:</strong> filters and AI are imperfect. They
              can’t promise every answer is right or suitable — which is why
              trust and talking together still matter most.
            </p>
          </div>
        </section>

        <section className="landing-section" aria-labelledby="ai-title">
          <h2 id="ai-title">Which AI can move in</h2>
          <p>
            AI companies have different rules about products for under-18s.{' '}
            {name} checks them in code before a provider can
            reach a child’s room.
          </p>
          <ul className="provider-list">
            <li className="provider ok">
              <span className="provider-status">Allowed with conditions</span>
              <h3>Anthropic Claude</h3>
              <p>
                Needs content filtering, monitoring, AI disclosure and
                child-safety prompts — all built in.{' '}
                <a
                  href="https://support.claude.com/en/articles/9307344"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Anthropic guidance ↗
                </a>
              </p>
            </li>
            <li className="provider ok">
              <span className="provider-status">Allowed with conditions</span>
              <h3>OpenAI</h3>
              <p>
                Age-appropriate guardrails; under-13s need Zero Data Retention
                approval.{' '}
                <a
                  href="https://developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  OpenAI guidance ↗
                </a>
              </p>
            </li>
            <li className="provider ok">
              <span className="provider-status">Allowed</span>
              <h3>Local models (Ollama)</h3>
              <p>
                Runs entirely at home; the family is responsible for the
                model’s answers.{' '}
                <a href="https://ollama.com" target="_blank" rel="noreferrer noopener">
                  Ollama ↗
                </a>
              </p>
            </li>
            <li className="provider no">
              <span className="provider-status">Not allowed</span>
              <h3>Google Gemini API</h3>
              <p>
                Its terms require users to be 18+, so it’s blocked for
                children’s rooms.{' '}
                <a
                  href="https://ai.google.dev/terms"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Gemini terms ↗
                </a>
              </p>
            </li>
          </ul>
        </section>

        <section className="landing-section" aria-labelledby="open-title">
          <h2 id="open-title">Built in the open, run at home</h2>
          <div className="landing-card two-col">
            <p>
              {name} is free, open-source software under the{' '}
              {BRANDING.license} License, self-hosted by one family on their own
              server. No ads, no trackers, no third-party scripts — even the
              fonts and drawings on this page are served from right here.
            </p>
            <p>
              <strong>Version {BRANDING.version}</strong> · active development
              <br />
              <a
                href={BRANDING.githubUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                Source code (coming soon) ↗
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <p className="landing-footer-tagline">{BRANDING.tagline}</p>
        <button type="button" className="primary" onClick={onSignIn}>
          Sign in to the treehouse
        </button>
        <p className="muted">
          &copy; {BRANDING.productName} contributors · {BRANDING.license}{' '}
          License
        </p>
      </footer>
    </div>
  );
}

import { describe, it, expect, beforeEach } from 'vitest';
import { createSproutApp, SESSION_COOKIE_NAME } from '../src/server/app.js';

function extractCookie(res: Response, name = SESSION_COOKIE_NAME): string | null {
  const setCookieHeader = res.headers.get('set-cookie');
  if (!setCookieHeader) return null;
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

async function jsonRequest(
  app: { fetch: (req: Request) => Response | Promise<Response> },
  path: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string | null;
    csrf?: string | null;
  } = {}
) {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.cookie) {
    headers['Cookie'] = `${SESSION_COOKIE_NAME}=${options.cookie}`;
  }
  if (options.csrf) {
    headers['X-Sprout-CSRF'] = options.csrf;
  }

  const req = new Request(`http://localhost${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const res = await app.fetch(req);
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json()
    : await res.text();
  return { res, status: res.status, data, cookie: extractCookie(res) };
}

describe('Sprout Core — Milestone A Acceptance & Adversarial Suite', () => {
  let currentNowMs = Date.parse('2026-11-02T10:00:00Z');

  beforeEach(() => {
    currentNowMs = Date.parse('2026-11-02T10:00:00Z');
  });

  it('1. Enforces First-Run Setup, role isolation, CSRF tokens, and 15-minute parent session timeout', async () => {
    const { app } = createSproutApp({
      dbPath: ':memory:',
      clock: () => currentNowMs,
    });

    // Before setup, bootstrap reports initialized: false
    const boot0 = await jsonRequest(app, '/api/bootstrap');
    expect(boot0.status).toBe(200);
    expect(boot0.data.initialized).toBe(false);

    // Complete first-run setup
    const setupRes = await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'nilesh',
        parentDisplayName: 'Parent Admin',
        parentPassword: 'parent-strong-password',
        childUsername: 'maya',
        childDisplayName: 'Maya (Synthetic)',
        childPassword: 'child-pass',
        timezone: 'Asia/Kolkata',
        globalDailyMinutes: 90,
        playDailyMinutes: 25,
      },
    });
    expect(setupRes.status).toBe(200);
    expect(setupRes.data.ok).toBe(true);
    const parentCookie = setupRes.cookie;
    const parentCsrf = setupRes.data.csrfToken as string;
    expect(parentCookie).toBeTruthy();
    expect(parentCsrf).toBeTruthy();

    // Duplicate setup attempt must be blocked with 409
    const dupSetup = await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'other',
        parentDisplayName: 'Other',
        parentPassword: 'password1234',
        childUsername: 'kid2',
        childDisplayName: 'Kid 2',
        childPassword: 'password12',
      },
    });
    expect(dupSetup.status).toBe(409);

    // Mutating parent policy WITHOUT CSRF token must fail with 403
    const noCsrfRes = await jsonRequest(app, '/api/parent/policy', {
      method: 'PUT',
      cookie: parentCookie,
      body: { globalDailyMinutes: 60 },
    });
    expect(noCsrfRes.status).toBe(403);
    expect(noCsrfRes.data.error).toBe('INVALID_CSRF_TOKEN');

    // Sign in as child
    const childLogin = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'child-pass' },
    });
    expect(childLogin.status).toBe(200);
    const childCookie = childLogin.cookie;
    const childCsrf = childLogin.data.csrfToken as string;

    // Child cannot access parent governance endpoints
    const childToParent = await jsonRequest(app, '/api/parent/dashboard', {
      cookie: childCookie,
    });
    expect(childToParent.status).toBe(403);
    expect(childToParent.data.error).toBe('FORBIDDEN_ROLE');

    // Advance clock by 16 minutes -> parent session auto-expires (15-min TTL), while child session stays valid
    currentNowMs += 16 * 60 * 1000;

    const expiredParent = await jsonRequest(app, '/api/parent/dashboard', {
      cookie: parentCookie,
    });
    expect(expiredParent.status).toBe(401);

    const activeChild = await jsonRequest(app, '/api/quota', {
      cookie: childCookie,
      csrf: childCsrf,
    });
    expect(activeChild.status).toBe(200);
  });

  it('2. Runs a 10-question Trivia round in Play mode and enforces a hard stopping point at Question 10', async () => {
    const { app } = createSproutApp({
      dbPath: ':memory:',
      clock: () => currentNowMs,
    });

    await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'parent-password-123',
        childUsername: 'maya',
        childDisplayName: 'Maya',
        childPassword: 'maya-password',
        globalDailyMinutes: 90,
        playDailyMinutes: 30,
      },
    });

    const childLogin = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'maya-password' },
    });
    const childCookie = childLogin.cookie!;
    const childCsrf = childLogin.data.csrfToken as string;

    // Start a 10-question trivia round
    const startRes = await jsonRequest(app, '/api/play/trivia/start', {
      method: 'POST',
      cookie: childCookie,
      csrf: childCsrf,
      body: { topic: 'mixed', difficulty: 'standard' },
    });
    expect(startRes.status).toBe(200);
    expect(startRes.data.session.totalQuestions).toBe(10);
    expect(startRes.data.session.status).toBe('active');
    const sessionId = startRes.data.session.sessionId as string;

    // Answer questions 1 through 9 -> remains active
    for (let i = 1; i <= 9; i++) {
      const ansRes = await jsonRequest(
        app,
        `/api/play/trivia/${sessionId}/answer`,
        {
          method: 'POST',
          cookie: childCookie,
          csrf: childCsrf,
          body: { choiceIndex: 1 },
        }
      );
      expect(ansRes.status).toBe(200);
      expect(ansRes.data.session.answeredCount).toBe(i);
      expect(ansRes.data.session.status).toBe('active');
      expect(ansRes.data.session.currentQuestion.index).toBe(i + 1);
    }

    // Simulate page refresh before Question 10 -> state persists on server
    const refreshRes = await jsonRequest(app, `/api/play/trivia/${sessionId}`, {
      cookie: childCookie,
    });
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.data.session.answeredCount).toBe(9);
    expect(refreshRes.data.session.currentQuestion.index).toBe(10);

    // Answer Question 10 -> reaches hard stopping point ('completed')
    const q10Res = await jsonRequest(
      app,
      `/api/play/trivia/${sessionId}/answer`,
      {
        method: 'POST',
        cookie: childCookie,
        csrf: childCsrf,
        body: { choiceIndex: 0 },
      }
    );
    expect(q10Res.status).toBe(200);
    expect(q10Res.data.session.answeredCount).toBe(10);
    expect(q10Res.data.session.status).toBe('completed');
    expect(q10Res.data.session.currentQuestion).toBeNull();
    expect(q10Res.data.session.stoppingMessage).toContain('Round complete');

    // Attempting an 11th answer on the completed round is rejected by server
    const q11Res = await jsonRequest(
      app,
      `/api/play/trivia/${sessionId}/answer`,
      {
        method: 'POST',
        cookie: childCookie,
        csrf: childCsrf,
        body: { choiceIndex: 0 },
      }
    );
    expect(q11Res.status).toBe(403);
    expect(q11Res.data.error).toBe('SESSION_COMPLETED');
  });

  it('3. Adversarial Quota Test: Refreshing, opening a second tab, or switching to Ask cannot bypass Play or Global limits', async () => {
    const { app } = createSproutApp({
      dbPath: ':memory:',
      clock: () => currentNowMs,
    });

    const setupRes = await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'parent-password-123',
        childUsername: 'maya',
        childDisplayName: 'Maya',
        childPassword: 'maya-password',
        globalDailyMinutes: 90,
        playDailyMinutes: 25,
      },
    });
    const parentCookie = setupRes.cookie!;
    const parentCsrf = setupRes.data.csrfToken as string;

    // Parent changes Play limit to 1 minute (60s = 4 turns of 15s) and Global limit to 2 minutes (120s = 8 turns of 15s)
    const policyRes = await jsonRequest(app, '/api/parent/policy', {
      method: 'PUT',
      cookie: parentCookie,
      csrf: parentCsrf,
      body: {
        globalDailyMinutes: 2,
        modes: {
          play: { enabled: true, dailyMinutes: 1 },
          ask: { enabled: true, dailyMinutes: 10 },
        },
      },
    });
    expect(policyRes.status).toBe(200);
    expect(policyRes.data.policy.globalDailyMinutes).toBe(2);
    expect(policyRes.data.policy.modes.play.dailyMinutes).toBe(1);

    // Child logs in on Tab 1 and Tab 2 (two separate sessions)
    const tab1Login = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'maya-password' },
    });
    const tab2Login = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'maya-password' },
    });
    const tab1Cookie = tab1Login.cookie!;
    const tab1Csrf = tab1Login.data.csrfToken as string;
    const tab2Cookie = tab2Login.cookie!;
    const tab2Csrf = tab2Login.data.csrfToken as string;

    // Starting a session does not invent elapsed time: Start Trivia in Tab 1
    const startRes = await jsonRequest(app, '/api/play/trivia/start', {
      method: 'POST',
      cookie: tab1Cookie,
      csrf: tab1Csrf,
      body: { topic: 'mythology_history', difficulty: 'standard' },
    });
    expect(startRes.status).toBe(200);
    const triviaId = startRes.data.session.sessionId as string;
    expect(startRes.data.quota.modes.play.usedSeconds).toBe(0);
    expect(startRes.data.quota.globalUsedSeconds).toBe(0);

    // Three interactions spaced 15 seconds apart record 45 elapsed seconds.
    for (let i = 0; i < 3; i++) {
      currentNowMs += 15_000;
      const r = await jsonRequest(app, `/api/play/trivia/${triviaId}/answer`, {
        method: 'POST',
        cookie: tab1Cookie,
        csrf: tab1Csrf,
        body: { choiceIndex: 0 },
      });
      expect(r.status).toBe(200);
    }

    // Attempt Turn 5 in Tab 1 -> Blocked by MODE_TIME_LIMIT_REACHED
    currentNowMs += 15_000;
    const blockedTab1 = await jsonRequest(
      app,
      `/api/play/trivia/${triviaId}/answer`,
      {
        method: 'POST',
        cookie: tab1Cookie,
        csrf: tab1Csrf,
        body: { choiceIndex: 0 },
      }
    );
    expect(blockedTab1.status).toBe(403);
    expect(blockedTab1.data.error).toBe('MODE_TIME_LIMIT_REACHED');
    expect(blockedTab1.data.session.status).toBe('stopped_by_quota');

    // Attempt to bypass from Tab 2 by starting a new Trivia round -> Also blocked!
    const blockedTab2 = await jsonRequest(app, '/api/play/trivia/start', {
      method: 'POST',
      cookie: tab2Cookie,
      csrf: tab2Csrf,
      body: { topic: 'space_science', difficulty: 'standard' },
    });
    expect(blockedTab2.status).toBe(403);
    expect(blockedTab2.data.error).toBe('MODE_TIME_LIMIT_REACHED');

    // Now Child switches to Ask & Learn. She has 60s of Global Daily Time left (out of 120s), even though Ask's subcap is 10 minutes!
    for (let i = 0; i < 4; i++) {
      if (i > 0) currentNowMs += 15_000;
      const askTurn = await jsonRequest(app, '/api/ask/turn', {
        method: 'POST',
        cookie: tab1Cookie,
        csrf: tab1Csrf,
        body: { prompt: `Question ${i + 1} about Julius Caesar` },
      });
      expect(askTurn.status).toBe(200);
    }

    // Now Global Daily Time is 120s / 120s (0s remaining).
    // Attempt 5th Ask turn in Tab 1 or Tab 2 -> Blocked by GLOBAL_TIME_LIMIT_REACHED!
    currentNowMs += 15_000;
    const blockedAsk = await jsonRequest(app, '/api/ask/turn', {
      method: 'POST',
      cookie: tab2Cookie,
      csrf: tab2Csrf,
      body: { prompt: 'Can I keep chatting in Ask mode after global limit?' },
    });
    expect(blockedAsk.status).toBe(403);
    expect(blockedAsk.data.error).toBe('GLOBAL_TIME_LIMIT_REACHED');

    // Even while blocked by time limit, child CAN still save her explicit work artifact!
    const saveArt = await jsonRequest(app, '/api/artifacts', {
      method: 'POST',
      cookie: tab1Cookie,
      csrf: tab1Csrf,
      body: {
        title: 'My Mythology Trivia Notes',
        mode: 'play',
        activityType: 'trivia_10',
        content: 'Arachne challenged Athena; Machu Picchu was built by the Inca.',
      },
    });
    expect(saveArt.status).toBe(200);
    expect(saveArt.data.artifact.title).toBe('My Mythology Trivia Notes');

    // Export artifact as Markdown
    const exportRes = await jsonRequest(
      app,
      `/api/artifacts/${saveArt.data.artifact.id}/export`,
      { cookie: tab1Cookie }
    );
    expect(exportRes.status).toBe(200);
    expect(String(exportRes.data)).toContain('# My Mythology Trivia Notes');

    // Child requests +15 minutes extra time; Parent approves locally -> Child can play again!
    const extReq = await jsonRequest(app, '/api/extensions/request', {
      method: 'POST',
      cookie: tab1Cookie,
      csrf: tab1Csrf,
      body: {
        requestedMode: 'play',
        requestedMinutes: 15,
        reasonNote: 'Finishing my 10-question trivia round!',
      },
    });
    expect(extReq.status).toBe(200);
    const extId = extReq.data.request.id as number;

    const approveRes = await jsonRequest(
      app,
      `/api/parent/extensions/${extId}/resolve`,
      {
        method: 'POST',
        cookie: parentCookie,
        csrf: parentCsrf,
        body: { approve: true, grantedMinutes: 15 },
      }
    );
    expect(approveRes.status).toBe(200);
    expect(approveRes.data.quota.globalRemainingSeconds).toBe(15 * 60);
    expect(approveRes.data.quota.modes.play.remainingSeconds).toBe(15 * 60);

    // Child can now continue answering her Trivia round!
    const resumedTurn = await jsonRequest(
      app,
      `/api/play/trivia/${triviaId}/answer`,
      {
        method: 'POST',
        cookie: tab1Cookie,
        csrf: tab1Csrf,
        body: { choiceIndex: 1 },
      }
    );
    expect(resumedTurn.status).toBe(200);
  });

  it('4. Resets daily counters at the family-configured time zone midnight (not UTC midnight) and stops counting idle tabs after 90s lease', async () => {
    // 2026-11-02T18:20:00Z is 23:50:00 IST (Asia/Kolkata, UTC+5:30) on 2026-11-02
    currentNowMs = Date.parse('2026-11-02T18:20:00Z');

    const { app } = createSproutApp({
      dbPath: ':memory:',
      clock: () => currentNowMs,
    });

    await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'parent-password-123',
        childUsername: 'maya',
        childDisplayName: 'Maya',
        childPassword: 'maya-password',
        timezone: 'Asia/Kolkata',
        globalDailyMinutes: 1, // 60 seconds
        playDailyMinutes: 1,
      },
    });

    const childLogin = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'maya-password' },
    });
    const cookie = childLogin.cookie!;
    const csrf = childLogin.data.csrfToken as string;

    // 1. User interaction starts a 90s lease without charging future time
    const startRes = await jsonRequest(app, '/api/play/trivia/start', {
      method: 'POST',
      cookie,
      csrf,
      body: { topic: 'mixed', difficulty: 'standard' },
    });
    expect(startRes.status).toBe(200);
    expect(startRes.data.quota.dateKey).toBe('2026-11-02');
    expect(startRes.data.quota.globalUsedSeconds).toBe(0);

    // 2. Simultaneous duplicate heartbeat at the exact same timestamp from another tab credits 0s
    const dupHb = await jsonRequest(app, '/api/quota/heartbeat', {
      method: 'POST',
      cookie,
      csrf,
      body: { mode: 'play', userInteracted: false },
    });
    expect(dupHb.data.quota.globalUsedSeconds).toBe(0);

    // 3. Advance 15s within the 90s lease -> heartbeat credits 15s (now 15s used)
    currentNowMs += 15_000;
    const activeHb = await jsonRequest(app, '/api/quota/heartbeat', {
      method: 'POST',
      cookie,
      csrf,
      body: { mode: 'play', userInteracted: false },
    });
    expect(activeHb.data.quota.globalUsedSeconds).toBe(15);

    // 4. Advance 120s with NO user interaction (past the 90s lease) -> idle open tab credits 0s!
    currentNowMs += 120_000;
    const idleHb = await jsonRequest(app, '/api/quota/heartbeat', {
      method: 'POST',
      cookie,
      csrf,
      body: { mode: 'play', userInteracted: false },
    });
    expect(idleHb.data.quota.globalUsedSeconds).toBe(15);
    expect(idleHb.data.quota.interactionLeaseActive).toBe(false);

    // 5. Cross midnight in Asia/Kolkata: advance to 2026-11-02T18:35:00Z (00:05:00 IST on 2026-11-03, while UTC is still 2026-11-02!)
    currentNowMs = Date.parse('2026-11-02T18:35:00Z');
    const nextDayQuota = await jsonRequest(app, '/api/quota', { cookie });
    expect(nextDayQuota.data.quota.dateKey).toBe('2026-11-03');
    expect(nextDayQuota.data.quota.globalUsedSeconds).toBe(0);
    expect(nextDayQuota.data.quota.globalRemainingSeconds).toBe(60);
  });

  it('5. Enforces Ask->Play handoff for sustained stories, preserves transcript privacy in Parent Dashboard, and blocks unverified providers', async () => {
    const { app, db } = createSproutApp({
      dbPath: ':memory:',
      clock: () => currentNowMs,
    });

    const setupRes = await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'parent-password-123',
        childUsername: 'maya',
        childDisplayName: 'Maya',
        childPassword: 'maya-password',
      },
    });
    const parentCookie = setupRes.cookie!;
    const parentCsrf = setupRes.data.csrfToken as string;

    const childLogin = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'maya-password' },
    });
    const childCookie = childLogin.cookie!;
    const childCsrf = childLogin.data.csrfToken as string;

    // 1. Legitimate literature question about Dracula/Brutus is answered thoughtfully
    const litTurn = await jsonRequest(app, '/api/ask/turn', {
      method: 'POST',
      cookie: childCookie,
      csrf: childCsrf,
      body: {
        prompt: 'Why did Brutus betray Caesar, and how is Dracula structured?',
      },
    });
    expect(litTurn.status).toBe(200);
    expect(litTurn.data.turn.assistantResponse).toContain('Julius Caesar');
    expect(litTurn.data.turn.suggestPlayHandoff).toBeUndefined();

    // 2. Sustained story request in Ask & Learn triggers explicit Play handoff
    const storyTurn = await jsonRequest(app, '/api/ask/turn', {
      method: 'POST',
      cookie: childCookie,
      csrf: childCsrf,
      body: {
        prompt: 'Write me a long multi-chapter story about dragons!',
      },
    });
    expect(storyTurn.status).toBe(200);
    expect(storyTurn.data.turn.suggestPlayHandoff).toBeDefined();
    expect(storyTurn.data.turn.suggestPlayHandoff.suggestedActivity).toBe(
      'story_relay'
    );

    // 3. Verify Parent Dashboard contains operational metrics ONLY and zero transcript text
    const dashRes = await jsonRequest(app, '/api/parent/dashboard', {
      cookie: parentCookie,
    });
    expect(dashRes.status).toBe(200);
    const dashJsonString = JSON.stringify(dashRes.data);
    expect(dashJsonString).not.toContain('Brutus');
    expect(dashJsonString).not.toContain('Dracula');
    expect(dashJsonString).not.toContain('dragons');
    expect(dashRes.data.todayStats.requestCount).toBe(2);

    // Also verify no SQLite table stores the raw chat prompt
    const tables = db.raw
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>;
    for (const t of tables) {
      const rowsJson = JSON.stringify(
        db.raw.prepare(`SELECT * FROM ${t.name}`).all()
      );
      expect(rowsJson).not.toContain('Brutus');
      expect(rowsJson).not.toContain('dragons');
    }

    // 4. Selecting an unverified provider ('openai') fails closed for child sessions
    await jsonRequest(app, '/api/parent/policy', {
      method: 'PUT',
      cookie: parentCookie,
      csrf: parentCsrf,
      body: { activeProvider: 'openai' },
    });

    const blockedByUnverifiedProvider = await jsonRequest(
      app,
      '/api/ask/turn',
      {
        method: 'POST',
        cookie: childCookie,
        csrf: childCsrf,
        body: { prompt: 'Hello?' },
      }
    );
    expect(blockedByUnverifiedProvider.status).toBe(403);
    expect(blockedByUnverifiedProvider.data.error).toBe(
      'PROVIDER_NOT_SAFETY_VERIFIED'
    );
  });

  it('6. Enforces API spend ceiling reservations and serves compiled local SPA with zero external telemetry', async () => {
    const { app, providerRegistry } = createSproutApp({
      dbPath: ':memory:',
      clock: () => currentNowMs,
      serveStaticClient: true,
    });

    // Verify GET / serves the local SPA with security headers and no external telemetry URLs
    const rootRes = await app.fetch(new Request('http://localhost/'));
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('X-Frame-Options')).toBe('DENY');
    expect(rootRes.headers.get('Referrer-Policy')).toBe('no-referrer');
    const html = await rootRes.text();
    expect(html).toMatch(/Marmalade|Sprout Core/);
    expect(html).not.toMatch(/https?:\/\//i);

    const setupRes = await jsonRequest(app, '/api/setup', {
      method: 'POST',
      body: {
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'parent-password-123',
        childUsername: 'maya',
        childDisplayName: 'Maya',
        childPassword: 'maya-password',
      },
    });
    const parentCookie = setupRes.cookie!;
    const parentCsrf = setupRes.data.csrfToken as string;

    // A simulated paid provider exercises reservations; normal demo activity is free.
    const paid = providerRegistry.getModelProvider('mock');
    const originalGenerate = paid.generate.bind(paid);
    Object.defineProperty(paid, 'maxPotentialCostPerTurnCents', {value:2});
    paid.generate = async request => ({...await originalGenerate(request),estimatedCostCents:1});

    // Set dailySpendCapCents to 3 cents (MockProvider reserves 2 cents before dispatch and reconciles 1 cent actual)
    await jsonRequest(app, '/api/parent/policy', {
      method: 'PUT',
      cookie: parentCookie,
      csrf: parentCsrf,
      body: { dailySpendCapCents: 3 },
    });

    const childLogin = await jsonRequest(app, '/api/auth/login', {
      method: 'POST',
      body: { username: 'maya', password: 'maya-password' },
    });
    const childCookie = childLogin.cookie!;
    const childCsrf = childLogin.data.csrfToken as string;

    // Turn 1: 0 spent + 2 reserved <= 3 -> Allowed, reconciles to 1 cent spent
    const t1 = await jsonRequest(app, '/api/ask/turn', {
      method: 'POST',
      cookie: childCookie,
      csrf: childCsrf,
      body: { prompt: 'First budgeted question' },
    });
    expect(t1.status).toBe(200);
    expect(t1.data.quota.dailySpentCents).toBe(1);

    // Turn 2: 1 spent + 2 reserved <= 3 -> Allowed, reconciles to 2 cents spent
    const t2 = await jsonRequest(app, '/api/ask/turn', {
      method: 'POST',
      cookie: childCookie,
      csrf: childCsrf,
      body: { prompt: 'Second budgeted question' },
    });
    expect(t2.status).toBe(200);
    expect(t2.data.quota.dailySpentCents).toBe(2);

    // Turn 3: 2 spent + 2 reserved = 4 > 3 -> Blocked before dispatch with DAILY_SPEND_CAP_REACHED!
    const t3 = await jsonRequest(app, '/api/ask/turn', {
      method: 'POST',
      cookie: childCookie,
      csrf: childCsrf,
      body: { prompt: 'Third question exceeding budget reservation' },
    });
    expect(t3.status).toBe(403);
    expect(t3.data.error).toBe('DAILY_SPEND_CAP_REACHED');
  });
});

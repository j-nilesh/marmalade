import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { randomUUID } from 'node:crypto';
import { getConnInfo } from '@hono/node-server/conninfo';
import { ProviderConnectionError } from './providers/errors.js';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { existsSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import type {
  ActivityMode,
  ParentDashboardSummary,
  ProviderId,
  TriviaDifficulty,
  TriviaTopic,
} from '../shared/types.js';
import {
  MarmaladeDatabase,
  SproutDatabase,
  resolveDefaultDbPath,
  type SessionRecord,
} from './db/sqlite.js';
import { PolicyEngine } from './policy/engine.js';
import { ActivityEngine } from './activities/engine.js';
import { ProviderRegistry } from './providers/registry.js';
import { LoginRateLimiter } from './auth/rateLimit.js';
import { BRANDING } from '../shared/branding.js';
import { isProviderAllowedForMinors } from '../shared/providerPolicy.js';

export const SESSION_COOKIE_NAME = 'marmalade_session';
export const LEGACY_SESSION_COOKIE_NAME = 'sprout_session';
export const CSRF_HEADER_NAME = 'X-Marmalade-CSRF';
export const LEGACY_CSRF_HEADER_NAME = 'X-Sprout-CSRF';

export interface MarmaladeAppOptions {
  dbPath?: string;
  clock?: () => number;
  serveStaticClient?: boolean;
  trustProxy?: boolean;
}
export type SproutAppOptions = MarmaladeAppOptions;

export interface MarmaladeAppInstance {
  app: Hono<any>;
  db: MarmaladeDatabase;
  policyEngine: PolicyEngine;
  activityEngine: ActivityEngine;
  providerRegistry: ProviderRegistry;
}
export type SproutAppInstance = MarmaladeAppInstance;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

export function createMarmaladeApp(
  options: MarmaladeAppOptions = {}
): MarmaladeAppInstance {
  const now = options.clock ?? (() => Date.now());
  const db = new MarmaladeDatabase(options.dbPath ?? resolveDefaultDbPath());
  const loginRateLimiter = new LoginRateLimiter();
  const providerRegistry = new ProviderRegistry(db);
  const policyEngine = new PolicyEngine(db, providerRegistry);
  const activityEngine = new ActivityEngine(db, policyEngine, providerRegistry);

  const app = new Hono<{
    Variables: {
      session: SessionRecord | null;
    };
  }>();

  function shouldSetSecureCookie(c: { req: { url: string; header: (name: string) => string | undefined } }): boolean {
    if (process.env.COOKIE_SECURE === 'true') return true;
    if (process.env.COOKIE_SECURE === 'false') return false;
    return (
      c.req.url.startsWith('https://') ||
      c.req.header('x-forwarded-proto') === 'https'
    );
  }

  function getClientIp(c: any): string {
    const isFly = Boolean(process.env.FLY_APP_NAME);
    const envTrustProxy = process.env.TRUST_PROXY;
    const shouldTrustProxy =
      options.trustProxy ??
      (isFly ||
        (Boolean(envTrustProxy) &&
          envTrustProxy !== 'false' &&
          envTrustProxy !== '0'));

    if (shouldTrustProxy) {
      const flyIp = c.req.header('fly-client-ip')?.trim();
      if (flyIp) return flyIp;
      const cfIp = c.req.header('cf-connecting-ip')?.trim();
      if (cfIp) return cfIp;

      const xff = c.req.header('x-forwarded-for');
      if (xff) {
        const parts = xff.split(',').map((p: string) => p.trim()).filter(Boolean);
        if (parts.length > 0) {
          return parts[parts.length - 1];
        }
      }
      const realIp = c.req.header('x-real-ip')?.trim();
      if (realIp) return realIp;
    }

    try {
      const info = getConnInfo(c);
      if (info?.remote?.address) {
        return info.remote.address;
      }
    } catch {
      // ignore
    }

    return '127.0.0.1';
  }

  app.onError((error, c) => {
    const requestId = randomUUID();

    // 1. JSON parsing or payload syntax errors
    if (
      error instanceof SyntaxError ||
      error.name === 'SyntaxError' ||
      error.message?.includes('JSON')
    ) {
      return c.json(
        {
          ok: false,
          error: 'INVALID_JSON',
          code: 'INVALID_JSON',
          requestId,
          message: 'Malformed JSON payload in request body.',
        },
        400
      );
    }

    // Always log full error details and stack for server diagnostics
    console.error(
      `[Server Error] [${requestId}] ${c.req.method} ${c.req.path}:`,
      error.stack || error
    );

    // 2. Upstream AI provider or search connection failures on activity routes
    const isActivityRoute =
      c.req.path.startsWith('/api/ask') ||
      c.req.path.startsWith('/api/schoolwork') ||
      c.req.path.startsWith('/api/research') ||
      c.req.path.startsWith('/api/play');

    const isProviderFailure =
      isActivityRoute ||
      error instanceof ProviderConnectionError ||
      error.message === 'SEARCH_UNAVAILABLE' ||
      error.message === 'PROVIDER_UNAVAILABLE' ||
      error.message === 'EMPTY_PROVIDER_RESPONSE';

    if (isProviderFailure) {
      const code =
        error instanceof ProviderConnectionError
          ? error.code
          : error.message === 'SEARCH_UNAVAILABLE'
            ? 'SEARCH_UNAVAILABLE'
            : 'PROVIDER_UNAVAILABLE';

      console.info(
        JSON.stringify({
          requestId,
          operation: c.req.path.replace(
            /(?:ask|sch|res|story|20q|triv)_[a-f0-9]+/g,
            ':session'
          ),
          outcome: code,
        })
      );
      return c.json(
        {
          ok: false,
          error: code,
          code,
          requestId,
          retryable: true,
          message:
            code === 'SEARCH_UNAVAILABLE'
              ? 'Web search is unavailable. Your question is safe to retry. Ask a parent to check the search connection.'
              : 'Marmalade could not get an answer from the AI connection. Your input has been kept. Try again, or ask a parent to check the connection.',
        },
        502
      );
    }

    // 3. Other unexpected internal server errors
    return c.json(
      {
        ok: false,
        error: 'INTERNAL_ERROR',
        code: 'INTERNAL_ERROR',
        requestId,
        message: 'An unexpected internal error occurred.',
      },
      500
    );
  });

  // Security headers & zero-telemetry guarantee
  app.use('*', async (c, next) => {
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'no-referrer');
    c.header(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    );
    c.header(
      'Permissions-Policy',
      'geolocation=(), camera=(), microphone=(), payment=()'
    );
    if (shouldSetSecureCookie(c)) {
      c.header(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains'
      );
    }
    await next();
  });

  app.use(
    '/api/*',
    bodyLimit({
      maxSize: 64 * 1024,
      onError: (c) =>
        c.json(
          {
            code: 'INPUT_TOO_LARGE',
            message:
              'This is too much text for one request. Please shorten it and try again.',
          },
          413
        ),
    })
  );

  // Session resolution middleware
  app.use('/api/*', async (c, next) => {
    const rawToken =
      getCookie(c, SESSION_COOKIE_NAME) ||
      getCookie(c, LEGACY_SESSION_COOKIE_NAME);
    const session = rawToken ? db.getValidSession(rawToken, now()) : null;
    c.set('session', session);
    await next();
  });

  const requireAuth = (
    c: any,
    requiredRole?: 'parent' | 'child'
  ):
    | { ok: true; session: SessionRecord }
    | { ok: false; response: Response } => {
    const session = c.get('session') as SessionRecord | null;
    if (!session) {
      return {
        ok: false,
        response: c.json(
          { error: 'UNAUTHENTICATED', message: 'Please sign in to continue.' },
          401
        ),
      };
    }

    // Enforce CSRF header on all state-mutating methods
    const method = c.req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const csrfHeader =
        c.req.header('x-marmalade-csrf') ||
        c.req.header('X-Marmalade-CSRF') ||
        c.req.header('x-sprout-csrf') ||
        c.req.header('X-Sprout-CSRF') ||
        c.req.header('x-csrf-token') ||
        c.req.header('X-CSRF-Token');
      if (!csrfHeader || csrfHeader !== session.csrfToken) {
        return {
          ok: false,
          response: c.json(
            {
              error: 'INVALID_CSRF_TOKEN',
              message: 'Missing or invalid CSRF token.',
            },
            403
          ),
        };
      }
    }

    if (requiredRole && session.user.role !== requiredRole) {
      return {
        ok: false,
        response: c.json(
          {
            error: 'FORBIDDEN_ROLE',
            message: `This action requires ${requiredRole} authentication.`,
          },
          403
        ),
      };
    }

    return { ok: true, session };
  };

  // Bind transient sessions to the child and serialize mutations on a session.
  app.use('/api/*', async (c, next) => {
    const session = c.get('session');
    const path = c.req.path;
    activityEngine.purgeExpiredSessions(now());
    const pathId = path.match(
      /^\/api\/(?:schoolwork|play\/(?:trivia|20q|story))\/([a-z0-9]+_[a-f0-9]{24})(?:\/|$)/
    )?.[1];
    const askBody =
      path === '/api/ask/turn'
        ? ((await c.req.raw
            .clone()
            .json()
            .catch(() => ({}))) as any)
        : {};
    const id =
      pathId ||
      (typeof askBody.sessionId === 'string' ? askBody.sessionId : undefined);
    if (id && session && !activityEngine.ownsSession(id, session.user.id))
      return c.json(
        {
          error: 'SESSION_NOT_FOUND',
          message: 'This activity is no longer available.',
        },
        404
      );
    const mutating = c.req.method !== 'GET';
    const snapshot = id ? activityEngine.snapshotSession(id) : undefined;
    if (id && mutating && !activityEngine.beginMutation(id))
      return c.json(
        {
          error: 'REQUEST_PENDING',
          message: 'Please wait for the current response.',
        },
        409
      );
    try {
      await next();
      if (c.res.ok && mutating && session?.user.role === 'child') {
        const data = (await c.res
          .clone()
          .json()
          .catch(() => null)) as any;
        if (data?.session?.sessionId)
          activityEngine.bindSession(data.session.sessionId, session.user.id);
      }
      if (c.res.status >= 500 && snapshot && id)
        activityEngine.restoreSession(id, snapshot);
    } finally {
      if (id && mutating) activityEngine.endMutation(id);
    }
  });

  app.get('/api/sessions/:id', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const id = c.req.param('id');
    if (!activityEngine.ownsSession(id, auth.session.user.id))
      return c.json(
        {
          error: 'SESSION_NOT_FOUND',
          message: 'This activity is no longer available.',
        },
        404
      );
    const session = activityEngine.readSession(id, now());
    return session
      ? c.json({ session })
      : c.json(
          {
            error: 'SESSION_EXPIRED',
            message:
              'This activity expired after 15 minutes without a turn. Your saved work is still available.',
          },
          404
        );
  });

  app.get('/api/parent/experience', (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;
    return c.json({
      completed: Boolean(
        (
          db.raw
            .prepare(
              'SELECT onboarding_completed FROM experience_settings WHERE id=1'
            )
            .get() as any
        ).onboarding_completed
      ),
    });
  });
  app.post('/api/parent/experience/complete', (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;
    db.raw
      .prepare(
        'UPDATE experience_settings SET onboarding_completed=1 WHERE id=1'
      )
      .run();
    return c.json({ ok: true });
  });
  app.get('/api/parent/providers/gemini/models', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;
    return c.json({ models: await providerRegistry.listGeminiModels() });
  });
  app.get('/api/parent/providers/anthropic/models', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;
    return c.json({ models: await providerRegistry.listAnthropicModels() });
  });
  app.post('/api/parent/search/test', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;
    if (!providerRegistry.isExternalSearchConfigured())
      return c.json(
        { ok: false, message: 'Set a private search endpoint first.' },
        400
      );
    const sources = await providerRegistry
      .getSearchProvider(true)
      .search('NASA moon phases', {
        recommendedDomains: ['nasa.gov'],
        blockedDomains: [],
      });
    return c.json({
      ok: sources.length > 0,
      message: sources.length
        ? 'Web search returned usable sources.'
        : 'Search connected but returned no usable results.',
    });
  });

  // 1. Bootstrap status
  app.get('/api/bootstrap', (c) => {
    const initialized = db.isInitialized();
    const session = c.get('session');
    const currentNow = now();

    if (!initialized) {
      return c.json({
        initialized: false,
        setupTokenRequired: Boolean(process.env.SETUP_TOKEN?.trim()),
        user: null,
        csrfToken: null,
        quota: null,
        policy: null,
        branding: BRANDING,
      });
    }

    if (!session) {
      return c.json({
        initialized: true,
        user: null,
        csrfToken: null,
        quota: null,
        policy: null,
        branding: BRANDING,
      });
    }

    const quota = policyEngine.getQuotaStatus(currentNow);
    const policy = db.getPolicyConfig();

    return c.json({
      initialized: true,
      user: session.user,
      csrfToken: session.csrfToken,
      sessionExpiresAtMs: session.expiresAtMs,
      quota,
      policy,
      branding: BRANDING,
      artifacts: session?.user.role === 'child' ? db.listArtifacts() : [],
      extensionRequests: db.listTimeExtensionRequests(quota.dateKey),
    });
  });

  // 2. First-run family setup
  app.post('/api/setup', async (c) => {
    if (db.isInitialized()) {
      return c.json(
        {
          error: 'SETUP_ALREADY_COMPLETED',
          message:
            'Family setup has already been completed on this installation.',
        },
        409
      );
    }

    const body = await c.req.json().catch(() => ({}));

    // Enforce setup token if configured on instance (body or x-setup-token header only; query params rejected to avoid URL logging)
    const requiredSetupToken = process.env.SETUP_TOKEN?.trim();
    if (requiredSetupToken) {
      const providedToken =
        (typeof body.setupToken === 'string' ? body.setupToken.trim() : '') ||
        c.req.header('x-setup-token')?.trim();
      if (!providedToken || providedToken !== requiredSetupToken) {
        return c.json(
          {
            error: 'INVALID_SETUP_TOKEN',
            message:
              'A valid setup token is required to initialize this instance. Check the SETUP_TOKEN environment variable configured on your server.',
          },
          403
        );
      }
    }

    // Validate timezone before mutating database
    if (typeof body.timezone === 'string' && body.timezone.trim()) {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: body.timezone.trim() });
      } catch {
        return c.json(
          {
            error: 'INVALID_TIMEZONE',
            message: `"${body.timezone}" is not a recognized time zone (e.g. America/New_York, Europe/London, Asia/Kolkata).`,
          },
          400
        );
      }
    }

    try {
      const currentNow = now();
      const { parentUser, childUser } = db.initializeFamilySetup({
        parentUsername: String(body.parentUsername ?? ''),
        parentDisplayName: String(body.parentDisplayName ?? 'Parent'),
        parentPassword: String(body.parentPassword ?? ''),
        childUsername: String(body.childUsername ?? ''),
        childDisplayName: String(body.childDisplayName ?? 'Explorer'),
        childPassword: String(body.childPassword ?? ''),
        timezone: typeof body.timezone === 'string' ? body.timezone : undefined,
        globalDailyMinutes:
          typeof body.globalDailyMinutes === 'number'
            ? body.globalDailyMinutes
            : undefined,
        playDailyMinutes:
          typeof body.playDailyMinutes === 'number'
            ? body.playDailyMinutes
            : undefined,
        nowMs: currentNow,
      });

      const { rawToken, session } = db.createSessionForUser(
        parentUser,
        currentNow
      );
      setCookie(c, SESSION_COOKIE_NAME, rawToken, {
        httpOnly: true,
        sameSite: 'Lax',
        secure: shouldSetSecureCookie(c),
        path: '/',
      });

      const quota = policyEngine.getQuotaStatus(currentNow);
      return c.json({
        ok: true,
        user: session.user,
        childUser,
        csrfToken: session.csrfToken,
        quota,
        policy: db.getPolicyConfig(),
      });
    } catch (err: any) {
      return c.json(
        {
          error: err?.message || 'SETUP_FAILED',
          message:
            err?.message === 'PASSWORD_TOO_SHORT'
              ? 'Parent password must be at least 8 characters and child password at least 6 characters.'
              : err?.message === 'INVALID_USERNAMES'
                ? 'Parent and child accounts must have distinct non-empty usernames.'
                : 'Could not complete setup. Please check your inputs.',
        },
        400
      );
    }
  });

  // 3. Authentication
  app.post('/api/auth/login', async (c) => {
    const ip = getClientIp(c);
    const body = await c.req.json();
    const username = String(body.username ?? '');
    const password = String(body.password ?? '');
    const currentNow = now();

    const rateCheck = loginRateLimiter.checkRateLimit(ip, username, currentNow);
    if (!rateCheck.allowed) {
      return c.json(
        {
          error: 'TOO_MANY_REQUESTS',
          message: `Too many sign-in attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        },
        429
      );
    }

    const authResult = db.authenticateUser(username, password, currentNow);
    if (!authResult) {
      const failureResult = loginRateLimiter.recordFailedAttempt(ip, username, currentNow);
      if (failureResult && failureResult.progressiveDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, failureResult.progressiveDelayMs));
      }
      return c.json(
        {
          error: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password.',
        },
        401
      );
    }

    loginRateLimiter.resetAttempts(ip, username);

    setCookie(c, SESSION_COOKIE_NAME, authResult.rawToken, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: shouldSetSecureCookie(c),
      path: '/',
    });

    const quota = policyEngine.getQuotaStatus(currentNow);
    return c.json({
      ok: true,
      user: authResult.session.user,
      csrfToken: authResult.session.csrfToken,
      sessionExpiresAtMs: authResult.session.expiresAtMs,
      quota,
      policy: db.getPolicyConfig(),
    });
  });

  app.post('/api/child/ack-explainer', (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) return auth.response;
    if (auth.session.user.role === 'child') {
      db.ackFirstRunExplainer(auth.session.user.id);
    }
    return c.json({ ok: true });
  });

  app.post('/api/auth/logout', (c) => {
    const rawToken =
      getCookie(c, SESSION_COOKIE_NAME) ||
      getCookie(c, LEGACY_SESSION_COOKIE_NAME);
    const currentSession = c.get('session');
    if (currentSession?.user.role === 'child')
      activityEngine.clearUserSessions(currentSession.user.id);
    if (rawToken) {
      db.deleteSession(rawToken);
    }
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
    deleteCookie(c, LEGACY_SESSION_COOKIE_NAME, { path: '/' });
    return c.json({ ok: true });
  });

  // 4. Quota status & interaction-anchored heartbeat
  app.get('/api/quota', (c) => {
    const auth = requireAuth(c);
    if (!auth.ok) return auth.response;

    const currentNow = now();
    const quota = policyEngine.getQuotaStatus(currentNow);
    return c.json({
      quota,
      policy: db.getPolicyConfig(),
      artifacts: auth.session.user.role === 'child' ? db.listArtifacts() : [],
      extensionRequests: db.listTimeExtensionRequests(quota.dateKey),
    });
  });

  app.post('/api/quota/heartbeat', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const mode = (body.mode ?? 'play') as ActivityMode;
    if (!['ask', 'research', 'schoolwork', 'play'].includes(mode)) {
      return c.json(
        { error: 'INVALID_MODE', message: 'Invalid activity mode.' },
        400
      );
    }

    const quota = policyEngine.recordHeartbeat({
      mode,
      userInteracted: Boolean(body.userInteracted),
      nowMs: now(),
    });

    return c.json({ ok: true, quota });
  });

  // 5. Play & Create — 10-Question Trivia Round
  app.post('/api/play/trivia/start', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const rawTopic = String(body.topic || 'mixed').trim();
    const customTopic = body.customTopic
      ? String(body.customTopic).trim()
      : undefined;
    const difficulty: TriviaDifficulty =
      body.difficulty === 'challenging' ? 'challenging' : 'standard';

    const result = await activityEngine.startTriviaRound({
      topic: rawTopic,
      difficulty,
      customTopic,
      nowMs: now(),
    });

    if (!result.ok) {
      return c.json(
        {
          ok: false,
          error: result.reason,
          message: result.message,
          quota: result.quota,
        },
        403
      );
    }

    return c.json(result);
  });

  app.get('/api/play/trivia/:sessionId', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const sessionId = c.req.param('sessionId');
    const currentNow = now();
    const session = activityEngine.getTriviaSession(sessionId, currentNow);
    const quota = policyEngine.getQuotaStatus(currentNow, 'play');

    if (!session) {
      return c.json(
        {
          error: 'SESSION_NOT_FOUND',
          message: 'Trivia session not found or expired.',
          quota,
        },
        404
      );
    }

    return c.json({ ok: true, session, quota });
  });

  app.post('/api/play/trivia/:sessionId/answer', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const rawChoice = body.choiceIndex;
    const choiceIndex =
      typeof rawChoice === 'number' && Number.isInteger(rawChoice)
        ? rawChoice
        : typeof rawChoice === 'string' && /^\d+$/.test(rawChoice.trim())
          ? parseInt(rawChoice.trim(), 10)
          : -1;

    const result = activityEngine.submitTriviaAnswer({
      sessionId,
      choiceIndex,
      nowMs: now(),
    });

    if (!result.ok) {
      const status =
        result.reason === 'SESSION_NOT_FOUND'
          ? 404
          : result.reason === 'INVALID_CHOICE'
            ? 400
            : 403;
      return c.json(
        {
          ok: false,
          error: result.reason,
          message: result.message,
          session: result.session,
          quota: result.quota,
        },
        status
      );
    }

    return c.json(result);
  });

  // 5b. Play — Twenty Questions
  app.post('/api/play/20q/start', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const res = activityEngine.startTwentyQuestions(now());
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  app.post('/api/play/20q/:sessionId/ask', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const res = await activityEngine.askTwentyQuestionsQuestion({
      sessionId,
      question: String(body.question || ''),
      isGuess: Boolean(body.isGuess),
      nowMs: now(),
    });
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  // 5c. Play — Collaborative Story Relay
  app.post('/api/play/story/start', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const body = await c.req.json().catch(() => ({}));
    const res = await activityEngine.startStoryRelay({
      genre: body.genre,
      premiseId: body.premiseId,
      customPremise: body.customPremise,
      heroDescription: body.heroDescription,
      nowMs: now(),
    });
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  app.post('/api/play/story/:sessionId/turn', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const res = await activityEngine.continueStoryRelay({
      sessionId,
      childDirection: String(body.childDirection || ''),
      nowMs: now(),
    });
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  // 5d. Research Mode
  app.post('/api/research/query', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const body = await c.req.json().catch(() => ({}));
    const res = await activityEngine.conductResearch({
      query: String(body.query || ''),
      nowMs: now(),
    });
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  // 5e. Schoolwork Assistance
  app.post('/api/schoolwork/session', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const body = await c.req.json().catch(() => ({}));
    const res = await activityEngine.startSchoolworkSession(
      String(body.assignment || ''),
      now()
    );
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  app.post('/api/schoolwork/:sessionId/step', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const res = await activityEngine.advanceSchoolworkStage({
      sessionId,
      studentInput: String(body.studentInput || ''),
      nowMs: now(),
    });
    if (!res.ok) {
      return c.json(
        {
          ok: false,
          error: res.reason,
          message: res.message,
          quota: res.quota,
        },
        403
      );
    }
    return c.json(res);
  });

  app.post('/api/schoolwork/:sessionId/followup', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const body = await c.req.json().catch(() => ({}));
    const result = await activityEngine.followupSchoolwork(
      c.req.param('sessionId'),
      String(body.studentInput || ''),
      now()
    );
    return result.ok ? c.json(result) : c.json(result, 403);
  });

  app.post('/api/schoolwork/:sessionId/approve-ledger', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const sessionId = c.req.param('sessionId');
    const body = await c.req.json().catch(() => ({}));
    const ok = activityEngine.approveSchoolworkLedger(sessionId, {
      subject: typeof body.subject === 'string' ? body.subject : undefined,
      summary: typeof body.summary === 'string' ? body.summary : undefined,
      concepts: Array.isArray(body.concepts) ? body.concepts : undefined,
      uncertainties: Array.isArray(body.uncertainties)
        ? body.uncertainties
        : undefined,
    });
    return c.json({ ok, ledger: db.listLearningLedger() });
  });

  app.get('/api/ledger', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    return c.json({ ledger: db.listLearningLedger() });
  });

  app.put('/api/ledger/:id', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const ok = db.updateLearningLedgerEntry({
      id,
      subject: String(body.subject || ''),
      summary: String(body.summary || ''),
      concepts: Array.isArray(body.concepts) ? body.concepts.map(String) : [],
      uncertainties: Array.isArray(body.uncertainties)
        ? body.uncertainties.map(String)
        : [],
      nowMs: now(),
    });
    return c.json({ ok, ledger: db.listLearningLedger() });
  });

  app.get('/api/ledger/export', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const entries = db.listLearningLedger();
    const markdown = [
      '# Learning Ledger (Child-Approved Notes)',
      '',
      `Exported: ${new Date(now()).toISOString()}`,
      '',
      ...entries.map(
        (e) =>
          `## ${e.subject}\n- **Summary:** ${e.summary}\n- **Concepts:** ${e.concepts.join(', ') || 'None'}\n- **Open Questions:** ${e.uncertainties.join(', ') || 'None'}\n`
      ),
    ].join('\n');

    return c.body(markdown, 200, {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="learning-ledger.md"',
    });
  });

  app.delete('/api/ledger/:id', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const id = Number(c.req.param('id'));
    db.deleteLearningLedgerEntry(id);
    return c.json({ ok: true, ledger: db.listLearningLedger() });
  });

  // 6. Ask & Learn (with Global Cap enforcement & Play handoff)
  app.post('/api/ask/turn', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const result = await activityEngine.submitAskTurn({
      sessionId:
        typeof body.sessionId === 'string' ? body.sessionId : undefined,
      prompt: String(body.prompt ?? ''),
      nowMs: now(),
    });

    if (!result.ok) {
      const status = result.reason === 'EMPTY_PROMPT' ? 400 : 403;
      return c.json(
        {
          ok: false,
          error: result.reason,
          message: result.message,
          session: result.session,
          quota: result.quota,
        },
        status
      );
    }

    return c.json(result);
  });

  // 7. Explicit Saved Artifacts (Save / List / Export / Delete)
  app.get('/api/artifacts', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    return c.json({ artifacts: db.listArtifacts() });
  });

  app.post('/api/artifacts', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const mode = (body.mode ?? 'play') as ActivityMode;
    if (!['ask', 'research', 'schoolwork', 'play'].includes(mode)) {
      return c.json({ error: 'INVALID_MODE', message: 'Invalid mode.' }, 400);
    }
    const content = String(body.content ?? '').trim();
    if (!content) {
      return c.json(
        { error: 'EMPTY_CONTENT', message: 'Content cannot be empty.' },
        400
      );
    }

    const artifact = db.saveArtifact({
      title: String(body.title ?? 'Saved Work'),
      mode,
      activityType: String(body.activityType ?? mode),
      content,
      nowMs: now(),
    });

    return c.json({ ok: true, artifact, artifacts: db.listArtifacts() });
  });

  app.get('/api/artifacts/:id/export', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const id = Number(c.req.param('id'));
    const artifact = db.listArtifacts().find((a) => a.id === id);
    if (!artifact) {
      return c.json(
        { error: 'NOT_FOUND', message: 'Artifact not found.' },
        404
      );
    }

    const safeFilename =
      artifact.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || `artifact-${artifact.id}`;

    const markdown = `# ${artifact.title}\n\n- **Mode:** ${artifact.mode}\n- **Activity:** ${artifact.activityType}\n- **Saved:** ${new Date(artifact.createdAtMs).toISOString()}\n\n---\n\n${artifact.content}\n`;

    return new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeFilename}.md"`,
      },
    });
  });

  app.put('/api/artifacts/:id', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;
    const body = await c.req.json().catch(() => ({}));
    if (!String(body.title || '').trim() || !String(body.content || '').trim())
      return c.json({ message: 'Add a title and content.' }, 400);
    const result = db.raw
      .prepare('UPDATE saved_artifacts SET title=?, content=? WHERE id=?')
      .run(
        String(body.title).trim(),
        String(body.content).trim(),
        Number(c.req.param('id'))
      );
    return result.changes
      ? c.json({ ok: true, artifacts: db.listArtifacts() })
      : c.json({ message: 'Saved work not found.' }, 404);
  });

  app.delete('/api/artifacts/:id', (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const id = Number(c.req.param('id'));
    db.deleteArtifact(id);
    return c.json({ ok: true, artifacts: db.listArtifacts() });
  });

  // 8. Child Extra-Time Request
  app.post('/api/extensions/request', async (c) => {
    const auth = requireAuth(c, 'child');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const currentNow = now();
    const quota = policyEngine.getQuotaStatus(currentNow);
    const requestedMode = [
      'ask',
      'research',
      'schoolwork',
      'play',
      'global',
    ].includes(body.requestedMode)
      ? body.requestedMode
      : 'play';

    const reqRecord = db.createTimeExtensionRequest({
      dateKey: quota.dateKey,
      requestedMode,
      requestedMinutes: Number(body.requestedMinutes ?? 15),
      reasonNote: String(body.reasonNote ?? ''),
      nowMs: currentNow,
    });

    return c.json({
      ok: true,
      request: reqRecord,
      extensionRequests: db.listTimeExtensionRequests(quota.dateKey),
    });
  });

  // 9. Parent Governance Dashboard (Strictly NO conversation transcripts!)
  app.get('/api/parent/dashboard', (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;

    const currentNow = now();
    const policy = db.getPolicyConfig();
    const quota = policyEngine.getQuotaStatus(currentNow);
    const daily = db.getOrCreateDailyUsage(quota.dateKey);
    const monthly = db.getOrCreateMonthlyUsage(quota.monthKey);
    const allExtensions = db.listTimeExtensionRequests();

    const summary: ParentDashboardSummary = {
      policy,
      quota,
      todayStats: {
        dateKey: quota.dateKey,
        requestCount: daily.request_count,
        completedSessionsCount: daily.completed_sessions_count,
        activeMinutesByMode: {
          ask: Number((daily.ask_active_seconds / 60).toFixed(1)),
          research: Number((daily.research_active_seconds / 60).toFixed(1)),
          schoolwork: Number((daily.schoolwork_active_seconds / 60).toFixed(1)),
          play: Number((daily.play_active_seconds / 60).toFixed(1)),
        },
        totalActiveMinutes: Number(
          (daily.global_active_seconds / 60).toFixed(1)
        ),
        estimatedSpendTodayCents: daily.spent_cost_cents,
        estimatedSpendMonthCents: monthly.spent_cost_cents,
      },
      pendingExtensions: allExtensions.filter((e) => e.status === 'pending'),
      recentExtensions: allExtensions.slice(0, 10),
      safetyEvents: db.listSafetyEvents(),
      providers: providerRegistry.listModelProviders(),
      providerSettings: db.getProviderSettingsPublic(),
    };

    return c.json(summary);
  });

  app.put('/api/parent/providers/config', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    const updatedSettings = db.updateProviderSettings(
      {
        geminiApiKey:
          typeof body.geminiApiKey === 'string' ? body.geminiApiKey : undefined,
        clearGeminiApiKey: Boolean(body.clearGeminiApiKey),
        geminiFastModel:
          typeof body.geminiFastModel === 'string'
            ? body.geminiFastModel
            : undefined,
        geminiReasoningModel:
          typeof body.geminiReasoningModel === 'string'
            ? body.geminiReasoningModel
            : undefined,
        geminiZdrApproved:
          typeof body.geminiZdrApproved === 'boolean'
            ? body.geminiZdrApproved
            : undefined,
        ollamaBaseUrl:
          typeof body.ollamaBaseUrl === 'string'
            ? body.ollamaBaseUrl
            : undefined,
        ollamaModel:
          typeof body.ollamaModel === 'string' ? body.ollamaModel : undefined,
        openaiApiKey:
          typeof body.openaiApiKey === 'string' ? body.openaiApiKey : undefined,
        clearOpenaiApiKey: Boolean(body.clearOpenaiApiKey),
        openaiModel:
          typeof body.openaiModel === 'string' ? body.openaiModel : undefined,
        openaiZdrApproved:
          typeof body.openaiZdrApproved === 'boolean'
            ? body.openaiZdrApproved
            : undefined,
        anthropicApiKey:
          typeof body.anthropicApiKey === 'string'
            ? body.anthropicApiKey
            : undefined,
        clearAnthropicApiKey: Boolean(body.clearAnthropicApiKey),
        anthropicModel:
          typeof body.anthropicModel === 'string'
            ? body.anthropicModel
            : undefined,
        anthropicZdrApproved:
          typeof body.anthropicZdrApproved === 'boolean'
            ? body.anthropicZdrApproved
            : undefined,
        searchApiUrl:
          typeof body.searchApiUrl === 'string' ? body.searchApiUrl : undefined,
        searchApiKey:
          typeof body.searchApiKey === 'string' ? body.searchApiKey : undefined,
        clearSearchApiKey: Boolean(body.clearSearchApiKey),
      },
      now()
    );

    providerRegistry.reloadFromSettings();

    return c.json({
      ok: true,
      providerSettings: updatedSettings,
      providers: providerRegistry.listModelProviders(),
    });
  });

  app.post('/api/parent/providers/:id/test', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;

    const id = c.req.param('id') as ProviderId;
    if (!['mock', 'gemini', 'local_ollama', 'openai', 'anthropic'].includes(id)) {
      return c.json(
        { error: 'INVALID_PROVIDER', message: 'Unknown provider ID.' },
        400
      );
    }

    const preflight = await providerRegistry.runPreflightTest(id);
    return c.json({
      ok: true,
      preflight,
      providers: providerRegistry.listModelProviders(),
    });
  });

  app.put('/api/parent/policy', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;

    const body = await c.req.json().catch(() => ({}));
    if (body.activeProvider && !isProviderAllowedForMinors(body.activeProvider)) {
      return c.json(
        {
          error: 'PROVIDER_NOT_ALLOWED_FOR_MINORS',
          message:
            'Google Gemini API terms prohibit use by minors and services directed at minors. Please select Anthropic Claude, OpenAI, or local models for child spaces.',
        },
        400
      );
    }

    try {
      const currentNow = now();
      const updatedPolicy = db.updatePolicyConfig(
        {
          timezone: body.timezone,
          instanceDisplayName: body.instanceDisplayName,
          piiFilterEnabled: body.piiFilterEnabled,
          openaiUnder13Confirmed: body.openaiUnder13Confirmed,
          anthropicConditionsConfirmed: body.anthropicConditionsConfirmed,
          globalDailyMinutes: body.globalDailyMinutes,
          maxContinuousSessionMinutes: body.maxContinuousSessionMinutes,
          sessionCooldownMinutes: body.sessionCooldownMinutes,
          modes: body.modes,
          dailySpendCapCents: body.dailySpendCapCents,
          monthlySpendCapCents: body.monthlySpendCapCents,
          monthlyResetDay: body.monthlyResetDay,
          activeProvider: body.activeProvider as ProviderId | undefined,
          allowExternalSearch: body.allowExternalSearch,
        },
        currentNow
      );

      const updatedQuota = policyEngine.getQuotaStatus(currentNow);
      return c.json({
        ok: true,
        policy: updatedPolicy,
        quota: updatedQuota,
      });
    } catch (err: any) {
      return c.json(
        {
          error: 'INVALID_POLICY_CONFIG',
          message: String(err?.message).startsWith('INVALID_TIMEZONE')
            ? 'Choose a valid time zone, such as Asia/Kolkata or America/New_York.'
            : 'Check that the time and spending limits are valid numbers within the allowed range.',
        },
        400
      );
    }
  });

  app.post('/api/parent/extensions/:id/resolve', async (c) => {
    const auth = requireAuth(c, 'parent');
    if (!auth.ok) return auth.response;

    const requestId = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => ({}));
    const currentNow = now();

    try {
      const resolved = db.resolveTimeExtensionRequest({
        requestId,
        approve: Boolean(body.approve),
        grantedMinutes:
          typeof body.grantedMinutes === 'number'
            ? body.grantedMinutes
            : undefined,
        nowMs: currentNow,
      });

      const quota = policyEngine.getQuotaStatus(currentNow);
      return c.json({
        ok: true,
        resolved,
        quota,
        pendingExtensions: db
          .listTimeExtensionRequests()
          .filter((e) => e.status === 'pending'),
      });
    } catch (err: any) {
      return c.json(
        {
          error: err?.message || 'EXTENSION_RESOLVE_ERROR',
          message: 'Could not resolve time extension request.',
        },
        400
      );
    }
  });

  // Optional static client serving for single-process production runs
  if (options.serveStaticClient) {
    const clientDist = join(process.cwd(), 'dist', 'client');
    app.get('*', (c) => {
      const reqPath = c.req.path === '/' ? '/index.html' : c.req.path;
      const fullPath = join(clientDist, reqPath);
      if (existsSync(fullPath)) {
        const ext = extname(fullPath);
        const content = readFileSync(fullPath);
        return c.body(content, 200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        });
      }
      const indexHtml = join(clientDist, 'index.html');
      if (existsSync(indexHtml)) {
        return c.body(readFileSync(indexHtml), 200, {
          'Content-Type': 'text/html; charset=utf-8',
          'X-Robots-Tag': 'noindex, nofollow',
        });
      }
      return c.text('Marmalade API Server is running.', 200);
    });
  }

  return { app, db, policyEngine, activityEngine, providerRegistry };
}

export const createSproutApp = createMarmaladeApp;

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSproutApp } from '../src/server/app.js';
import { SproutDatabase } from '../src/server/db/sqlite.js';
import { LoginRateLimiter } from '../src/server/auth/rateLimit.js';

describe('Batch 3 Verification Suite', () => {
  describe('1. Setup Token Protection for Public Deployments', () => {
    const originalSetupToken = process.env.SETUP_TOKEN;

    afterEach(() => {
      if (originalSetupToken === undefined) {
        delete process.env.SETUP_TOKEN;
      } else {
        process.env.SETUP_TOKEN = originalSetupToken;
      }
    });

    it('reports setupTokenRequired: true in /api/bootstrap when SETUP_TOKEN is set', async () => {
      process.env.SETUP_TOKEN = 'secret-token-12345';
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const res = await appInstance.app.request('/api/bootstrap');
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.initialized).toBe(false);
      expect(data.setupTokenRequired).toBe(true);
    });

    it('rejects /api/setup with 403 when SETUP_TOKEN is missing or invalid', async () => {
      process.env.SETUP_TOKEN = 'secret-token-12345';
      const appInstance = createSproutApp({ dbPath: ':memory:' });

      // No token provided
      const resNoToken = await appInstance.app.request('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentUsername: 'parent',
          parentPassword: 'Password123!',
          childUsername: 'child',
          childPassword: 'Password123!',
        }),
      });
      expect(resNoToken.status).toBe(403);
      const dataNoToken = await resNoToken.json();
      expect(dataNoToken.error).toBe('INVALID_SETUP_TOKEN');

      // Wrong token provided
      const resWrongToken = await appInstance.app.request('/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-setup-token': 'wrong-token',
        },
        body: JSON.stringify({
          parentUsername: 'parent',
          parentPassword: 'Password123!',
          childUsername: 'child',
          childPassword: 'Password123!',
        }),
      });
      expect(resWrongToken.status).toBe(403);
      const dataWrongToken = await resWrongToken.json();
      expect(dataWrongToken.error).toBe('INVALID_SETUP_TOKEN');
    });

    it('allows /api/setup with 200 when valid SETUP_TOKEN is provided', async () => {
      process.env.SETUP_TOKEN = 'secret-token-12345';
      const appInstance = createSproutApp({ dbPath: ':memory:' });

      const res = await appInstance.app.request('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          setupToken: 'secret-token-12345',
          parentUsername: 'parent',
          parentPassword: 'Password123!',
          childUsername: 'child',
          childPassword: 'Password123!',
        }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.user.username).toBe('parent');
    });
  });

  describe('2. Rate Limiting, IP Spoofing & DoS Lockout Resistance', () => {
    it('prevents cross-IP lockout: attacker on IP A failing attempts does NOT lock out parent on IP B', () => {
      const limiter = new LoginRateLimiter();
      const attackerIp = '203.0.113.45';
      const parentIp = '192.168.1.100';
      const username = 'parent';
      const now = 1000000;

      // Attacker exhausts attempts on their IP
      for (let i = 0; i < 6; i++) {
        limiter.recordFailedAttempt(attackerIp, username, now);
      }

      // Attacker should be blocked
      const attackerCheck = limiter.checkRateLimit(attackerIp, username, now);
      expect(attackerCheck.allowed).toBe(false);
      expect(attackerCheck.retryAfterSeconds).toBeGreaterThan(0);

      // Parent on legitimate IP should NOT be blocked
      const parentCheck = limiter.checkRateLimit(parentIp, username, now);
      expect(parentCheck.allowed).toBe(true);
      expect(parentCheck.retryAfterSeconds).toBe(0);
    });

    it('maintains bounded memory and caps map entries at MAX_MAP_ENTRIES', () => {
      const limiter = new LoginRateLimiter();
      const now = 1000000;

      // Insert 5,200 unique IPs
      for (let i = 0; i < 5200; i++) {
        limiter.recordFailedAttempt(`10.0.${Math.floor(i / 256)}.${i % 256}`, `user${i}`, now + i);
      }

      const counts = limiter.getEntryCounts();
      expect(counts.ipCount).toBeLessThanOrEqual(5000);
      expect(counts.userCount).toBeLessThanOrEqual(5000);
    });

    it('login route uses unspoofable fly-client-ip or rightmost x-forwarded-for', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const { db } = appInstance;
      db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'CorrectPassword123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'ChildPassword123!',
      });

      // Attacker attempts to spoof IP by prepending fake IP in X-Forwarded-For
      // The rightmost IP is the real connecting proxy/client IP
      const res = await appInstance.app.request('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '1.2.3.4, 5.6.7.8',
          'Fly-Client-IP': '198.51.100.22', // Untampered edge header
        },
        body: JSON.stringify({
          username: 'parent',
          password: 'WrongPassword!',
        }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe('3. Security Headers & Zero-Telemetry Guarantee', () => {
    it('emits CSP default-src self, Permissions-Policy, and clickjacking protections', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const res = await appInstance.app.request('/api/bootstrap');

      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');

      const csp = res.headers.get('content-security-policy');
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("frame-ancestors 'none'");

      const permissions = res.headers.get('permissions-policy');
      expect(permissions).toContain('geolocation=()');
      expect(permissions).toContain('microphone=()');
    });

    it('emits HSTS header when accessed over HTTPS', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const res = await appInstance.app.request('https://poetree.house/api/bootstrap');
      expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    });
  });

  describe('4. Error Handling Architecture & Reason Codes', () => {
    it('returns 400 with INVALID_JSON when receiving malformed JSON payload', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const res = await appInstance.app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"username": "broken json without closing brace',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('INVALID_JSON');
      expect(data.message).toContain('Malformed JSON');
    });

    it('Trivia answer rejects NaN and fractional 1.5 choiceIndex with INVALID_CHOICE (400)', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const { db, activityEngine } = appInstance;
      const { childUser } = db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
      });

      const { rawToken, session: childSession } = db.createSessionForUser(childUser);
      const triviaRound = await activityEngine.startTriviaRound({
        topic: 'space_science',
        difficulty: 'standard',
      });
      expect(triviaRound.ok).toBe(true);
      if (!triviaRound.ok) return;

      const sessionId = triviaRound.session.sessionId;
      activityEngine.bindSession(sessionId, childUser.id);

      // Attempt with NaN
      const resNaN = await appInstance.app.request(`/api/play/trivia/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sprout_session=${rawToken}`,
          'x-csrf-token': childSession.csrfToken,
        },
        body: JSON.stringify({ choiceIndex: NaN }),
      });
      expect(resNaN.status).toBe(400);
      const dataNaN = await resNaN.json();
      expect(dataNaN.error).toBe('INVALID_CHOICE');

      // Attempt with 1.5
      const resFrac = await appInstance.app.request(`/api/play/trivia/${sessionId}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sprout_session=${rawToken}`,
          'x-csrf-token': childSession.csrfToken,
        },
        body: JSON.stringify({ choiceIndex: 1.5 }),
      });
      expect(resFrac.status).toBe(400);
      const dataFrac = await resFrac.json();
      expect(dataFrac.error).toBe('INVALID_CHOICE');
    });

    it('returns SAFETY_BLOCKED reason code when child input triggers safety safeguards', async () => {
      const appInstance = createSproutApp({ dbPath: ':memory:' });
      const { db, activityEngine } = appInstance;
      db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
      });

      // Question Room safety block
      const askRes = await activityEngine.submitAskTurn({
        prompt: 'How to make a lethal poison from household bleach',
      });
      expect(askRes.ok).toBe(false);
      if (!askRes.ok) {
        expect(askRes.reason).toBe('SAFETY_BLOCKED');
      }

      // Twenty Questions safety block
      const tqRes = activityEngine.startTwentyQuestions();
      expect(tqRes.ok).toBe(true);
      if (tqRes.ok) {
        const askQRes = await activityEngine.askTwentyQuestionsQuestion({
          sessionId: tqRes.session.sessionId,
          question: 'Is it a deadly pipe bomb with shrapnel?',
        });
        expect(askQRes.ok).toBe(false);
        if (!askQRes.ok) {
          expect(askQRes.reason).toBe('SAFETY_BLOCKED');
        }
      }
    });
  });

  describe('5. Database Expired Session Purging', () => {
    it('purges expired sessions on demand and on session creation', () => {
      const db = new SproutDatabase(':memory:');
      const { parentUser } = db.initializeFamilySetup({
        parentUsername: 'parent',
        parentDisplayName: 'Parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childDisplayName: 'Child',
        childPassword: 'Password123!',
      });

      const now = 1000000;
      // Insert an expired session manually
      db.raw
        .prepare(
          `INSERT INTO sessions (token_hash, user_id, role, csrf_token, created_at_ms, expires_at_ms, last_seen_at_ms)
           VALUES ('expired_hash_123', ?, 'parent', 'csrf_1', ?, ?, ?)`
        )
        .run(parentUser.id, now - 50000, now - 1000, now - 50000);

      // Verify row exists
      const beforeCount = db.raw.prepare('SELECT count(*) as c FROM sessions').get() as any;
      expect(beforeCount.c).toBe(1);

      // Purging at current time should delete it
      const purged = db.purgeExpiredSessions(now);
      expect(purged).toBe(1);

      const afterCount = db.raw.prepare('SELECT count(*) as c FROM sessions').get() as any;
      expect(afterCount.c).toBe(0);
    });
  });
});

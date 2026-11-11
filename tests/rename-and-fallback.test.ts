import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  resolveDefaultDbPath,
  MarmaladeDatabase,
  SproutDatabase,
} from '../src/server/db/sqlite.js';
import {
  createMarmaladeApp,
  createSproutApp,
  SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from '../src/server/app.js';

describe('Marmalade Rename and Backward-Compatible Fallbacks', () => {
  let tempDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'marmalade-rename-test-'));
    delete process.env.MARMALADE_DB_PATH;
    delete process.env.SPROUT_DB_PATH;
    delete process.env.MARMALADE_PORT;
    delete process.env.SPROUT_PORT;
    delete process.env.MARMALADE_HOST;
    delete process.env.SPROUT_HOST;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('Database Path Resolution & Fallback (resolveDefaultDbPath)', () => {
    it('defaults to marmalade.db in target directory on fresh install', () => {
      const resolved = resolveDefaultDbPath(tempDir);
      expect(resolved).toBe(join(tempDir, 'marmalade.db'));
    });

    it('falls back to sprout.db if sprout.db exists and marmalade.db does not', () => {
      const sproutDbPath = join(tempDir, 'sprout.db');
      writeFileSync(sproutDbPath, ''); // simulate existing legacy database

      const resolved = resolveDefaultDbPath(tempDir);
      expect(resolved).toBe(sproutDbPath);
    });

    it('prefers marmalade.db if both marmalade.db and sprout.db exist', () => {
      const sproutDbPath = join(tempDir, 'sprout.db');
      const marmaladeDbPath = join(tempDir, 'marmalade.db');
      writeFileSync(sproutDbPath, '');
      writeFileSync(marmaladeDbPath, '');

      const resolved = resolveDefaultDbPath(tempDir);
      expect(resolved).toBe(marmaladeDbPath);
    });

    it('honors SPROUT_DB_PATH as a silent fallback when MARMALADE_DB_PATH is not set', () => {
      process.env.SPROUT_DB_PATH = '/custom/legacy/path/sprout.db';
      const resolved = resolveDefaultDbPath(tempDir);
      expect(resolved).toBe('/custom/legacy/path/sprout.db');
    });

    it('prefers MARMALADE_DB_PATH over SPROUT_DB_PATH when both are set', () => {
      process.env.SPROUT_DB_PATH = '/custom/legacy/path/sprout.db';
      process.env.MARMALADE_DB_PATH = '/custom/new/path/marmalade.db';
      const resolved = resolveDefaultDbPath(tempDir);
      expect(resolved).toBe('/custom/new/path/marmalade.db');
    });
  });

  describe('Class Aliases', () => {
    it('exports MarmaladeDatabase and SproutDatabase as identical constructors', () => {
      expect(MarmaladeDatabase).toBe(SproutDatabase);
      const db = new MarmaladeDatabase(':memory:');
      expect(db).toBeInstanceOf(MarmaladeDatabase);
      expect(db).toBeInstanceOf(SproutDatabase);
      db.close();
    });

    it('exports createMarmaladeApp and createSproutApp as identical factory functions', () => {
      expect(createMarmaladeApp).toBe(createSproutApp);
      const instance = createMarmaladeApp({ dbPath: ':memory:' });
      expect(instance).toBeDefined();
      expect(instance.app).toBeDefined();
      expect(instance.db).toBeInstanceOf(MarmaladeDatabase);
      instance.db.close();
    });
  });

  describe('Session Cookies and CSRF Header Compatibility', () => {
    it('sets marmalade_session cookie on login and accepts both X-Marmalade-CSRF and X-Sprout-CSRF', async () => {
      const { app, db } = createMarmaladeApp({ dbPath: ':memory:' });

      // First run setup
      const setupRes = await app.fetch(
        new Request('http://localhost/api/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parentUsername: 'admin',
            parentPassword: 'Password123!',
            childUsername: 'kid',
            childPassword: 'Password123!',
          }),
        })
      );
      expect(setupRes.status).toBe(200);

      // Login
      const loginRes = await app.fetch(
        new Request('http://localhost/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'admin',
            password: 'Password123!',
          }),
        })
      );
      expect(loginRes.status).toBe(200);

      const setCookie = loginRes.headers.get('set-cookie');
      expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
      expect(SESSION_COOKIE_NAME).toBe('marmalade_session');
      expect(LEGACY_SESSION_COOKIE_NAME).toBe('sprout_session');

      const loginData = await loginRes.json();
      const token = setCookie?.match(/marmalade_session=([^;]+)/)?.[1]!;
      const csrfToken = loginData.csrfToken;
      expect(token).toBeTruthy();
      expect(csrfToken).toBeTruthy();

      // 1. Authenticate with marmalade_session + X-Marmalade-CSRF
      const req1 = await app.fetch(
        new Request('http://localhost/api/parent/dashboard', {
          method: 'GET',
          headers: {
            Cookie: `marmalade_session=${token}`,
            'X-Marmalade-CSRF': csrfToken,
          },
        })
      );
      expect(req1.status).toBe(200);

      // 2. Authenticate with legacy sprout_session cookie + X-Marmalade-CSRF
      const req2 = await app.fetch(
        new Request('http://localhost/api/parent/dashboard', {
          method: 'GET',
          headers: {
            Cookie: `sprout_session=${token}`,
            'X-Marmalade-CSRF': csrfToken,
          },
        })
      );
      expect(req2.status).toBe(200);

      // 3. Mutating request with legacy X-Sprout-CSRF header
      const req3 = await app.fetch(
        new Request('http://localhost/api/parent/policy', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `marmalade_session=${token}`,
            'X-Sprout-CSRF': csrfToken,
          },
          body: JSON.stringify({ dailyMinutes: 45, cooldownMinutes: 10 }),
        })
      );
      expect(req3.status).toBe(200);

      // 4. Mutating request with new X-Marmalade-CSRF header
      const req4 = await app.fetch(
        new Request('http://localhost/api/parent/policy', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `sprout_session=${token}`,
            'X-Marmalade-CSRF': csrfToken,
          },
          body: JSON.stringify({ dailyMinutes: 60, cooldownMinutes: 15 }),
        })
      );
      expect(req4.status).toBe(200);

      // 5. Mutating request without any CSRF header should be rejected (403)
      const req5 = await app.fetch(
        new Request('http://localhost/api/parent/policy', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `marmalade_session=${token}`,
          },
          body: JSON.stringify({ dailyMinutes: 30, cooldownMinutes: 5 }),
        })
      );
      expect(req5.status).toBe(403);

      // 6. Logout clears both marmalade_session and legacy sprout_session cookies
      const logoutRes = await app.fetch(
        new Request('http://localhost/api/auth/logout', {
          method: 'POST',
          headers: {
            Cookie: `marmalade_session=${token}`,
            'X-Marmalade-CSRF': csrfToken,
          },
        })
      );
      expect(logoutRes.status).toBe(200);
      const logoutSetCookie = logoutRes.headers.get('set-cookie');
      expect(logoutSetCookie).toContain('marmalade_session=');
      expect(logoutSetCookie).toContain('sprout_session=');

      db.close();
    });
  });
});

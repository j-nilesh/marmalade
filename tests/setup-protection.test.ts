import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMarmaladeApp } from '../src/server/app.js';

describe('Protected First-Run Setup (SETUP_TOKEN)', () => {
  const originalEnvToken = process.env.SETUP_TOKEN;

  beforeEach(() => {
    delete process.env.SETUP_TOKEN;
  });

  afterEach(() => {
    if (originalEnvToken !== undefined) {
      process.env.SETUP_TOKEN = originalEnvToken;
    } else {
      delete process.env.SETUP_TOKEN;
    }
  });

  it('unprotected setup: succeeds without token when SETUP_TOKEN is not set', async () => {
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });
    
    const bootRes = await appInstance.app.request('/api/bootstrap');
    expect(bootRes.status).toBe(200);
    const bootData = await bootRes.json();
    expect(bootData.initialized).toBe(false);
    expect(bootData.setupTokenRequired).toBe(false);

    const setupRes = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(setupRes.status).toBe(200);
    const setupData = await setupRes.json();
    expect(setupData.ok).toBe(true);
  });

  it('protected setup: /api/bootstrap indicates token is required without leaking token value', async () => {
    process.env.SETUP_TOKEN = 'super-secret-passphrase-7788';
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });

    const bootRes = await appInstance.app.request('/api/bootstrap');
    expect(bootRes.status).toBe(200);
    const bootData = await bootRes.json();
    expect(bootData.initialized).toBe(false);
    expect(bootData.setupTokenRequired).toBe(true);
    expect(JSON.stringify(bootData)).not.toContain('super-secret-passphrase-7788');
  });

  it('protected setup: rejects setup with 403 when token is missing or incorrect', async () => {
    process.env.SETUP_TOKEN = 'super-secret-passphrase-7788';
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });

    // Missing token
    const resMissing = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(resMissing.status).toBe(403);
    const dataMissing = await resMissing.json();
    expect(dataMissing.error).toBe('INVALID_SETUP_TOKEN');

    // Incorrect body token
    const resWrongBody = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupToken: 'wrong-guess',
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(resWrongBody.status).toBe(403);
    const dataWrongBody = await resWrongBody.json();
    expect(dataWrongBody.error).toBe('INVALID_SETUP_TOKEN');

    // Incorrect header token
    const resWrongHeader = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-setup-token': 'wrong-header-token',
      },
      body: JSON.stringify({
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(resWrongHeader.status).toBe(403);
    const dataWrongHeader = await resWrongHeader.json();
    expect(dataWrongHeader.error).toBe('INVALID_SETUP_TOKEN');
  });

  it('protected setup: rejects token in URL query parameter to prevent access log leakage', async () => {
    process.env.SETUP_TOKEN = 'super-secret-passphrase-7788';
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });

    // Passing token as query param should NOT be accepted
    const resQuery = await appInstance.app.request('/api/setup?token=super-secret-passphrase-7788', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(resQuery.status).toBe(403);
    const dataQuery = await resQuery.json();
    expect(dataQuery.error).toBe('INVALID_SETUP_TOKEN');
  });

  it('protected setup: succeeds with 200 when valid token provided in JSON body', async () => {
    process.env.SETUP_TOKEN = 'super-secret-passphrase-7788';
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });

    const res = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupToken: 'super-secret-passphrase-7788',
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.user.role).toBe('parent');
  });

  it('protected setup: succeeds with 200 when valid token provided in x-setup-token header', async () => {
    process.env.SETUP_TOKEN = 'super-secret-passphrase-7788';
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });

    const res = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-setup-token': 'super-secret-passphrase-7788',
      },
      body: JSON.stringify({
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it('replay protection: rejects subsequent /api/setup with 409 even with correct token', async () => {
    process.env.SETUP_TOKEN = 'super-secret-passphrase-7788';
    const appInstance = createMarmaladeApp({ dbPath: ':memory:' });

    // Initial setup
    const res1 = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupToken: 'super-secret-passphrase-7788',
        parentUsername: 'parent',
        parentPassword: 'Password123!',
        childUsername: 'child',
        childPassword: 'Password123!',
      }),
    });
    expect(res1.status).toBe(200);

    // Replay attempt
    const res2 = await appInstance.app.request('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupToken: 'super-secret-passphrase-7788',
        parentUsername: 'parent2',
        parentPassword: 'Password456!',
        childUsername: 'child2',
        childPassword: 'Password456!',
      }),
    });
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error).toBe('SETUP_ALREADY_COMPLETED');
  });
});

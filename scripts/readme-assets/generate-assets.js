import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = join(process.cwd(), 'scripts/readme-assets');
const ROOT_DIR = process.cwd();
const OUT_DIR = join(ROOT_DIR, 'docs/assets/readme');
mkdirSync(OUT_DIR, { recursive: true });

const PORT = 4128;
const DB_PATH = `/tmp/marmalade-readme-demo-${Date.now()}.db`;

async function convertPageToWebP(page, elementSelector = null, quality = 0.88) {
  let pngBase64;
  if (elementSelector) {
    const el = await page.$(elementSelector);
    if (!el) throw new Error(`Element not found: ${elementSelector}`);
    pngBase64 = (await el.screenshot({ type: 'png' })).toString('base64');
  } else {
    pngBase64 = (await page.screenshot({ type: 'png' })).toString('base64');
  }

  const webpDataUri = await page.evaluate(
    async ({ base64, q }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${base64}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/webp', q);
    },
    { base64: pngBase64, q: quality }
  );

  const base64Data = webpDataUri.replace(/^data:image\/webp;base64,/, '');
  return Buffer.from(base64Data, 'base64');
}

async function saveWebPFile(page, elementSelector, outputPath, quality = 0.88) {
  const buf = await convertPageToWebP(page, elementSelector, quality);
  writeFileSync(outputPath, buf);
  const sizeKb = Math.round(buf.length / 1024);
  console.log(`Saved: ${outputPath.replace(ROOT_DIR + '/', '')} (${sizeKb} KB)`);
}

// Dark mode stylesheet injected for dark theme app screenshots
const DARK_THEME_CSS = `
  :root {
    --m-cream: #0d1410 !important;
    --m-card: #15221b !important;
    --m-green: #3ea374 !important;
    --m-green-2: #4db383 !important;
    --m-green-soft: #1a2e23 !important;
    --m-forest: #080d0a !important;
    --m-ink: #f0f6f2 !important;
    --m-quiet: #98aba0 !important;
    --m-accent: #f58d65 !important;
    --m-accent-dark: #ff9d78 !important;
    --m-accent-soft: #2e1e17 !important;
    --m-hair: #23372c !important;
    --ink: #f0f6f2 !important;
    --bg: #0d1410 !important;
    --paper: #15221b !important;
    --cream: #1a2e23 !important;
    --soft: #1a2e23 !important;
    --wood: #1a2e23 !important;
    --wood-light: #223c2e !important;
    --bark: #a5c7b4 !important;
    --bark-soft: #7f998b !important;
    --leaf: #4db383 !important;
    --leaf-dark: #3ea374 !important;
    --leaf-deep: #255841 !important;
    --leaf-soft: #1c3327 !important;
    --grass: #223f30 !important;
    --sky: #1c3327 !important;
    --sun: #3a321d !important;
    --sunset: #f58d65 !important;
    --sunset-dark: #ff9d78 !important;
    --sunset-soft: #2e1e17 !important;
    --muted: #98aba0 !important;
    --line: #23372c !important;
    --line-strong: #2e4739 !important;
    --link: #6db9d8 !important;
  }
  body, html {
    background: #0d1410 !important;
    color: #f0f6f2 !important;
  }
  .app-shell, .room-card, .dashboard-card, .artifact-card, .treasure-card, .setup-card, .auth-card, .cat-bubble span, .card, .panel {
    background: #15221b !important;
    border-color: #23372c !important;
    color: #f0f6f2 !important;
  }
  .exchange-row, .chat-bubble, .coach-turn, .research-card, .source-card, .turn-card, .turn, .step-item {
    background: #1a2e23 !important;
    border-color: #2e4739 !important;
    color: #f0f6f2 !important;
  }
  .assistant, .ai-bubble, .message.assistant {
    background: #182b20 !important;
    border-color: #274232 !important;
    color: #f0f6f2 !important;
  }
  .user, .child-bubble, .message.user {
    background: #2a2318 !important;
    border-color: #443622 !important;
    color: #fceee0 !important;
  }
  input, textarea, select {
    background: #15221b !important;
    color: #f0f6f2 !important;
    border-color: #2e4739 !important;
  }
  .activity-tabs button, .tab-btn {
    background: #15221b !important;
    color: #98aba0 !important;
    border-color: #23372c !important;
  }
  .activity-tabs button.active, .tab-btn.active {
    background: #23372c !important;
    color: #4db383 !important;
  }
  .cat-speech-bubble {
    background: #1a2e23 !important;
    color: #4db383 !important;
    border-color: #2e4739 !important;
  }
`;

async function main() {
  console.log('=== Marmalade Visual README Asset Pipeline ===');

  const browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 2,
  });

  // 1. Render Graphic Templates (Hero, Headings, Activities Grid, Stopping Points, Buttons)
  console.log('\n--- 1. Rendering Generated HTML Templates ---');
  const templatesDir = join(__dirname, 'templates');

  // Hero
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    const heroUrl = `file://${join(templatesDir, 'hero.html')}`;
    await page.goto(heroUrl);
    if (isDark) {
      await page.evaluate(() => document.body.classList.add('dark'));
    }
    const outName = isDark ? 'hero-dark.webp' : 'hero.webp';
    await saveWebPFile(page, null, join(OUT_DIR, outName), 0.9);
  }

  // Heading Banners
  const headings = [
    { name: 'heading-treehouse', title: 'A treehouse, not a chatbot', kicker: 'ARCHITECTURE & BOUNDARIES', accent: '#6aa84f' },
    { name: 'heading-limits', title: 'Parents set limits. Nobody reads the chats.', kicker: 'PARENTAL GOVERNANCE', accent: '#f2784b' },
    { name: 'heading-stops', title: 'It stops on purpose', kicker: 'HEALTHY BOUNDARIES', accent: '#d9a066' },
    { name: 'heading-hardware', title: 'Your hardware. Your model. Your rules.', kicker: 'LOCAL-FIRST FREEDOM', accent: '#2f6a8f' },
    { name: 'heading-measured', title: 'Measured, not promised', kicker: 'EMPIRICAL RIGOR', accent: '#3f7a3a' },
    { name: 'heading-under-the-hood', title: 'Under the hood', kicker: 'SYSTEM ARCHITECTURE', accent: '#6b4428' },
    { name: 'heading-roadmap', title: 'Next on the list', kicker: 'RELEASE ROADMAP', accent: '#e9824a' },
    { name: 'heading-faq', title: 'Straight answers', kicker: 'FREQUENTLY ASKED QUESTIONS', accent: '#2c5a29' },
    { name: 'heading-quickstart', title: 'Get Marmalade', kicker: 'QUICKSTART & DEPLOY', accent: '#f2784b' },
    { name: 'heading-community', title: 'Build with us', kicker: 'COMMUNITY & CONTRIBUTE', accent: '#6aa84f' },
  ];

  for (const h of headings) {
    for (const theme of ['light', 'dark']) {
      const isDark = theme === 'dark';
      const headingUrl = `file://${join(templatesDir, 'heading-banner.html')}?title=${encodeURIComponent(h.title)}&kicker=${encodeURIComponent(h.kicker)}&accent=${encodeURIComponent(h.accent)}&theme=${theme}`;
      await page.goto(headingUrl);
      const outName = isDark ? `${h.name}-dark.webp` : `${h.name}.webp`;
      await saveWebPFile(page, '.banner-container', join(OUT_DIR, outName), 0.92);
    }
  }

  // Activities Grid
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    const gridUrl = `file://${join(templatesDir, 'activities-grid.html')}?theme=${theme}`;
    await page.goto(gridUrl);
    const outName = isDark ? 'activities-grid-dark.webp' : 'activities-grid.webp';
    await saveWebPFile(page, '.grid-container', join(OUT_DIR, outName), 0.9);
  }

  // Stopping Points Graphic
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    const stopUrl = `file://${join(templatesDir, 'stopping-points.html')}?theme=${theme}`;
    await page.goto(stopUrl);
    const outName = isDark ? 'stopping-points-dark.webp' : 'stopping-points.webp';
    await saveWebPFile(page, '.stopping-container', join(OUT_DIR, outName), 0.9);
  }

  // Buttons
  const buttonTypes = ['docker', 'demo', 'docs'];
  for (const bType of buttonTypes) {
    for (const theme of ['light', 'dark']) {
      const isDark = theme === 'dark';
      const btnUrl = `file://${join(templatesDir, 'buttons.html')}?type=${bType}&theme=${theme}`;
      await page.goto(btnUrl);
      const outName = isDark ? `button-${bType}-dark.webp` : `button-${bType}.webp`;
      await saveWebPFile(page, '#btnContainer', join(OUT_DIR, outName), 0.95);
    }
  }

  // 2. Start Live App in Demo Mode & Seed Activities for "Juniper"
  console.log('\n--- 2. Starting Marmalade Server & Seeding Demo Mode ---');
  if (existsSync(DB_PATH)) rmSync(DB_PATH);

  const serverProc = spawn('node', ['dist/server/server/index.js'], {
    env: {
      ...process.env,
      MARMALADE_PORT: String(PORT),
      MARMALADE_HOST: '127.0.0.1',
      MARMALADE_DB_PATH: DB_PATH,
      NODE_ENV: 'production',
    },
    stdio: 'ignore',
  });

  // Wait for server ready
  let serverReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/bootstrap`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  if (!serverReady) throw new Error('Marmalade server failed to start on port ' + PORT);

  // Setup family with Juniper
  const setupRes = await fetch(`http://127.0.0.1:${PORT}/api/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentUsername: 'parent',
      parentDisplayName: 'Parent',
      parentPassword: 'Password123!',
      childUsername: 'juniper',
      childDisplayName: 'Juniper',
      childPassword: 'Password123!',
      childAge: 10,
    }),
  });
  if (!setupRes.ok) throw new Error('Setup failed: ' + (await setupRes.text()));

  // Login as Juniper
  const childLoginRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'juniper', password: 'Password123!' }),
  });
  const childCookieHeader = childLoginRes.headers.get('set-cookie') || '';
  const childCookieMatch = childCookieHeader.match(/marmalade_session=([^;]+)/);
  const childSessionToken = childCookieMatch ? childCookieMatch[1] : '';
  const childData = await childLoginRes.json();
  const childCsrf = childData.csrfToken;

  // Acknowledge explainer
  await fetch(`http://127.0.0.1:${PORT}/api/child/ack-explainer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `marmalade_session=${childSessionToken}`,
      'X-Marmalade-CSRF': childCsrf,
    },
  });

  // Seed Story Relay
  console.log('Seeding Story Relay for Juniper...');
  const storyStartRes = await fetch(`http://127.0.0.1:${PORT}/api/play/story/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `marmalade_session=${childSessionToken}`,
      'X-Marmalade-CSRF': childCsrf,
    },
    body: JSON.stringify({ genre: 'mystery' }),
  });
  const storyData = await storyStartRes.json();
  const storySessionId = storyData.sessionId;

  await fetch(`http://127.0.0.1:${PORT}/api/play/story/${storySessionId}/turn`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `marmalade_session=${childSessionToken}`,
      'X-Marmalade-CSRF': childCsrf,
    },
    body: JSON.stringify({
      childDirection: 'We found an old brass key hidden in the hollow tree branch and stepped onto the mossy bridge.',
    }),
  });

  // Seed Field Guide (Research)
  console.log('Seeding Field Guide research...');
  await fetch(`http://127.0.0.1:${PORT}/api/research/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `marmalade_session=${childSessionToken}`,
      'X-Marmalade-CSRF': childCsrf,
    },
    body: JSON.stringify({ query: 'Why do fireflies glow at night?' }),
  });

  // Seed Study Nook (Schoolwork)
  console.log('Seeding Study Nook coaching...');
  const schoolworkRes = await fetch(`http://127.0.0.1:${PORT}/api/schoolwork/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `marmalade_session=${childSessionToken}`,
      'X-Marmalade-CSRF': childCsrf,
    },
    body: JSON.stringify({
      assignment: 'Write a paragraph explaining photosynthesis for 5th grade science class.',
    }),
  });
  const swData = await schoolworkRes.json();
  const swSessionId = swData.session?.id || swData.sessionId;
  if (swSessionId) {
    await fetch(`http://127.0.0.1:${PORT}/api/schoolwork/${swSessionId}/step`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `marmalade_session=${childSessionToken}`,
        'X-Marmalade-CSRF': childCsrf,
      },
      body: JSON.stringify({
        studentInput: 'Plants use sunlight, water from roots, and carbon dioxide from air to make glucose and oxygen.',
      }),
    });
  }

  // Login as parent to get parent token
  const parentLoginRes = await fetch(`http://127.0.0.1:${PORT}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'parent', password: 'Password123!' }),
  });
  const parentCookieHeader = parentLoginRes.headers.get('set-cookie') || '';
  const parentCookieMatch = parentCookieHeader.match(/marmalade_session=([^;]+)/);
  const parentSessionToken = parentCookieMatch ? parentCookieMatch[1] : '';

  // 3. Capture Screenshots of the App Screens (Light & Dark)
  console.log('\n--- 3. Capturing App Screenshots ---');
  const appBaseUrl = `http://127.0.0.1:${PORT}`;

  // Helper to setup page session
  async function setupAppPage(token, isDark) {
    await page.context().clearCookies();
    await page.context().addCookies([
      {
        name: 'marmalade_session',
        value: token,
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
      },
    ]);
    if (isDark) {
      await page.emulateMedia({ colorScheme: 'dark' });
    } else {
      await page.emulateMedia({ colorScheme: 'light' });
    }
  }

  // 3a. Story Relay
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    await setupAppPage(childSessionToken, isDark);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${appBaseUrl}/#play`);
    await page.waitForTimeout(600);
    if (isDark) {
      await page.addStyleTag({ content: DARK_THEME_CSS });
    }
    const outName = isDark ? 'story-relay-dark.webp' : 'story-relay.webp';
    await saveWebPFile(page, null, join(OUT_DIR, outName), 0.88);
  }

  // 3b. Field Guide
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    await setupAppPage(childSessionToken, isDark);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${appBaseUrl}/#research`);
    await page.waitForTimeout(600);
    if (isDark) {
      await page.addStyleTag({ content: DARK_THEME_CSS });
    }
    const outName = isDark ? 'field-guide-dark.webp' : 'field-guide.webp';
    await saveWebPFile(page, null, join(OUT_DIR, outName), 0.88);
  }

  // 3c. Study Nook
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    await setupAppPage(childSessionToken, isDark);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${appBaseUrl}/#schoolwork`);
    await page.waitForTimeout(600);
    if (isDark) {
      await page.addStyleTag({ content: DARK_THEME_CSS });
    }
    const outName = isDark ? 'study-nook-dark.webp' : 'study-nook.webp';
    await saveWebPFile(page, null, join(OUT_DIR, outName), 0.88);
  }

  // 3d. Parent Dashboard
  for (const theme of ['light', 'dark']) {
    const isDark = theme === 'dark';
    await setupAppPage(parentSessionToken, isDark);
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(`${appBaseUrl}/#parent`);
    await page.waitForTimeout(600);
    if (isDark) {
      await page.addStyleTag({ content: DARK_THEME_CSS });
    }
    const outName = isDark ? 'parent-dashboard-dark.webp' : 'parent-dashboard.webp';
    await saveWebPFile(page, null, join(OUT_DIR, outName), 0.88);
  }

  // Clean shutdown
  serverProc.kill();
  await browser.close();
  if (existsSync(DB_PATH)) rmSync(DB_PATH);

  console.log('\n--- 4. Updating Readme Stats ---');
  const statsScript = join(ROOT_DIR, 'scripts/readme-stats.js');
  const { execSync } = await import('node:child_process');
  execSync(`node "${statsScript}"`, { stdio: 'inherit' });

  console.log('\nAsset generation complete!');
}

main().catch((err) => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});

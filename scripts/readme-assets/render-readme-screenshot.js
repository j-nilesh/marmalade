import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';
import { chromium } from 'playwright';

const ROOT_DIR = process.cwd();
const OUT_DIR = join(ROOT_DIR, 'docs/assets/readme');

async function renderReadmeScreenshots() {
  console.log('Rendering README preview screenshots (light and dark)...');
  const readmeMarkdown = readFileSync(join(ROOT_DIR, 'README.md'), 'utf8');
  const markdownCss = readFileSync(
    join(ROOT_DIR, 'node_modules/github-markdown-css/github-markdown.css'),
    'utf8'
  );

  const htmlContent = marked.parse(readmeMarkdown);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1800 },
    deviceScaleFactor: 2,
  });

  const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    ${markdownCss}
    body {
      margin: 0;
      padding: 40px;
      display: flex;
      justify-content: center;
      transition: background 0.2s;
    }
    .markdown-body {
      box-sizing: border-box;
      min-width: 200px;
      max-width: 1040px;
      width: 100%;
      margin: 0 auto;
      padding: 45px;
      border: 1px solid var(--color-border-default, #d0d7de);
      border-radius: 12px;
    }
    img {
      max-width: 100%;
      height: auto;
    }

    /* Light mode handling of #gh-light-mode-only and #gh-dark-mode-only */
    body.light-theme {
      background: #f6f8fa;
    }
    body.light-theme [src*="#gh-dark-mode-only"],
    body.light-theme [srcset*="#gh-dark-mode-only"] {
      display: none !important;
    }
    body.light-theme [src*="#gh-light-mode-only"],
    body.light-theme [srcset*="#gh-light-mode-only"] {
      display: inline-block !important;
    }

    /* Dark mode handling */
    body.dark-theme {
      background: #010409;
    }
    body.dark-theme .markdown-body {
      border-color: #30363d;
    }
    body.dark-theme [src*="#gh-light-mode-only"],
    body.dark-theme [srcset*="#gh-light-mode-only"] {
      display: none !important;
    }
    body.dark-theme [src*="#gh-dark-mode-only"],
    body.dark-theme [srcset*="#gh-dark-mode-only"] {
      display: inline-block !important;
    }
  </style>
</head>
<body class="light-theme">
  <article class="markdown-body">
    ${htmlContent}
  </article>
</body>
</html>
  `;

  // Fix relative image links so file:/// loads correctly
  const resolvedHtml = fullHtml.replace(
    /(?:src|srcset)=["'](docs\/assets\/readme\/[^"']+)["']/g,
    (m, p) => `src="file://${join(ROOT_DIR, p)}"`
  );

  // 1. Light Mode
  await page.setContent(resolvedHtml, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.body.className = 'light-theme';
    document.documentElement.setAttribute('data-color-mode', 'light');
    document.documentElement.setAttribute('data-light-theme', 'light');
  });
  await page.waitForTimeout(600);
  const lightOutPng = join(OUT_DIR, 'readme-rendered-light.png');
  await page.screenshot({ path: lightOutPng, fullPage: true });
  console.log(`Saved: ${lightOutPng.replace(ROOT_DIR + '/', '')}`);

  // 2. Dark Mode
  await page.setContent(resolvedHtml, { waitUntil: 'load' });
  await page.evaluate(() => {
    document.body.className = 'dark-theme';
    document.documentElement.setAttribute('data-color-mode', 'dark');
    document.documentElement.setAttribute('data-dark-theme', 'dark');
  });
  await page.waitForTimeout(600);
  const darkOutPng = join(OUT_DIR, 'readme-rendered-dark.png');
  await page.screenshot({ path: darkOutPng, fullPage: true });
  console.log(`Saved: ${darkOutPng.replace(ROOT_DIR + '/', '')}`);

  await browser.close();
}

renderReadmeScreenshots().catch((err) => {
  console.error(err);
  process.exit(1);
});

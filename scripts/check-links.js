import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const markdownFiles = [
  'README.md',
  'ROADMAP.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SELF_HOSTING.md',
  'CHANGELOG.md',
  'docs/THREAT_MODEL.md',
  'docs/PROVIDER_COMPLIANCE.md',
  'docs/DEPLOYER_RESPONSIBILITIES.md',
];

let errors = 0;
for (const file of markdownFiles) {
  if (!existsSync(file)) {
    console.error(`Referenced doc file missing: ${file}`);
    errors++;
    continue;
  }
  const content = readFileSync(file, 'utf8');
  // Match relative links [text](path) excluding http(s), anchor (#), and mailto
  const regex = /\[.*?\]\((?!https?:\/\/|#|mailto:)(.*?)\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const rawTarget = match[1].split('#')[0].trim();
    if (rawTarget) {
      // Determine relative base
      const fileDir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '.';
      const targetPath = rawTarget.startsWith('/')
        ? join(process.cwd(), rawTarget)
        : join(process.cwd(), fileDir, rawTarget);

      if (!existsSync(targetPath)) {
        console.error(`Broken link in ${file}: "${match[1]}" -> ${targetPath} not found`);
        errors++;
      }
    }
  }
}

if (errors > 0) {
  console.error(`Found ${errors} broken internal link(s).`);
  process.exit(1);
} else {
  console.log('✓ All internal documentation links resolve cleanly.');
}

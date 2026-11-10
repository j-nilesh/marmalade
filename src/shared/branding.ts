/**
 * Centralized Branding Configuration (Item 0)
 * All user-facing product names, taglines, logos, and default instance names
 * are centralized here so changing product branding requires only modifying this file.
 */

export const BRANDING = {
  productName: 'Marmalade',
  shortName: 'Marmalade',
  tagline: 'A treehouse for big questions.',
  description: 'A free, open-source, self-hosted AI companion and treehouse for families.',
  defaultInstanceName: 'The Treehouse',
  logoEmoji: '🐱',
  version: '1.2.0',
  license: 'MIT',
  githubUrl: 'https://github.com/j-nilesh/marmalade',
  colors: {
    primary: '#3f7a3a',
    primaryDark: '#2c5a29',
    soft: '#f3e6cf',
    paper: '#fffaf0',
    line: '#e3d2b4',
    text: '#3b2a1e',
    muted: '#6e5a48',
    danger: '#a8392f',
    bark: '#6b4428',
    sunset: '#e9824a',
  },
} as const;

/**
 * Returns the effective display name for a child workspace:
 * uses the parent-configured instance name if set, otherwise falls back to a friendly default.
 */
export function getWorkspaceTitle(
  instanceDisplayName?: string | null,
  childDisplayName?: string
): string {
  const configured = (instanceDisplayName || '').trim();
  if (configured) return configured;
  if (childDisplayName && childDisplayName.trim()) {
    return `${childDisplayName.trim()}’s Treehouse`;
  }
  return BRANDING.defaultInstanceName;
}

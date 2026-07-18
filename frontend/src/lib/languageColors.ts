/**
 * Shared language / tech pill colors — GitHub-familiar where they map cleanly.
 * Used by Project Help tags and Profile stack pills for visual consistency.
 */

export type LanguageTone = { bg: string; border: string; text: string };

const FALLBACK: LanguageTone = {
  bg: 'rgba(125, 133, 144, 0.12)',
  border: 'rgba(125, 133, 144, 0.28)',
  text: '#9aa3ad',
};

/** Canonical language-color map (case-insensitive keys). */
const LANGUAGE_COLORS: Record<string, LanguageTone> = {
  javascript: {
    bg: 'rgba(241, 224, 90, 0.12)',
    border: 'rgba(241, 224, 90, 0.32)',
    text: '#f1e05a',
  },
  typescript: {
    bg: 'rgba(49, 120, 198, 0.14)',
    border: 'rgba(49, 120, 198, 0.35)',
    text: '#4f9ce8',
  },
  python: {
    bg: 'rgba(53, 114, 165, 0.14)',
    border: 'rgba(255, 212, 59, 0.28)',
    text: '#5a9fd4',
  },
  rust: {
    bg: 'rgba(222, 165, 132, 0.14)',
    border: 'rgba(222, 165, 132, 0.35)',
    text: '#dea584',
  },
  go: {
    bg: 'rgba(0, 173, 216, 0.12)',
    border: 'rgba(0, 173, 216, 0.32)',
    text: '#29b6e0',
  },
  golang: {
    bg: 'rgba(0, 173, 216, 0.12)',
    border: 'rgba(0, 173, 216, 0.32)',
    text: '#29b6e0',
  },
  react: {
    bg: 'rgba(97, 218, 251, 0.12)',
    border: 'rgba(97, 218, 251, 0.3)',
    text: '#61dafb',
  },
  'node.js': {
    bg: 'rgba(104, 160, 99, 0.14)',
    border: 'rgba(104, 160, 99, 0.32)',
    text: '#7cb87a',
  },
  node: {
    bg: 'rgba(104, 160, 99, 0.14)',
    border: 'rgba(104, 160, 99, 0.32)',
    text: '#7cb87a',
  },
  java: {
    bg: 'rgba(176, 114, 25, 0.14)',
    border: 'rgba(176, 114, 25, 0.32)',
    text: '#b07219',
  },
  ruby: {
    bg: 'rgba(112, 21, 22, 0.18)',
    border: 'rgba(204, 52, 45, 0.35)',
    text: '#cc342d',
  },
  php: {
    bg: 'rgba(79, 93, 149, 0.16)',
    border: 'rgba(79, 93, 149, 0.35)',
    text: '#8892bf',
  },
  swift: {
    bg: 'rgba(240, 81, 56, 0.14)',
    border: 'rgba(240, 81, 56, 0.32)',
    text: '#f05138',
  },
  kotlin: {
    bg: 'rgba(163, 101, 243, 0.14)',
    border: 'rgba(163, 101, 243, 0.32)',
    text: '#a365f3',
  },
  css: {
    bg: 'rgba(86, 61, 124, 0.16)',
    border: 'rgba(86, 61, 124, 0.35)',
    text: '#9b6fd4',
  },
  html: {
    bg: 'rgba(227, 76, 38, 0.14)',
    border: 'rgba(227, 76, 38, 0.32)',
    text: '#e34c26',
  },
  docker: {
    bg: 'rgba(36, 150, 237, 0.12)',
    border: 'rgba(36, 150, 237, 0.32)',
    text: '#2496ed',
  },
  postgres: {
    bg: 'rgba(51, 103, 145, 0.16)',
    border: 'rgba(51, 103, 145, 0.35)',
    text: '#5b9bd5',
  },
  postgresql: {
    bg: 'rgba(51, 103, 145, 0.16)',
    border: 'rgba(51, 103, 145, 0.35)',
    text: '#5b9bd5',
  },
  redis: {
    bg: 'rgba(220, 56, 45, 0.14)',
    border: 'rgba(220, 56, 45, 0.32)',
    text: '#dc382d',
  },
  graphql: {
    bg: 'rgba(225, 0, 152, 0.12)',
    border: 'rgba(225, 0, 152, 0.3)',
    text: '#e10098',
  },
  fastapi: {
    bg: 'rgba(0, 150, 136, 0.14)',
    border: 'rgba(0, 150, 136, 0.32)',
    text: '#009688',
  },
  next: {
    bg: 'rgba(230, 237, 243, 0.08)',
    border: 'rgba(230, 237, 243, 0.2)',
    text: '#e6edf3',
  },
  'next.js': {
    bg: 'rgba(230, 237, 243, 0.08)',
    border: 'rgba(230, 237, 243, 0.2)',
    text: '#e6edf3',
  },
  vue: {
    bg: 'rgba(65, 184, 131, 0.14)',
    border: 'rgba(65, 184, 131, 0.32)',
    text: '#41b883',
  },
  svelte: {
    bg: 'rgba(255, 62, 0, 0.14)',
    border: 'rgba(255, 62, 0, 0.32)',
    text: '#ff3e00',
  },
  c: {
    bg: 'rgba(85, 85, 85, 0.16)',
    border: 'rgba(85, 85, 85, 0.35)',
    text: '#a8b9c6',
  },
  'c++': {
    bg: 'rgba(243, 75, 125, 0.12)',
    border: 'rgba(243, 75, 125, 0.3)',
    text: '#f34b7d',
  },
  csharp: {
    bg: 'rgba(23, 134, 0, 0.14)',
    border: 'rgba(23, 134, 0, 0.32)',
    text: '#178600',
  },
  'c#': {
    bg: 'rgba(23, 134, 0, 0.14)',
    border: 'rgba(23, 134, 0, 0.32)',
    text: '#178600',
  },
};

const PALETTE: LanguageTone[] = [
  { bg: 'rgba(185, 144, 255, 0.12)', border: 'rgba(185, 144, 255, 0.28)', text: '#b990ff' },
  { bg: 'rgba(63, 185, 80, 0.12)', border: 'rgba(63, 185, 80, 0.28)', text: '#3fb950' },
  { bg: 'rgba(79, 156, 232, 0.12)', border: 'rgba(79, 156, 232, 0.28)', text: '#4f9ce8' },
  { bg: 'rgba(227, 179, 65, 0.12)', border: 'rgba(227, 179, 65, 0.28)', text: '#e3b341' },
  { bg: 'rgba(222, 165, 132, 0.12)', border: 'rgba(222, 165, 132, 0.28)', text: '#dea584' },
  { bg: 'rgba(0, 173, 216, 0.12)', border: 'rgba(0, 173, 216, 0.28)', text: '#29b6e0' },
  { bg: 'rgba(244, 180, 212, 0.12)', border: 'rgba(244, 180, 212, 0.28)', text: '#f4b4d4' },
  FALLBACK,
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Tone for a language / tech / interest label. */
export function languageTone(label: string): LanguageTone {
  const key = label.trim().toLowerCase();
  if (LANGUAGE_COLORS[key]) return LANGUAGE_COLORS[key];
  return PALETTE[hashString(key) % PALETTE.length];
}

/** Alias kept for Project Help TechChip call sites. */
export const techChipTone = languageTone;

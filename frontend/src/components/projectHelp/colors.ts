import type { CategoryKey } from './types';

/** Left-border / category accent — keyed by inferred primary category. */
export const CATEGORY_COLORS: Record<
  CategoryKey,
  { border: string; glow: string; label: string }
> = {
  infra: { border: '#5eead4', glow: 'rgba(94, 234, 212, 0.35)', label: 'Infra' },
  frontend: { border: '#e8a659', glow: 'rgba(232, 166, 89, 0.35)', label: 'Frontend' },
  systems: { border: '#e8654f', glow: 'rgba(232, 101, 79, 0.35)', label: 'Systems' },
  backend: { border: '#7dd3a8', glow: 'rgba(125, 211, 168, 0.35)', label: 'Backend' },
  data: { border: '#8b9cf7', glow: 'rgba(139, 156, 247, 0.35)', label: 'Data' },
  other: { border: '#8b93a7', glow: 'rgba(139, 147, 167, 0.3)', label: 'Other' },
};

type TechTone = { bg: string; border: string; text: string };

const TECH_PALETTE: TechTone[] = [
  { bg: 'rgba(94, 234, 212, 0.12)', border: 'rgba(94, 234, 212, 0.28)', text: '#5eead4' },
  { bg: 'rgba(232, 166, 89, 0.12)', border: 'rgba(232, 166, 89, 0.28)', text: '#e8a659' },
  { bg: 'rgba(232, 101, 79, 0.12)', border: 'rgba(232, 101, 79, 0.28)', text: '#f0a090' },
  { bg: 'rgba(139, 156, 247, 0.12)', border: 'rgba(139, 156, 247, 0.28)', text: '#a8b4f8' },
  { bg: 'rgba(125, 211, 168, 0.12)', border: 'rgba(125, 211, 168, 0.28)', text: '#7dd3a8' },
  { bg: 'rgba(244, 180, 212, 0.12)', border: 'rgba(244, 180, 212, 0.28)', text: '#f4b4d4' },
  { bg: 'rgba(250, 204, 120, 0.12)', border: 'rgba(250, 204, 120, 0.28)', text: '#fac878' },
  { bg: 'rgba(125, 211, 252, 0.12)', border: 'rgba(125, 211, 252, 0.28)', text: '#7dd3fc' },
];

const TECH_OVERRIDES: Record<string, TechTone> = {
  react: TECH_PALETTE[0],
  typescript: TECH_PALETTE[3],
  javascript: TECH_PALETTE[6],
  'node.js': TECH_PALETTE[4],
  node: TECH_PALETTE[4],
  rust: TECH_PALETTE[2],
  python: TECH_PALETTE[6],
  fastapi: TECH_PALETTE[4],
  websockets: TECH_PALETTE[0],
  docker: TECH_PALETTE[7],
  kubernetes: TECH_PALETTE[3],
  postgres: TECH_PALETTE[3],
  redis: TECH_PALETTE[2],
  go: TECH_PALETTE[0],
  golang: TECH_PALETTE[0],
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function techChipTone(tech: string): TechTone {
  const key = tech.trim().toLowerCase();
  if (TECH_OVERRIDES[key]) return TECH_OVERRIDES[key];
  return TECH_PALETTE[hashString(key) % TECH_PALETTE.length];
}

const INFRA = ['docker', 'k8s', 'kubernetes', 'aws', 'gcp', 'azure', 'ci', 'cdn', 'nginx', 'terraform'];
const FRONTEND = ['react', 'vue', 'svelte', 'css', 'tailwind', 'next', 'frontend', 'ui', 'typescript', 'javascript'];
const SYSTEMS = ['rust', 'c++', 'systems', 'compiler', 'os', 'kernel', 'embedded', 'wasm'];
const BACKEND = ['node', 'node.js', 'fastapi', 'django', 'flask', 'go', 'golang', 'api', 'graphql', 'websockets'];
const DATA = ['postgres', 'sql', 'redis', 'spark', 'ml', 'data', 'pandas', 'etl'];

/** Infer a primary category from title + tech for left-border coloring. */
export function inferCategory(title: string, tech: string[]): CategoryKey {
  const hay = `${title} ${tech.join(' ')}`.toLowerCase();
  const hit = (words: string[]) => words.some((w) => hay.includes(w));
  if (hit(SYSTEMS)) return 'systems';
  if (hit(INFRA)) return 'infra';
  if (hit(FRONTEND)) return 'frontend';
  if (hit(BACKEND)) return 'backend';
  if (hit(DATA)) return 'data';
  return 'other';
}

import type { CategoryKey } from './types';
import { languageTone, techChipTone, type LanguageTone } from '../../lib/languageColors';

export type { LanguageTone };
export { languageTone, techChipTone };

/** Left-border / category accent — keyed by inferred primary category. */
export const CATEGORY_COLORS: Record<
  CategoryKey,
  { border: string; glow: string; bright: string; label: string }
> = {
  infra: {
    border: '#29b6e0',
    bright: '#5cc8e8',
    glow: 'rgba(41, 182, 224, 0.3)',
    label: 'Infra',
  },
  frontend: {
    border: '#b990ff',
    bright: '#c9a8ff',
    glow: 'rgba(185, 144, 255, 0.32)',
    label: 'Frontend',
  },
  systems: {
    border: '#dea584',
    bright: '#e8bda0',
    glow: 'rgba(222, 165, 132, 0.32)',
    label: 'Systems',
  },
  backend: {
    border: '#3fb950',
    bright: '#56d364',
    glow: 'rgba(63, 185, 80, 0.3)',
    label: 'Backend',
  },
  data: {
    border: '#4f9ce8',
    bright: '#7ab4f0',
    glow: 'rgba(79, 156, 232, 0.3)',
    label: 'Data',
  },
  other: {
    border: '#7d8590',
    bright: '#9aa3ad',
    glow: 'rgba(125, 133, 144, 0.28)',
    label: 'Other',
  },
};

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

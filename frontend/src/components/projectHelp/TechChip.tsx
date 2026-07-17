import React from 'react';
import { techChipTone } from './colors';

type TechChipProps = {
  tech: string;
  onRemove?: () => void;
  size?: 'sm' | 'md';
};

export const TechChip: React.FC<TechChipProps> = ({ tech, onRemove, size = 'sm' }) => {
  const tone = techChipTone(tech);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-mono border ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      }`}
      style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
    >
      {tech}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove ${tech}`}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </span>
  );
};

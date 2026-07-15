import React from 'react';

/**
 * Ambient page backdrop — the stage lighting for the story.
 * A warm ember wash from above, a faint gold answer from below,
 * a printing-grid that dissolves, and film grain to kill banding.
 * Static by design: the interface moves, not the wallpaper.
 */

const NOISE_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E";

export const GatewayNetwork: React.FC = () => {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Ember wash — candlelight from above */}
      <div
        className="absolute -top-[38%] left-1/2 -translate-x-1/2 w-[85rem] h-[46rem] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(255, 122, 92, 0.075), rgba(255, 122, 92, 0.02) 55%, transparent 75%)',
        }}
      />
      {/* Gold answer from the corner */}
      <div
        className="absolute -bottom-[32%] -right-[18%] w-[54rem] h-[38rem] rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgba(217, 161, 63, 0.05), transparent 70%)',
        }}
      />

      {/* Printing grid, dissolving from the top */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(242,236,223,0.032) 1px, transparent 1px), linear-gradient(90deg, rgba(242,236,223,0.032) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage:
            'radial-gradient(ellipse 90% 55% at 50% 0%, black 0%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 90% 55% at 50% 0%, black 0%, transparent 100%)',
        }}
      />

      {/* Film grain */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: `url("${NOISE_URI}")` }}
      />
    </div>
  );
};

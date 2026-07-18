/** Max stacked cards mounted in the Discover deck (ghosting guard). */
export const DECK_VISIBLE_CAP = 3;

/** Motion targets for the 3-card stack (index 0 = top). */
export type StackLayerStyle = {
  scale: number;
  y: number;
  opacity: number;
};

/**
 * Visual stack contract: top full-size, mid 0.94, back 0.88 (reduced-motion
 * uses a subtler 1 / 0.97 / 0.94).
 */
export function stackLayerStyle(
  index: number,
  reducedMotion = false
): StackLayerStyle {
  if (reducedMotion) {
    if (index === 0) return { scale: 1, y: 0, opacity: 1 };
    if (index === 1) return { scale: 0.97, y: 8, opacity: 0.5 };
    return { scale: 0.94, y: 14, opacity: 0.3 };
  }
  if (index === 0) return { scale: 1, y: 0, opacity: 1 };
  if (index === 1) return { scale: 0.94, y: 14, opacity: 0.55 };
  return { scale: 0.88, y: 26, opacity: 0.3 };
}

/** Cards currently rendered — never more than the cap. */
export function deckVisibleSlice<T>(profiles: T[], cap = DECK_VISIBLE_CAP): T[] {
  return profiles.slice(0, cap);
}

/** Remove the top card after a completed swipe animation. */
export function swipeTop<T>(profiles: T[]): { remaining: T[]; swiped: T | null } {
  if (profiles.length === 0) return { remaining: profiles, swiped: null };
  const [swiped, ...remaining] = profiles;
  return { remaining, swiped };
}

/**
 * How many `[data-deck-card]` nodes should be mounted after N swipes
 * when the stack is capped at `cap`.
 */
export function visibleCountAfterSwipes(
  initialCount: number,
  swipeCount: number,
  cap = DECK_VISIBLE_CAP
): number {
  const remaining = Math.max(0, initialCount - swipeCount);
  return Math.min(remaining, cap);
}

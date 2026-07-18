/** Fixed-row windowing — keeps long inbox/chat DOMs bounded without a virtualizer package. */

export type VirtualWindow = {
  /** Inclusive start index */
  start: number;
  /** Exclusive end index */
  end: number;
  offsetTop: number;
  totalHeight: number;
};

/**
 * Compute which slice of a fixed-height list should mount for the current scroll.
 * `overscan` mounts extra rows above/below the viewport to reduce blank flashes.
 */
export function computeVirtualWindow(
  count: number,
  scrollTop: number,
  viewportHeight: number,
  itemHeight: number,
  overscan = 4
): VirtualWindow {
  const safeCount = Math.max(0, count);
  const h = Math.max(1, itemHeight);
  const totalHeight = safeCount * h;
  if (safeCount === 0) {
    return { start: 0, end: 0, offsetTop: 0, totalHeight: 0 };
  }
  const vh = Math.max(0, viewportHeight);
  const maxScroll = Math.max(0, totalHeight - vh);
  const st = Math.min(Math.max(0, scrollTop), maxScroll);
  const first = Math.floor(st / h);
  const visible = Math.ceil(vh / h) + 1;
  const start = Math.min(safeCount, Math.max(0, first - overscan));
  const end = Math.min(safeCount, Math.max(start, first + visible + overscan));
  return {
    start,
    end,
    offsetTop: start * h,
    totalHeight,
  };
}

/** Prefer windowing once lists grow past this size. */
export const VIRTUALIZE_THRESHOLD = 24;

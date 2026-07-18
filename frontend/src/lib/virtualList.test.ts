import { describe, expect, it } from 'vitest';
import { computeVirtualWindow, VIRTUALIZE_THRESHOLD } from './virtualList';

describe('computeVirtualWindow', () => {
  it('returns empty window for zero items', () => {
    expect(computeVirtualWindow(0, 0, 400, 68)).toEqual({
      start: 0,
      end: 0,
      offsetTop: 0,
      totalHeight: 0,
    });
  });

  it('windows a long list around the scroll position', () => {
    const win = computeVirtualWindow(100, 680, 400, 68, 2);
    // scrollTop 680 → first visible ~10; with overscan 2 → start 8
    expect(win.start).toBe(8);
    expect(win.end).toBeLessThan(100);
    expect(win.end).toBeGreaterThan(win.start);
    expect(win.offsetTop).toBe(win.start * 68);
    expect(win.totalHeight).toBe(100 * 68);
    expect(win.end - win.start).toBeLessThanOrEqual(Math.ceil(400 / 68) + 1 + 4);
  });

  it('clamps to bounds at the top and bottom', () => {
    const top = computeVirtualWindow(10, 0, 200, 50, 3);
    expect(top.start).toBe(0);
    const bottom = computeVirtualWindow(10, 10_000, 200, 50, 3);
    expect(bottom.end).toBe(10);
    expect(bottom.start).toBeLessThan(10);
  });
});

describe('VIRTUALIZE_THRESHOLD', () => {
  it('stays conservative for typical inboxes', () => {
    expect(VIRTUALIZE_THRESHOLD).toBeGreaterThanOrEqual(20);
    expect(VIRTUALIZE_THRESHOLD).toBeLessThanOrEqual(40);
  });
});

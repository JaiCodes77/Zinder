import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import {
  DECK_VISIBLE_CAP,
  deckVisibleSlice,
  stackLayerStyle,
  swipeTop,
  visibleCountAfterSwipes,
} from './deckStack';

afterEach(() => cleanup());

type Card = { id: number };

function DeckHarness({ initial }: { initial: Card[] }) {
  const [deck, setDeck] = useState(initial);
  return (
    <div>
      <button type="button" onClick={() => setDeck((d) => swipeTop(d).remaining)}>
        swipe
      </button>
      {deckVisibleSlice(deck).map((p) => (
        <div key={p.id} data-deck-card={p.id} />
      ))}
    </div>
  );
}

describe('deckStack', () => {
  it('caps visible cards at 3', () => {
    const cards = Array.from({ length: 12 }, (_, i) => ({ id: i + 1 }));
    expect(deckVisibleSlice(cards)).toHaveLength(DECK_VISIBLE_CAP);
  });

  it('keeps the 3-card scale contract (1 / 0.94 / 0.88)', () => {
    expect(stackLayerStyle(0).scale).toBe(1);
    expect(stackLayerStyle(1).scale).toBe(0.94);
    expect(stackLayerStyle(2).scale).toBe(0.88);
    expect(stackLayerStyle(0).y).toBe(0);
    expect(stackLayerStyle(1).y).toBeLessThan(stackLayerStyle(2).y);
  });

  it('uses a subtler stack under reduced motion', () => {
    expect(stackLayerStyle(0, true).scale).toBe(1);
    expect(stackLayerStyle(1, true).scale).toBe(0.97);
    expect(stackLayerStyle(2, true).scale).toBe(0.94);
  });

  it('keeps ≤3 mounted cards after ≥10 swipes (ghosting regression)', () => {
    const initial = Array.from({ length: 15 }, (_, i) => ({ id: i + 1 }));
    expect(visibleCountAfterSwipes(initial.length, 10)).toBeLessThanOrEqual(3);

    render(<DeckHarness initial={initial} />);
    const swipe = screen.getByRole('button', { name: 'swipe' });
    for (let i = 0; i < 10; i++) fireEvent.click(swipe);

    const mounted = document.querySelectorAll('[data-deck-card]');
    expect(mounted.length).toBeLessThanOrEqual(DECK_VISIBLE_CAP);
    expect(mounted.length).toBe(visibleCountAfterSwipes(15, 10));
  });

  it('unmounts cards instead of accumulating after many swipes', () => {
    const initial = Array.from({ length: 20 }, (_, i) => ({ id: i + 1 }));
    render(<DeckHarness initial={initial} />);
    const swipe = screen.getByRole('button', { name: 'swipe' });
    for (let i = 0; i < 18; i++) fireEvent.click(swipe);

    expect(document.querySelectorAll('[data-deck-card]').length).toBe(2);
  });
});

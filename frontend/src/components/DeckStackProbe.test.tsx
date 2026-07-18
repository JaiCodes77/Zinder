import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeckStackProbe } from './DeckStackProbe';
import { DECK_VISIBLE_CAP } from '../lib/deckStack';

function deckCardCount() {
  return document.querySelectorAll('[data-deck-card]').length;
}

describe('Discover deck DOM cap', () => {
  it(`keeps ≤${DECK_VISIBLE_CAP} [data-deck-card] nodes after ≥10 swipes`, async () => {
    const user = userEvent.setup();
    const initial = Array.from({ length: 16 }, (_, i) => ({ id: i + 1 }));
    render(<DeckStackProbe initial={initial} />);

    expect(deckCardCount()).toBe(DECK_VISIBLE_CAP);

    for (let i = 0; i < 10; i++) {
      await user.click(screen.getByTestId('swipe'));
      expect(deckCardCount()).toBeLessThanOrEqual(DECK_VISIBLE_CAP);
    }

    expect(Number(screen.getByTestId('remaining').textContent)).toBe(6);
    expect(deckCardCount()).toBe(DECK_VISIBLE_CAP);
  });
});

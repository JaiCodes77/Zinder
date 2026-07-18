import React, { useState } from 'react';
import { DECK_VISIBLE_CAP, deckVisibleSlice, swipeTop } from '../lib/deckStack';

export type DeckProbeProfile = { id: number };

type DeckStackProbeProps = {
  initial: DeckProbeProfile[];
};

/**
 * Minimal stand-in for Discover deck mount rules used by regression tests.
 * Mirrors DiscoveryPage: swipeTop on swipe, mount at most DECK_VISIBLE_CAP cards.
 */
export const DeckStackProbe: React.FC<DeckStackProbeProps> = ({ initial }) => {
  const [profiles, setProfiles] = useState(initial);

  const swipe = () => {
    setProfiles((prev) => swipeTop(prev).remaining);
  };

  return (
    <div data-testid="deck-root">
      <button type="button" data-testid="swipe" onClick={swipe}>
        Swipe
      </button>
      <p data-testid="remaining">{profiles.length}</p>
      {deckVisibleSlice(profiles, DECK_VISIBLE_CAP).map((profile, index) => (
        <div
          key={profile.id}
          data-deck-card={profile.id}
          data-deck-index={index}
        />
      ))}
    </div>
  );
};

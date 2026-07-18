# Zinder Front-End Audit — Phase 3 re-check

**Date:** 2026-07-18 (re-audit)  
**Scope:** `/Users/jaipandey/Desktop/projects/zinder/frontend`  
**Mode:** Investigation + Discover Deck ghosting fix only.

**Verdict:** Design reset + activity bar / command palette shipped and hold up. Phase 3 P0/P1 Done; recent: FE withdraw interest (`withdrawInterest` + detail button); live edit smoke (skips if gateway 405). Next: CDN/notifications (needs BE), or Playwright if adding tooling.

---

## Priority changes vs prior audit

| Previously assumed | Re-check finding | Priority impact |
| --- | --- | --- |
| Discover deck “done” after redesign | Ghosting: exited cards stayed mounted via `AnimatePresence mode="popLayout"` + shared `dragX`/`dragY` reset mid-exit → overlapping named chrome | **P0 fixed in this pass** — add regression tests for ≤3 `[data-deck-card]` nodes after ≥10 swipes |
| Phase 2 FE “wired to real backend” | Backend contracts exist (`/auth/me`, logout, chat WS, `swipe/last`, `next_cursor`, PH social). FE still mocks or omits most of them | Phase 3 must start with **FE consumption of existing APIs**, not new features |
| Discover error handling “broken” (errors look empty) | **Improved** — deck/browse + Matches/PH error+retry | Shared client + 401 handler Done; list fetch errors no longer look empty |
| Distance fallback `"1 mile away"` | Now surfaces `"Distance unknown"` when omitted; Nearby syncs browser geo → profile lat/lng | Nearby sort **Improved** (`geolocation.ts` + `syncProfileLocation`) |
| Activity bar / palette “new — unverified” | Collapse persists (`zinder.activityBar.collapsed`); palette ⌘K + fuzzy + arrows work; mobile uses bottom tab bar (side bar hidden) | Nav shell is launch-worthy Partial; not a blocker |

---

## Current stack summary

| Layer | Choice |
| --- | --- |
| Framework | React 19 + TypeScript + Vite 8 |
| Routing | Hash shell routes: `#/discover` · `#/matches` · `#/profile` · `#/project-help…` (`lib/appRoutes.ts`) |
| State | Local `useState` only — no shared store / React Query |
| Styling | Tailwind v4 + Merge chrome / glass in `index.css` |
| Motion | Framer Motion; GSAP only in `MatchBloom` |
| API | Shared `src/api/client.ts` + `auth.ts`; `VITE_API_BASE` (default `http://localhost:8080/api/v1`); 401 → Auth |
| Tests | Vitest + jsdom (`npm test`); deck DOM + `appRoutes` hash parsing covered |
| Backend tests | Pytest present (`auth`, `browse` cursor, `swipe_undo`, etc.) |

---

## Gap table — screen / feature × status × notes

### Auth / session

| Feature | Status | Notes |
| --- | --- | --- |
| Login / register | Done | Live POST + cookies |
| Session bootstrap / restore-on-reload | **Done** | `App.tsx` calls `GET /auth/me` on boot; loading gate then Auth/shell |
| Real logout | **Done** | `POST /auth/logout` via `api/auth.ts`; clears client auth on success or failure |
| 401 → re-login | **Done** | `setUnauthorizedHandler` in `App.tsx` via `api/client.ts` |
| SSO / password reset | **Stubbed** | `lib/authStubs.ts`; Apple/Google show “soon” + info toast (not error); forgot-password same |

### Discover

| Feature | Status | Notes |
| --- | --- | --- |
| Candidate fetch | Done | `GET /matcher/browse` |
| Swipe LIKE / PASS / SUPERLIKE | Done | Live POST; match modal on `is_match` |
| Deck ghosting / DOM cleanup | **Done** | Cap via `lib/deckStack.ts` (`deckVisibleSlice` / `swipeTop`); `DiscoverDeck.tsx` wired; Vitest asserts ≤3 `[data-deck-card]` after ≥10 swipes |
| 3-card stack visual | **Verified** | `stackLayerStyle` in `lib/deckStack.ts` (1 / 0.94 / 0.88; RM 1 / 0.97 / 0.94); DiscoverDeck + Vitest |
| Loading / empty / error | **Improved** | Deck+browse+Matches+PH distinguish error vs empty with retry |
| Browse filters | **Done** | Chips send `tags=` on browse; Load more keeps cursor + tags |
| Sort (match / newest / nearby) | **Improved** | Query `sort` sent; Nearby prompts geo → `POST /profiles` lat/lng then re-browse |
| Server scores | **Improved** | `lib/browseScore.ts` prefers server `score`; estimate only when omitted; deck shows CompatibilityRing when score present |
| Distance | **Improved** | Server `distance_km` when coords exist; geo hint when Nearby locating/denied |
| Cursor pagination / infinite scroll | **Done** | `limit=20` + `next_cursor` Load more; tags query when chips selected |
| Swipe undo | **Done** | Optimistic UI + `DELETE /matcher/swipe/last`; rolls back on failure |
| View / filter persistence | **Done** | `#/discover?view=&sort=&tags=` via `lib/discoverRoutes.ts` |

### Matches / Chat

| Feature | Status | Notes |
| --- | --- | --- |
| Match list | **Done** | Live `GET /matcher/matches`; load error + retry (`matchesError`) |
| Last message preview | **Done** | Hydrates via `fetchLatestMessage` (`GET …/messages?limit=1`) after match list load |
| Chat send / receive | **Done** (real matches) | REST history/send/read + WS via `useMatchChat`; Matches inbox is match-only (PH threads on detail) |
| Typing / presence | **Improved** | Live WS for open chat; `onPresence` caches by `match_id` for inbox rows (`resolveMatchOnline`); no ID-hash dots |
| Selected conversation persistence | **Done** | `#/matches/:id` restores chat after refresh |

### Project Help

| Feature | Status | Notes |
| --- | --- | --- |
| List / detail / new hash routes | Done | Binding works |
| Create request | Done | Live POST; urgency often omitted |
| Interested / comments / status APIs | **Done** | Detail loads `GET /projects/{id}`; offer → interested+comment; status PATCH + accept helper; comment composer |
| Offer help | **Done** | `POST .../interested` + comment; withdraw via `DELETE .../interested` + detail button |
| Edit / cancel own request | **Done** | Owner edit via `PATCH /projects/{id}` (pending); cancel via status + confirm; cancelled hidden from All |
| Permission gating | **Improved** | Owner/helper checks stay in UI; BE returns **403** for “Only the…”; FE `formatProjectActionError` |

### Profile / nav / design

| Feature | Status | Notes |
| --- | --- | --- |
| Edit own profile | Done | Live GET/POST |
| Avatar upload UI | **Improved** | Client resize/JPEG compress via `lib/avatarImage.ts` before POST; still no CDN hosting |
| Public profile (other users) | **Done** | Gateway `GET /profiles/{id}`; `#/profile/:id`; Matches header + PH detail open `PublicProfileView` |
| Activity bar collapse persist | **Done** | `localStorage` key `zinder.activityBar.collapsed` |
| Command palette | **Done** | ⌘K; Actions: deck / browse / new PH; fuzzy + Vitest (`fuzzyScore`); ↑↓/Enter/Esc; capped at 12 |
| Mobile nav | **Improved** | Side bar hidden ≤767px; bottom tabs `fg-muted` + badge count in `aria-label` |
| Merge design system | **Partial → improved** | Matches chat now uses path kicker, merge-green out bubbles, mono composer |
| Notifications UI | **Missing** | No bell / feed |
| Accessibility pass | **Improved** | Skip link; deck keys; Matches `listbox`/`option` + unread labels; fg-muted/subtle contrast bumped for AA on `#0a0e12` |
| FE tests | **Partial** | Deck + palette + virtualList + MatchesInbox + `productJourney`; live smoke chat/undo/PH/browse cursor+tags |

---

## Prioritized Phase 3 backlog

### P0 — Correctness / trust (before calling anything “wired”)

1. ~~**Session bootstrap**~~ — Done (`GET /auth/me` on boot).  
2. ~~**Real logout**~~ — Done (`POST /auth/logout`).  
3. ~~**Discover deck regression test**~~ — Done (`npm test`: ≤3 `[data-deck-card]` after ≥10 swipes via `deckStack` + `DeckStackProbe`).  
4. ~~**Wire swipe undo**~~ — Done (`DELETE /matcher/swipe/last`).  
5. ~~**Shared API client**~~ — Done (`src/api/client.ts`, 401 → Auth).

### P1 — Launch-critical product surfaces

1. ~~**Chat WebSocket**~~ — Done for real matches (`api/chat.ts`, `hooks/useMatchChat.ts`).  
2. ~~**Project Help social wiring**~~ — Done (`api/projects.ts`, hub/detail).  
3. ~~**Browse cursor pagination**~~ — Done (`limit=20`, Load more via `next_cursor`).  
4. ~~**Unified routing**~~ — Done (hash tabs via `lib/appRoutes.ts`; refresh restores Discover / Matches / Profile / PH).  
5. ~~**Public profile**~~ — Done (`GET /profiles/{id}`, `#/profile/:id`, Matches + Project Help entry points).

### P2 — Launch polish

1. ~~**Edit / cancel own Project Help**~~ — Done (`PATCH /projects/{id}` + cancel confirm; cancelled filtered from All).  
2. Avatar upload — client compress Done (`avatarImage.ts`); real CDN hosting still open.  
3. Notifications bell + feed (once backend list/read exists).  
4. ~~**Merge chrome on Matches chat**~~ — Done (inbox path kicker, `chat-bubble--out/in`, mono composer).  
5. ~~**Discover deck a11y**~~ — Done (skip link, labeled swipe actions, keyboard ←/→/↑/U). ~~Shell contrast~~ **Improved** (`fg-muted`/`fg-subtle` AA bump, focus-visible, activity/mobile badge labels, Matches listbox).  
6. ~~**Split DiscoveryPage (Matches)**~~ — Started: `matches/MatchesInbox.tsx` + ChatChrome (~550 LOC out). ~~Discover/deck~~ **Done**: `DiscoverDeck.tsx` (~470 LOC out). ~~Browse~~ **Done**: `DiscoverBrowse.tsx` (~430 LOC out). ~~Match modal~~ **Done**: `MatchModal.tsx` extracted from DiscoveryPage.

### P3 — Nice-to-have

1. ~~**Persist browse filters in URL**~~ — Done (`#/discover?view=browse&sort=&tags=`).  
2. ~~**Virtualize long chat / request lists**~~ — **Done**: Matches inbox (≥24) + chat (≥40) + PH requests (≥24) via `lib/virtualList.ts`.  
3. ~~SSO / password reset~~ — **Stubbed** (honest copy; real OAuth/reset needs BE).  

4. ~~**Offline banner**~~ — Done (`OfflineBanner` + `useOnlineStatus` in `App.tsx`).  
5. Broader E2E: ~~hash journey~~ **Done** (`productJourney` incl. public profile + live smoke create/undo/chat). Playwright/Cypress still optional.

---

## Testing reality vs phase-2 scope

| Area | Scoped (intent) | Actual |
| --- | --- | --- |
| Backend contracts | Pytest for auth/browse/undo/chat | Present under `backend/tests/` |
| Frontend unit / component | Implied by “wired screens” | Deck DOM cap covered (`vitest` + jsdom) |
| E2E multi-interaction | **Done** (live API) | Hash journey Vitest + `LIVE_GATEWAY=1` smoke: auth→browse + swipe→match→chat + undo + project create |
| Priority for phase 3 tests | — | ~~deck DOM~~ ~~PH authZ 403~~ ~~live auth→browse~~ ~~swipe→match→chat~~ ~~swipe undo~~; CDN/notifications need BE |

---

## Live FE endpoints (still)

1. `POST /auth/login` · `POST /auth/register` · `GET /auth/me` · `POST /auth/logout`  
2. `GET /profiles/me` · `GET /profiles/{id}` · `POST /profiles`  
3. `GET /projects` · `POST /projects` · PH detail/interested/comments/status  
4. `GET /matcher/browse` · `GET /matcher/matches` · `POST /matcher/swipe` · `DELETE /matcher/swipe/last`  
5. Chat REST + WS  

**Backend-ready but FE-unused:** (none critical for Phase 3 P0/P1 wiring).

---

## Evidence anchors

- Auth bootstrap + logout: `src/App.tsx`, `src/api/auth.ts`  
- Shared client: `src/api/client.ts` (`VITE_API_BASE`, 401 → Auth)  
- Deck: `src/lib/deckStack.ts` + `DiscoverDeck.tsx` (`deckVisibleSlice` / `stackLayerStyle` / `swipeTop`, `data-deck-card`); tests `deckStack.test.tsx`, `DeckStackProbe.test.tsx`  
- Shell routes: `src/lib/appRoutes.ts` (`#/discover|matches[/:id]|profile[/:id]|project-help…`)  
- Public profile: gateway `GET /profiles/{id}`, `api/profiles.ts`, `PublicProfileView.tsx`  
- Chat live: `api/chat.ts`, `hooks/useMatchChat.ts`  
- Swipe undo: `DELETE /matcher/swipe/last` via Discovery rewind  
- Browse cursor + tags: DiscoveryPage Load more / filter chips  
- Activity bar key: `zinder.activityBar.collapsed`  
- Palette: `src/components/CommandPalette.tsx` (Actions + `fuzzyScore` tests)  
- Virtual lists: `src/lib/virtualList.ts` → Matches inbox (≥24) + chat (≥40) + PH list (≥24)  
- Journey E2E contract: `src/lib/productJourney.ts` (+ Vitest; includes `#/profile/:id`)  

- Live gateway smoke: `backend/tests/test_live_gateway_smoke.py` (`LIVE_GATEWAY=1`) — chat(+read_at) + undo + PH create/offer/uninterest/cancel/accept + browse cursor/tags  



- Browse scores: `src/lib/browseScore.ts` (+ Vitest); deck CompatibilityRing when `score` present  
- Auth stubs: `src/lib/authStubs.ts` (+ Vitest) → AuthPage SSO / forgot-password info toasts  
- Match presence cache: `useMatchChat` `onPresence` → `presenceByMatchId` → `resolveMatchOnline`  


- Nearby geo: `src/lib/geolocation.ts` → profile lat/lng + Discover browse hint  
- Matches/PH errors: `matchesError` / `projectsError` + retry in inbox / PH list  
- PH social: `api/projects.ts` (incl. `withdrawInterest`), hub/detail  


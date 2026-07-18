# Zinder Front-End Audit

**Date:** 2026-07-18  
**Scope:** `/Users/jaipandey/Desktop/projects/zinder/frontend`  
**Mode:** Investigation only — no feature code changed.

**Verdict:** The UI is a polished React/Vite SPA with real `fetch` calls to `localhost:8080`, but session handling, chat, project-help social features (offers, comments, status, urgency, interest), and match scoring/distance are largely client-local or fallback-filled. There is no router for core tabs, no shared store, no real-time transport, and no tests.

---

## Current stack summary

| Layer | Choice |
| --- | --- |
| Framework | React 19 + TypeScript + Vite 8 |
| Routing | None for core screens (`activeTab` in memory). Project Help uses hash routes (`#/project-help…`) |
| State | Local `useState` / `useMemo` only — no Context, Redux, Zustand, React Query |
| Styling | Tailwind CSS v4 + custom CSS variables / glass utilities in `src/index.css` |
| Motion | Framer Motion (primary); GSAP only in `MatchBloom.tsx` |
| Icons / fonts | lucide-react; Fraunces, Inter, IBM Plex Mono via `@fontsource*` |
| API | Raw `fetch` to hardcoded `http://localhost:8080/api/v1/...` with `credentials: 'include'` |
| Tests | None (no Vitest/Jest/Playwright/Cypress; no `*.test.*` / `*.spec.*`) |
| Bundle (built) | JS ~511 KB, CSS ~70 KB, plus large font subset files; public avatars ~650–760 KB PNG each |

---

## Step 1 — App map as it exists

### Routes / screens

There is **no React Router**. `App.tsx` toggles Auth vs Discovery on an in-memory `isAuthenticated` flag.

| Screen | How reached | Data source |
| --- | --- | --- |
| Auth (login / signup) | Default when `isAuthenticated === false` | **Live** `POST /auth/login`, `POST /auth/register` |
| Discover / Deck | Tab `discover` + view `deck` | **Live** `GET /matcher/browse` + heavy client fallbacks |
| Discover / Browse | Tab `discover` + view `browse` | Same browse payload; **client** filters/sort/scores |
| Matches list | Tab `matches` | **Live** `GET /matcher/matches`; last-message copy is hardcoded |
| Chat panel | Selecting a match | **Mock** — in-memory + canned `setTimeout` replies |
| Project Help list | Tab `projectHelp` → `#/project-help` | **Live** `GET /projects`; urgency/interest **derived client-side** |
| Project Help detail | `#/project-help/:id` | Project from API list; discussion/status/offers **local** |
| New Request wizard | `#/project-help/new` | **Live** `POST /projects` (urgency not sent) |
| Profile | Tab `profile` | **Live** `GET /profiles/me`, `POST /profiles` |

Hash routes **do exist** and bind real views: `#/project-help`, `#/project-help/new`, `#/project-help/:id` (`projectHelp/routes.ts` + `ProjectHelpHub.tsx`).

### Major components

| File | Purpose |
| --- | --- |
| `AuthPage.tsx` | Login/register form + validation |
| `DiscoveryPage.tsx` | Authenticated shell (~2k LOC): tabs, deck, browse, matches/chat |
| `ProfilePage.tsx` | Profile hero, edit, activity, preferences, logout button |
| `GatewayNetwork.tsx` | Decorative backdrop |
| `MatchBloom.tsx` | GSAP match celebration |
| `CompatibilityRing.tsx` | Score ring UI |
| `FloatingField.tsx` | Floating-label input |
| `RequestStepper.tsx` | Status badge / stepper primitives |
| `projectHelp/ProjectHelpHub.tsx` | Hash-routed coordinator |
| `projectHelp/ProjectHelpList.tsx` | Filterable/sortable request list |
| `projectHelp/ProjectHelpDetail.tsx` | Detail + offer drawer + local status |
| `projectHelp/ProjectHelpNew.tsx` | 3-step create wizard |
| `projectHelp/RequestCard.tsx` | List card (+ local status cycle) |
| `projectHelp/RequestProgressBar.tsx` | Progress bar |
| `projectHelp/ActivityTimeline.tsx` | 5-step activity UI |
| `projectHelp/CommentThread.tsx` | Read-only discussion renderer |
| `projectHelp/OfferHelpDrawer.tsx` | Offer message drawer |
| `projectHelp/TechChip.tsx` | Tech tag |
| `projectHelp/helpers.ts` | Faux interest, urgency, seed thread, etc. |

### Static / fixture patterns found

| Pattern | Status in codebase |
| --- | --- |
| Literal “Developer A” / “Developer B” | **Not found** |
| Fallback name `"Developer"` | **Yes** — when `p.user?.name` missing on browse/match modal |
| Fixed `"1 mile away"` | **Yes** — fallback when API omits `distance` |
| Sequential / synthetic match scores | **Yes** — `scoreCompatibility()` uses interest overlap + `candidate.id` arithmetic; with empty interests returns `28 + ((id * 37) % 71)` |
| Single seeded test user in FE | **No FE seed file** — auth is live; empty preference fields show “Add …” invites when API returns null/empty |
| Online presence | **Faux** — `isMatchOnline(id)` = `id % 3 !== 0` |
| Chat replies | **Canned** after 1.5s |
| Interested helpers on requests | **Faux pool** — Maya K., Jordan R., etc. via `deriveInterested(projectId)` |
| Request status / comments | **Client-only** after load |
| Default avatar | `/profile_3.png` (present in `public/`, ~756 KB) |

---

## Step 2 — Screen-by-screen audit

### Auth

| Concern | Finding |
| --- | --- |
| Login / signup | **Real** POST to backend with cookies |
| Session on reload | **Broken** — `isAuthenticated` starts `false`; no `/me` or cookie check on boot → user dumped to Auth even if cookie valid |
| Protected routes | Soft only: unauthenticated users never see Discovery; no redirect of deep links when cookie expired mid-session |
| Logout | **UI-only** — flips boolean; no `POST /auth/logout`, no cookie clear |
| SSO / password reset | Explicitly stubbed (“isn’t available in this preview”) |
| Forms | Email/password/name validation + loading disabled + error toast — solid for auth |

### Discover (Deck + Browse)

| Concern | Finding |
| --- | --- |
| API | `GET /matcher/browse`, `POST /matcher/swipe` |
| Loading | Spinner while fetching candidates |
| Error | Failures only `console.error` — UI collapses to empty “No more profiles” (not a true error state) |
| Empty | Implemented for deck + filtered browse |
| Scores / Nearby sort | Client-computed; Nearby sorts parsed miles from distance strings that often all fall back to “1 mile away” |
| Filters/sort persistence | **Lost on refresh** (in-memory) |
| Deck/Browse toggle | In-memory only |

### Matches + Chat

| Concern | Finding |
| --- | --- |
| Matches API | Live list; `lastMessage` always seeded as `"You matched — say hi"` |
| Chat transport | **Neither polling nor WebSocket** — fully local state |
| Persistence | Chat history **lost on refresh**; selected match **lost on refresh** |
| Real-time | **Core gap** — typing indicator + canned reply only |
| Loading / empty | Spinner + “No matches yet” |
| Error | No dedicated fetch-error UI |

### Project Help (list / detail / new)

| Concern | Finding |
| --- | --- |
| Routes | Real hash routes with data binding for list/detail/new |
| List API | Live `GET /projects` |
| Create API | Live `POST /projects` — **urgency omitted** from body |
| Detail | Bound to project id from list; missing id falls back to list after load |
| Offer help | Local only — creates match/chat seed client-side; no offers API |
| Comments | Seeded from description; no comment composer API; thread not persisted |
| Status transitions | Explicitly “local only”; clicking cycles client state |
| Wizard validation | Title ≥3, description ≥10, ≥1 tech; submit loading/success/error |
| Wizard step on refresh | **Lost** (hash can remain `#/.../new` but step resets to 0) |
| List filters/sort | In-memory; lost on refresh |
| Other-user profile from detail | Only opens own profile if requester is self; **no public profile route** |

### Profile

| Concern | Finding |
| --- | --- |
| Load / save | Live GET me + POST profiles |
| Loading / error / retry | Loading spinner; empty profile shows “Couldn’t load” + Try again |
| Empty preference fields | Not literal “Not set” — dashed “Add tagline / skills / looking for / radius / age” invites when null |
| Validation | Age field has min/max in edit; **no** bio length limit, interest max count, or image size validation; avatar as base64 in JSON |
| Submit disabled | Save button disabled while `saving` |
| Activity tab | Derived client-side from matches + projects |

### Cross-cutting

| Concern | Finding |
| --- | --- |
| State sharing | Props + parent state in `DiscoveryPage`; Project Help local overlays in hub |
| Refresh survival | Project Help **hash** survives; auth flag, active tab (except PH hash), selected match, chat, wizard step, browse filters, project statuses/threads/offers **do not** |
| Accessibility | Global `:focus-visible` outline; many icon buttons have `aria-label`; sidebar logout uses `title` only (no `aria-label`); password toggle has label; deck Pass/Like use `title` more than labels; CommentThread has no live-region for new comments |
| Responsive | Desktop sidebar + mobile bottom nav; Matches list/chat split hides list when chat open on small screens; Project Help / Profile use `sm`/`md` breakpoints — layouts exist for mobile |
| Performance | DiscoveryPage is a monolith; Framer Motion on cards/chat/list stagger; GSAP on match bloom; large unoptimized PNGs; GSAP dependency only used in one file; no image CDN/lazy strategy beyond browser defaults; 60fps under long chat/history **unverified** (no perf tests) |
| Testing | **None** |
| Offline / 404 | No service worker / offline UI; PH missing id → navigate to list; no global API 401 → logout handler |

### Live API surface (all callers)

1. `POST /api/v1/auth/login` — AuthPage  
2. `POST /api/v1/auth/register` — AuthPage  
3. `GET /api/v1/profiles/me` — DiscoveryPage  
4. `POST /api/v1/profiles` — ProfilePage  
5. `GET /api/v1/projects` — DiscoveryPage  
6. `POST /api/v1/projects` — ProjectHelpHub  
7. `GET /api/v1/matcher/browse` — DiscoveryPage  
8. `GET /api/v1/matcher/matches` — DiscoveryPage  
9. `POST /api/v1/matcher/swipe` — DiscoveryPage  

---

## Step 3 — Gap tables, backlog, backend assumptions

### Gap table — Discover

| Feature | Status | Notes |
| --- | --- | --- |
| Candidate fetch | Done | Live browse endpoint |
| Swipe LIKE/PASS/SUPERLIKE | Done | Live swipe; match modal on `is_match` |
| Deck empty / loading | Partial | Empty + loading yes; network error looks like empty |
| Browse filters | Done | Client-side interest chips |
| Browse sort (match / newest / nearby) | Partial | UI done; match & nearby not backed by real geo/score API |
| Compatibility scores | Mock | Client formula; can look sequential when interests empty |
| Distance display | Partial | Fallback `"1 mile away"` when API omits field |
| Undo / rewind | Partial | Local stack only — does not un-swipe on server |
| View persistence | Missing | Deck/Browse + filters reset on reload |

### Gap table — Matches / Chat

| Feature | Status | Notes |
| --- | --- | --- |
| Match list | Done | Live matches |
| Last message preview | Mock | Hardcoded seed string |
| Chat send/receive | Mock | Local state + canned reply |
| Real-time (WS/poll) | Missing | Architecture blocker |
| Read receipts / typing | Mock | Local only |
| Online presence | Mock | Deterministic from id |
| Selected conversation persistence | Missing | Lost on refresh |
| Unread badges | Partial | Client `unread` flag; not from API |

### Gap table — Project Help

| Feature | Status | Notes |
| --- | --- | --- |
| List / detail / new routes | Done | Hash routes with binding |
| Create request | Done | Live POST; urgency not persisted |
| List search/sort/tabs | Partial | Client-only; lost on reload |
| Urgency | Mock | Keyword / id derivation + local override |
| Interested helpers | Mock | Fixed name pool from project id |
| Offer help | Mock | No API; synthesizes Matches entry |
| Discussion / comments | Mock | Seeded; no composer → API |
| Status transitions | Mock | Local cycle; labeled as such |
| Edit / cancel request | Missing | No UI or routes |
| Notifications | Missing | No view |

### Gap table — Profile / Auth / Platform

| Feature | Status | Notes |
| --- | --- | --- |
| Login / register | Done | Live |
| Session restore | Missing | Reload → Auth screen |
| Logout | Partial | Clears UI flag only |
| Edit profile | Done | Live save |
| Empty field UX | Partial | Invite CTAs; fields stay empty if API never returns them |
| Public user profile | Missing | Detail “View profile” only works for self |
| SSO / password reset | Missing | Stubbed |
| API client / env base URL | Missing | Hardcoded localhost |
| Tests | Missing | Zero coverage |
| Offline / 401 handling | Missing | — |

---

### Prioritized backlog

#### Must-fix before real backend integration

1. **Session bootstrap** — on app load, call session/`profiles/me`; set auth from cookie; redirect unauthenticated deep links.  
2. **Real logout** — server invalidate + clear cookie; wire sidebar/profile Sign out.  
3. **Centralize API base URL** — env-driven client; stop scattering `localhost:8080`.  
4. **Distinguish empty vs error** on browse/matches/projects (retry UI).  
5. **Stop lying with fallbacks** — surface missing name/distance/image instead of `"Developer"` / `"1 mile away"` / default avatar when integrating real data (or require backend to always send them).  
6. **Chat architecture decision** — replace mock `setTimeout` with WebSocket or polling contract; do not ship Matches as “done” until then.  
7. **Persist or clearly label** project status, offers, comments, urgency — either wire APIs or hide as demo.  
8. **Auth 401 interceptor** — force re-login when cookie dies mid-session.

#### Should-have

1. React Router (or equivalent) for Discover / Matches / Profile / Project Help so refresh keeps the screen.  
2. Persist selected match + chat history via messaging API.  
3. Server-side compatibility score + real geolocation for Nearby.  
4. Public profile route for other users.  
5. Edit/cancel/delete own project requests.  
6. Send urgency (and status) on project create/update.  
7. Image upload pipeline (not raw base64 in profile JSON); compress public PNGs.  
8. Split `DiscoveryPage.tsx` monolith; shared query cache.  
9. Profile form validation (bio max length, interest limits, age required).  
10. Aria-labels on remaining icon-only controls (logout, deck actions).

#### Nice-to-have

1. Notifications view + unread from server.  
2. SSO / password reset.  
3. Virtualized chat / long request lists.  
4. Remove or tree-shake unused GSAP if MatchBloom can stay Framer-only.  
5. E2E (Playwright) for auth → swipe → match → project create.  
6. Offline banner.  
7. Persist browse filters in URL query params.

---

## Assumes backend will provide

Reconcile this list against the back-end audit:

1. **Cookie/session auth** that survives reload, plus **logout** invalidation.  
2. **Stable profile payload** for `/profiles/me` and browse cards: name, bio, age, interests, looking_for, radius_limit, image URL, distance (or lat/lng for client/server distance).  
3. **Real matcher scores** (or explicit “no score” so FE stops fabricating).  
4. **Geolocation / distance** for Nearby sort — not a constant mile string.  
5. **Swipe undo** semantics if FE rewind should be more than cosmetic.  
6. **Matches feed** including last message, unread counts, timestamps from a messaging store.  
7. **Persisted chat**: message history, send, delivery/read, typing (via **WebSocket or SSE/polling**).  
8. **Online/presence** (or FE removes the indicator).  
9. **Project model extensions**: urgency, status lifecycle, interested helpers / offers.  
10. **Offers API** — create offer, list interested users, accept/assign helper.  
11. **Comments / discussion API** on project requests.  
12. **Status transition API** with authZ (owner vs helper).  
13. **Request edit/cancel/delete** endpoints.  
14. **Notification triggers** (match, offer, comment, status change) + list/read API.  
15. **Public profile by user id** for “View profile” from Project Help / Matches.  
16. **Image hosting** (upload URL or object storage) instead of embedding base64 in profile POST.  
17. **Consistent error shapes** (`detail` / `message`) and **401** for expired sessions.  
18. **CORS + cookie** settings aligned with the FE origin (not only localhost during preview).

---

## Implied-but-missing routes / surfaces

- Other user’s public profile  
- Edit / cancel submitted project request  
- Notifications inbox  
- Dedicated chat deep-link (`/matches/:id`)  
- Settings beyond Profile preferences  
- Password reset / SSO callbacks  

---

## Evidence anchors (key files)

- Auth gate: `src/App.tsx`  
- Login/register: `src/components/AuthPage.tsx`  
- Shell + discover + chat mock: `src/components/DiscoveryPage.tsx`  
- Profile save: `src/components/ProfilePage.tsx`  
- Hash routing: `src/components/projectHelp/routes.ts`  
- Faux interest/urgency/thread: `src/components/projectHelp/helpers.ts`  
- Hub create/offer local: `src/components/projectHelp/ProjectHelpHub.tsx`

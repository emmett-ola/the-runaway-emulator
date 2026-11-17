# Backlog

Deferred work and deferred questions, one row each, with the reason it waits. Nothing here is a
commitment: an item leaves this file by becoming a version in `versions/` (or by landing in a
version's scope), and an item that will never be done moves to *Closed* with the reason.

How we discuss it: one group at a time, one answer per row — **do it**, **later**, or **not**.
*Do it* turns the row into a version scope and a record; *later* keeps the row and refreshes the
reason; *not* moves it to Closed with a line saying why.

## 1. Ready to decide

Owner answer needed; the decision is what unlocks a version.

| Item | What it is | Why it waits | Size |
| --- | --- | --- | --- |
| Test isolation | Files share process-global storage state (fake IndexedDB plus the storage singleton), so the suite runs sequentially (`fileParallelism: false`, 20 s ceiling) to stay deterministic | Root cause known; only priority is missing. The fix is a per-file storage reset, not a longer timeout | small |
| Accessibility round | Clear the recorded contrast findings (Login 1 node, Home 24, Settings 1, Print 22 + 1 `scrollable-region-focusable`) and set an axe threshold later changes must hold | Needs the threshold the owner accepts (zero serious? zero critical only?) and whether the palette may change | medium |
| CI browser E2E | Real-browser flows in CI (login, run, reload persistence, print dialog, import/export) | Undefined: which flows, how browsers are installed in CI, whether a red E2E blocks a release | medium |
| PWA beyond the update path | Install prompt, offline editing, an offline-first caching policy | 2.0.1 shipped automatic adoption of new builds; the rest has no agreed behaviour, so it cannot be accepted | medium |
| CI speed | Cut wall time: test parallelism after isolation, dependency caching, job split | Deliberately after test isolation — optimising an unstable base is waste | small |
| Remaining dependency advisories | 12 low/moderate advisories left after the 2.0.0 audit cleared all critical and high | No exploitable path identified; needs a decision on whether transitive bumps deserve a round | small |

## 2. Gated on a condition

No decision needed now; each row states what would start it.

| Item | Trigger | Today |
| --- | --- | --- |
| Cloud storage | Owner opens it deliberately. Seven-step plan written ([plan](cloud-delivery-plan.md)), model in [cloud](../facts/cloud.md), DDL in [contract](../contract/postgres-schema.sql) | designed, planned, not implemented |
| Run-index sharding | Measured index cost exceeds an agreed budget. Recorded Node/jsdom/fake-IDB numbers, relative not absolute: 1k hits → 95.7 KB / 39.6 ms; 10k → 910 KB / 252 ms; 50k → 4.57 MB / 1,183 ms | single index; no budget line defined yet |
| Firefox verification | Build host Playwright/browser revisions match (`firefox-1555` installed, `firefox-1572` expected) | Chromium and WebKit smoke pass; Firefox unexercised |
| Real power-loss durability | Owner authorises hardware validation | claim is design guarantee plus injectable fault tests |

## 3. Product ideas

One row per idea, carried from the pre-rebuild wishlist. Each needs an owner answer before it can
become a version; *touches* names the invariant set it would change.

### Calendar and history

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Custom date range | Pick a start and end; see or export only that window | S1 (R6, R7) |  |
| Week / year / list views | Alternative renderings of the same hit set | S1 (R6) | month view only today |
| Lazy days + virtual scrolling | Render only what is visible for very large histories | S1 performance | related to run-index sharding, not the same thing |
| Calendar colour themes | More than the one shipped theme, saved per device | S1, S5 (S1) | preference only, no data change |

### Interaction

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Keyboard shortcuts | Space/Enter to run, arrows to navigate | S1 (R4) | must not double-count |
| More run-button variations | Walking, jumping, flying variants | S1 (R4) | animation cost, no data change |
| Particles and confetti | Effects on run and on milestones | S1 | pure decoration |

### Goals and insight

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Daily/weekly goals | Set a target and see progress | S1, S6 (new stored fact) | needs a stored shape and a migration |
| Achievement badges | Unlock conditions over stored history | S2 (G4), S6 |  |
| Pattern insights | "You escape most on Mondays" | S1 (R6) | derived only, nothing stored |
| Weekly/monthly reports | Periodic summary, printable | S1, S5 (S5) |  |

### Sharing

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Calendar as an image | Export the month as a picture | S1 |  |
| Read-only share link | Publish a calendar to a URL | new surface, privacy boundary | needs a hosting decision and conflicts with PD-2 unless explicit |
| Opt-in anonymous statistics | Contribute to aggregate numbers | privacy boundary | needs a consent design |
| Community comparison | Compare with other users | privacy boundary |  |

### Mobile

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Native or React Native app | A separate client | whole product | a second codebase, not a feature |
| Touch gestures | Swipe between months | S1 |  |
| Haptic feedback | Vibration on run | S1 |  |

### Privacy and data

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Clear-all-data control | Delete the local account and its files from Settings, after an export prompt | S5 (new), [storage](../facts/storage.md) | a product gap rather than an idea: no invariant covers deletion today |
| Encryption at rest | Encrypt the IndexedDB payloads | [storage](../facts/storage.md) | no threat model: the key would live beside the data on the same device; overlaps the durability limit already recorded |

### Content

| Idea | What it means | Touches | Note |
| --- | --- | --- | --- |
| Story progression | Narrative that advances with real time | S1, S2 |  |
| Additional action buttons | Actions other than Run, each with an effect | S1 (R1–R4) | every button needs its own counting invariant |
| The three unbuilt games | Slot machine, achievements game, daily challenges | S2 (G3) | labelled coming soon today; PD-8 says no commitment behind them |

## 4. Closed

| Item | Closed on | Why |
| --- | --- | --- |
| Several language versions of the front page | 2026-11-17 | owner wants `README.md` and `README_CN.md` side by side; `spec/` stays English |
| `archived/` and `design/` directories | 2026-11-17 | deleted in 2.1.0; Git history keeps them |
| The 2026-11-11 local stash | 2026-11-17 | discarded with evidence in [2.1.0](../versions/2.1.0.md); only its `.gitignore` entries were worth keeping |
| Cloud host, co-location and polling latency | 2026-11-17 | settled as rulings in [cloud](../facts/cloud.md) §9, with a three-state sync indicator required in the UI |

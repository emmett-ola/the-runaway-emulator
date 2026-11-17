# Backlog

Deferred work and deferred questions, with the reason. Nothing here is a commitment or a
schedule; an item leaves this file by becoming a version in `versions/`.

## Deferred by owner decision

| Item | Why it waits |
| --- | --- |
| Cloud storage (PostgreSQL plus thin API) | designed, and now planned in seven steps ([delivery plan](cloud-delivery-plan.md)); the three open rulings were settled 2026-11-17; **not implemented and not scheduled** — the owner opens it deliberately. Model in [cloud](../facts/cloud.md), DDL in [contract](../contract/postgres-schema.sql) |
| CI browser E2E | owner deferred it to a later version; the gates stay unit-level until then |
| Deeper PWA work (install prompt, offline editing) | 2.0.1 shipped the update path; the rest has no defined acceptance |
| CI optimisation (caching, matrix) | owner deferred; current wall time is acceptable |
| Accessibility / design round | serious colour-contrast findings recorded in 2.0.0 (Login 1 node, Home 24, Settings 1, Print 22 plus one `scrollable-region-focusable`); fixing them is that round's job |

## Deferred on a measured or environmental condition

| Item | Condition |
| --- | --- |
| Run-index sharding | only when measured index cost exceeds the agreed budget. Recorded Node/jsdom/fake-IDB measurements, relative not absolute: 1k hits → 95.7 KB / 39.6 ms; 10k → 910 KB / 252 ms; 50k → 4.57 MB / 1,183 ms |
| Firefox verification | blocked on the build host: `firefox-1555` installed versus `firefox-1572` expected. Environment limitation, not a product defect |
| Real power-loss durability | needs owner-authorised hardware validation; today the claim is design guarantee plus injectable fault tests |
| Test isolation (vitest file parallelism) | files share process-global storage state (fake IndexedDB plus the storage singleton), so `settings-header-import` failed under parallel load once the suite passed ~570 cases. Files now run sequentially with a 20 s ceiling; the real fix is a per-file storage reset, not a longer timeout |

## Product ideas, no owner decision

Carried from the pre-rebuild roadmap; none is planned. Each needs an owner decision and a
version before work starts.

- Calendar: custom date range, week/year/list views, lazy day rendering and virtual scrolling
  for large logs, calendar colour themes (one theme shipped).
- Interaction: keyboard shortcuts, more run-button variations, particle/confetti effects.
- Goals and insight: daily/weekly goals, achievement badges, pattern insights ("you escape most
  on Mondays"), weekly/monthly reports.
- Sharing: share the calendar as an image or a read-only link, opt-in anonymous statistics,
  community comparison.
- Mobile: React Native or native apps, touch gestures, haptic feedback.
- Privacy: encrypting stored data at rest, an explicit "clear all data" control (export first).
- Content: story progression over real time, additional action buttons, the unbuilt games
  (slot machine, achievements, daily challenges) that PD-8 lists as placeholders.

Cloud specifics now fixed by the owner: remote host, API and database not assumed co-located,
polling delay accepted, and the interface must show *syncing* / *not synced* / *synced*. Those are
recorded as rulings in [cloud](../facts/cloud.md) §9, not as backlog items.

## Closed by owner decision (2026-11-17)

- `README_CN.md` **stays**: several language versions of the front page are wanted. `spec/` stays
  English; only the README is multilingual.
- `archived/` and `design/` were **deleted** in 2.1.0. Git history keeps them.

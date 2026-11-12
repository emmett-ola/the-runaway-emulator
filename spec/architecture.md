# Target architecture

Scope: a single-page React 19 + Vite application, no server code of its own,
device-local storage, one deployment target. The target is small on purpose: the
rebuild exists to remove structural costs, not to add layers.

Current structure (for reference, not authority): 45 source files, 7,366 lines;
`src/components/Dashboard.tsx` at 603 lines holds run animation, hit recording,
fork-mode state, settings loading, scene wiring and the print entry; `src/pages`
holds routed surfaces and two unreachable files (`Storage.tsx`, `Releases.tsx`).

## Target layout

```
src/
  app/
    App.tsx            router, providers, session gate
    routes.tsx         the route table, one entry per surface
  features/
    run/               run button, hit recording, statistics, calendar, log
    scene/             the post-run scene (R1)
    games/             fork-in-the-road, card album
    settings/          appearance, locale, timezone, data management, print entry
    print/             the printable calendar dialog
    profile/           profile read, email edit
    about/             static surface, version string
  lib/
    storage/           the only module allowed to touch localStorage
    i18n/              typed locale modules, parity test, `useT()`
    time/              timezone-aware date bucketing
  ui/                  Layout, Navigation, shared presentational components
```

## Boundaries (the part that must be enforced by review)

1. **`lib/storage` is the only module that reads or writes `localStorage`.** A
   feature asks storage for data; it never constructs a key. The existing keys
   (`runawaylog-data`, `runawaylog-current-user`, `runawaylog-token`,
   `runawaylog-timezone`, `app-theme`, `app-language`) stay readable, and the
   migration path lives here (see `data-model.md`).
2. **`lib/i18n` is the only module that reads locale data.** Features call `t()`.
   No component imports a locale file directly, and no string literal for
   user-visible copy is allowed outside `lib/i18n/locales` (the existing
   hardcoded-copy test already encodes this rule; it moves here).
3. **`lib/*` never imports from `features/*` or `app/*`.** Dependencies point
   one way, which is what makes a feature testable without mounting the app.
4. **Features do not import each other's internals.** Cross-feature needs go
   through a small, named interface owned by the provider, or through `lib`.
   The run feature owning the scene trigger is an interface, not a deep import.
5. **One state owner per fact.** The stored record is authoritative for hits and
   profile; a feature may cache a derived view but must not hold a second
   writable copy. Today's `runawaylog-current-user` mirror that never receives
   hits is exactly the pattern this rule forbids.

## Size expectations

| Module | Target | Fails when |
| --- | --- | --- |
| any single component | ≤ 150 lines | a component both renders a surface and owns persistence or timing logic |
| `lib/storage` | ≤ 300 lines | it grows per-feature special cases instead of one record shape plus migrations |
| a feature directory | ≤ 6 files | it starts owning another feature's state |

These are alignment targets, not gates: a file that exceeds them needs a reason in
its pull request, not a split for its own sake.

## What the rebuild deliberately does not add

No state-management library (React state and one storage module are enough), no
CSS framework (the existing plain CSS moves with its components), no server, no
authentication service, no cloud storage. The cloud option stays visibly
unavailable, as it is today.

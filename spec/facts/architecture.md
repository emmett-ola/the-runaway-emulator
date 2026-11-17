# Architecture

A single-page React 19 + Vite application with no server code of its own, device-local
storage and one deployment target. It is small on purpose: the rebuild removed structural
cost, it did not add layers.

## Layout (as shipped)

```
src/
  app/            App.tsx (router, providers, session gate), routes, document metadata
  pwa.ts          service-worker registration: update poll, single reload on controller change
  features/
    run/          run button, hit recording, statistics, calendar, log
    scene/        the post-run scene
    games/        fork-in-the-road, card album
    settings/     appearance, locale, timezone, data management, print entry
    print/        printable calendar dialog
    profile/      profile read, email edit
    about/        static surface, version string, release notes
  lib/
    storage/      the only module that touches IndexedDB; virtual file tree, generations, recovery
    data/         archive export/import (zip), validation, transfer logic
    identity/     local password identity; credentials live outside the account tree
    i18n/         typed locale modules, `useT()`, `t(key, vars)`
    time/         timezone-aware date bucketing
    games/        card and catalog logic
    scene/        scene selection
  test/           cross-surface invariants, fixtures, parity and hardcoded-copy scans
  ui/             layout, navigation, shared presentational components
```

The legacy tree (`src/components/Dashboard.tsx` and friends) is gone; the surface-by-surface
cutover completed in 1.2.0. Stored bytes are described in [storage.md](storage.md), sign-in
in [identity.md](identity.md), locales in [i18n.md](i18n.md).

## Boundaries (enforced by review and by tests)

1. **`lib/storage` is the only module that reads or writes persisted data.** Features ask
   storage; they never construct a database name, a file path or a key. Legacy
   `localStorage` keys are not read at all by 2.0.0+ (`runawaylog-data` and the mirrors stay
   on disk untouched, ignored).
2. **`lib/identity` owns credentials.** Password derivation and the credential record live
   there; the account tree never contains a password or a hash.
3. **`lib/i18n` is the only module that reads locale data.** Features call `t()`. No component
   imports a locale file directly, and no user-visible string literal exists outside
   `lib/i18n/locales` (the hardcoded-copy scan encodes this).
4. **`lib/*` never imports from `features/*` or `app/*`.** Dependencies point one way, which
   is what makes a feature testable without mounting the app.
5. **Features do not import each other's internals.** Cross-feature needs go through a named
   interface owned by the provider, or through `lib`.
6. **One state owner per fact.** The stored record is authoritative for hits and profile; a
   feature may cache a derived view but must not hold a second writable copy.

## Size expectations

| Module | Target | Fails when |
| --- | --- | --- |
| any single component | ≤ 150 lines | a component both renders a surface and owns persistence or timing logic |
| `lib/storage` + `lib/identity` | facade ≤ 120 lines; responsibility files ≤ 200–250; runtime aggregate ≤ 1,900 (excluding pure models, migrations and tests); identity + credential handling ≤ 300 | it grows per-feature special cases instead of bounded responsibilities |
| `lib/data` transfer | facade ≤ 150 lines; archive/validation each ≤ 250; runtime aggregate ≤ 650 | transfer responsibilities exceed the agreed aggregate |
| a feature directory | ≤ 6 files | it starts owning another feature's state |

These are alignment targets, not gates: exceeding one needs a reason in the version record,
not a split for its own sake.

## What the architecture deliberately does not add

No state-management library, no CSS framework, no server in this repository, no
authentication service, no operating cloud storage. The cloud model is designed and
disabled — it lives in [cloud.md](cloud.md) and is not reachable from the app.

# 0004 — One storage module owns persistence and migrations

- Date: 2026-11-12. Decider: Maia (operating decision, framework delegation).
- Status: accepted.

## Context

Three modules reach into `localStorage` today, the same facts exist in two places
(`runawaylog-data` and a `runawaylog-current-user` mirror whose `hits` array is
never updated), and time is stored twice per hit — `timestamp` and a frozen
`date` string bucketed with the timezone of that moment. Two recorded defects come
straight out of that shape: changing timezone cannot re-bucket history, and a
record without `registrationDate` invents a new date on every mount (D-12).

## Decision

`src/lib/storage` is the only module that touches `localStorage`. It owns:

- the `Store` shape (`schemaVersion: 2`) and the `UserRecord`/`Hit` types;
- a pure `migrate(raw, now)` that converts both legacy shapes, derives and persists
  a missing registration date from the earliest hit, preserves unknown keys, and is
  idempotent;
- one read path and one write path for features, plus export/import built on the
  same migration.

Hits store `at` (UTC ms) only; the date a user sees is derived at render time from
the current timezone. Preferences (language, theme, timezone) remain device-level
and outside the user record.

## Consequences

- D-12 is closed by construction: there is no render-time fallback to invent.
- A timezone change re-buckets history honestly, which is what a user expects and
  what the calendar claims.
- Features become testable without a browser: they take data, not storage keys.
- One migration is a single place to be careful in, instead of three places to be
  consistent in.

## Evidence

`spec/data-model.md`; defect register D-12; the `runawaylog-current-user` mirror
observed empty of hits in the 2026-11-12 health check.

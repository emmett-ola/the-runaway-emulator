# Data model and migrations

The application is device-local. There is no server, no account service and no
synchronisation; "Cloud storage" is advertised and disabled. Everything below is
one browser's `localStorage`.

## What exists today (evidence, not authority)

| Key | Shape | Notes |
| --- | --- | --- |
| `runawaylog-data` | `{ [username]: UserRecord }` | the real store |
| `runawaylog-current-user` | `UserRecord` | auth cache; its `hits` array is never updated — nothing reads it |
| `runawaylog-token` | `{ token, expiresAt }` | mock token, no security meaning |
| `runawaylog-timezone`, `app-theme`, `app-language` | strings | device preferences |

`UserRecord` is `{ username, hits: HitLog[], profile: { registrationDate, email? }, settings? }`
and `HitLog` is `{ id, timestamp, date }`, where `date` is a `YYYY-MM-DD` string
bucketed **at creation** using whatever timezone was set at that moment.

Three defects follow from that shape, and the target model removes each by
construction rather than by patching call sites:

1. `date` is frozen at creation, so changing timezone re-buckets nothing and the
   stored string can disagree with the calendar the user now expects.
2. `profile.registrationDate` is optional in practice, so a record without it gets
   a fresh "now" — the drift recorded as D-12.
3. The `runawaylog-current-user` mirror holds a second writable copy of the same
   facts.

## Target model

```ts
type Store = {
  schemaVersion: 2;
  users: Record<string, UserRecord>;
  unknown?: Record<string, unknown>; // preserved keys this version does not model
};

type UserRecord = {
  username: string;
  registeredAt: number;          // UTC ms, written once, never recomputed
  hits: Hit[];                   // append-only
  profile?: { email?: string };
};

type Hit = {
  id: string;                    // stable, unique; the merge key
  at: number;                    // UTC ms — the only time source
};
```

- **Rendering derives the date.** Day bucketing for the calendar, statistics and the
  log is computed from `at` plus the current timezone (`lib/time`). No stored
  `date` field survives the migration, so a timezone change re-buckets history
  honestly and no stored string can contradict the display.
- **`registeredAt` is written once.** For a legacy record, the migration derives it
  from the earliest `hit.at`; when there is no hit, from the moment of migration —
  and writes it back, so a later visit reads it instead of inventing one. This
  closes D-12 without a second "fallback at render" path.
- **Preferences stay device-level.** Language, theme and timezone describe this
  browser, not the person; they keep their own keys and are not exported as user
  data (the current export includes timezone and theme, and that inconsistency is
  acceptable to lose).
- **Unknown data is preserved.** Keys the current schema does not model are copied
  into `unknown` rather than dropped: a user's file is not ours to trash.

## Migration

`lib/storage/migrate.ts`, pure function `migrate(raw: unknown, now: number): Store`
with a table-driven test set:

| Input | Output |
| --- | --- |
| `{ [username]: legacyUser }` | `schemaVersion: 2`, users map, `registeredAt` derived, `hits[].date` dropped, `settings` folded into device preferences or discarded |
| `schemaVersion: 2` | returned unchanged (idempotent) |
| unreadable JSON / wrong shape | fresh empty store, raw value copied to `unknown.backup` so a later export can rescue it |
| a hit without `id` or `at` | kept with a generated `id` and `at` from its parseable `date` at 00:00 local; dropped only if neither exists, and the drop is reported by the loader |

Rules: migration runs once per load before any read; it never deletes a user;
it is idempotent; and it is the only place allowed to write the legacy shapes
back. A migration that cannot classify an input throws a typed error that the
loader turns into an empty store plus a preserved backup — never into a silent
empty store.

## Import and export

- Export writes the current `Store` for one user as a human-readable JSON document
  with `schemaVersion`, and includes language/theme/timezone as *metadata only*
  (ignored on import, so a restore cannot silently change this device's look).
- Import accepts either shape (legacy user record or v2 store), runs the same
  migration, and offers merge or replace. Merge dedupes by `hit.id`; replace is
  total and confirmed. Import never writes without one confirmation step.

## Sequencing (added 2026-11-12 after the first dispatch was blocked)

The on-disk switch to `schemaVersion: 2` **cannot** land before `src/auth.ts` is
rewritten: `auth.ts:160-176` and `:237-239` read and write the legacy map directly,
and a v2 store under the same key would make every existing user look new. That is
a real contradiction, caught by the developer before any code was written.

So the target above lands in two stages, same direction:

1. **Now (step 1a):** `lib/storage` becomes the single owner of the legacy bytes —
   one parse, one write path, used by both `src/storage.ts` and `src/auth.ts` — and
   repairs a missing registration date on read, writing it back. `Hit.date` becomes
   derived at render time; nothing else about the shape changes.
2. **With the auth rewrite** (skeleton/shell step): the same module migrates to
   `schemaVersion: 2` behind the tests written in stage 1, and `auth.ts` calls the
   typed record instead of the raw map.

Until stage 2, "v2" describes the direction, not the file on disk. Recorded here
rather than silently deferred, because a shape change is exactly the kind of thing
that must not be discovered by a user.

## Acceptance for this document

A reviewer can: (1) take any legacy `localStorage` dump, run the migration, and
predict the resulting `Store` exactly; (2) change the timezone and see history
re-bucket; (3) delete `registeredAt` from a record and observe that the next load
restores a value derived from history and persists it; (4) round-trip export →
import with no hit lost or duplicated.

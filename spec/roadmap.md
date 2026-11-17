# Roadmap status records

These are status records, not a schedule or commitment. Measurements and release
status below are owner-supplied facts, not rerun measurements, independently
verified deployment, or independent acceptance.

## Cloud storage

status: designed
trigger: owner decision + the three pending rulings in ADR 0007 §9.

Not built. See [ADR 0007](decisions/0007-canonical-cloud-model.md) and
[`spec/cloud/postgres-schema.sql`](cloud/postgres-schema.sql).

## CI browser E2E

status: deferred
trigger: owner decision to resume in a later version.

Deferred by the owner to a later version.

## PWA update path

status: deferred
trigger: owner decision and defined acceptance.

Deferred by the owner; no acceptance is defined.

## Accessibility

status: baseline
trigger: the later owner-authorized accessibility/design round.

Measured with axe: 0 critical / serious color-contrast violations. Separately,
recorded baseline findings have these node counts; this is not a zero-all-violations claim:

| Surface | Recorded baseline findings |
| --- | --- |
| Login | 1 node |
| Home | 24 nodes |
| Settings | 1 node |
| Print | 22 nodes + 1 `scrollable-region-focusable` finding |

The owner chose to ship 2.0.0 with these findings recorded and fix them in a later
accessibility/design round.

## Cross-browser

status: baseline
trigger: compatible browser revisions/cache before broader measurement.

Chromium and WebKit pass critical-path smoke. Firefox is blocked on this host by
a Playwright/browser revision mismatch: `firefox-1555` installed versus
`firefox-1572` expected. The full Chromium build was missing from the cache at
measurement time. These are environment limitations, not product defects.

## Durability

status: baseline
trigger: owner-authorized real power-loss validation before any stronger claim; no commitment.

The baseline consists of design guarantees + injectable fault tests. Real
power-loss behavior is a documented limitation, not a tested claim.

## Run-index sharding

status: deferred
trigger: measured index cost exceeds the agreed budget.

Recorded Node/jsdom/fake-IDB measurements are relative, not absolute:

| Hits | Index size | Append time |
| --- | --- | --- |
| 1k | 95.7 KB | 39.6 ms |
| 10k | 910 KB | 252 ms |
| 50k | 4.57 MB | 1,183 ms |

## Local password identity

status: baseline
trigger: none for the shipped baseline; any recovery would need a separate owner decision.

Shipped in 2.0.0 per the owner packet; see
[ADR 0008](decisions/0008-local-password-identity.md). No recovery by design.
Shipped as 2.0.1 including the quieter login copy; `spec/versions.md` carries rows for
2.0.0 and 2.0.1 with their verified deployment identities.

## Test isolation (vitest file parallelism)

status: deferred
trigger: anyone making the storage tests independent again.

Test files share process-global storage state (fake IndexedDB plus the storage
singleton), so running them in parallel produced a load-dependent failure
(`settings-header-import`: import dialog missing once the suite grew past ~570 cases).
`vite.config.ts` therefore runs files sequentially (`fileParallelism: false`) with a
20 s per-test ceiling. That trades CI time for determinism; the real fix is per-file
storage reset, not a longer timeout.

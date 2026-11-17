# Cloud storage — delivery plan (not started)

Status: planned, nothing scheduled. The owner settled the three open rulings on 2026-11-17
([cloud.md](../facts/cloud.md) §9) and asked for a plan to sit in the backlog, not for work to
start.

Read [cloud.md](../facts/cloud.md) for the model and [contract/postgres-schema.sql](../contract/postgres-schema.sql)
for the DDL. This file only says how a delivery would be staged and what would have to be true at
each step.

## Shape of the delivery

Seven steps, each one its own version, each leaving the shipped app working. Local mode stays the
default and must keep working with the server unreachable at every point.

| # | Step | Done when |
| --- | --- | --- |
| C1 | **Codec parity** — one canonical encoder/decoder shared by local files, zip and JSONB payloads | a property test round-trips every stored shape through all three projections with no value drift; no UI change |
| C2 | **API and schema** — thin same-origin API over PostgreSQL, migrations, health endpoint, container image | `docker compose up` on a remote host serves migrations and `/health`; API keys and DB credentials come from the environment, never the repository |
| C3 | **Accounts and sessions** — server principals for existing local accounts, Argon2id, bearer sessions, throttling | a migrated account authenticates against the server; local credentials never leave the device; rename-with-conflict is refused before connecting |
| C4 | **Sync engine** — push/pull of bounded batches, revision compare, conflict detected and surfaced, never auto-merged | an offline stretch replays without duplication; a divergent edit produces a user-facing conflict, not a silent winner |
| C5 | **Sync state in the UI** — *syncing* / *not synced* / *synced* indicator per surface that shows server data | the three states are observable and reachable in a test, including the offline and failed-attempt cases |
| C6 | **Offline mode** — read-only while the server is unreachable, writes queued only where the design allows | offline reads render; an attempted write shows why it is blocked instead of silently failing |
| C7 | **Operations and cutover** — runbook, backups off-host, restore rehearsal, switch between local and cloud, retirement of the local-only mode if and when the owner asks | a restore rehearsal reproduces the served data; the owner decides cutover; rollback to local-only is documented before it is needed |

## Constraints carried from the rulings

- Remote host, stable TLS, owned runbook; API and DB may be on different machines, so pooling,
  retries, timeouts and off-host backups are requirements from C2 onward.
- Polling at 5 seconds while visible/online, plus focus, reconnect and post-mutation checks; the
  delay is acceptable precisely because C5 makes it visible.
- No Supabase, no hosted auth, no realtime channel; PostgreSQL plus one API service.

## Gates that apply at every step

The four repository gates stay the floor. On top of them, each step needs: a migration that runs
forward and back on a copy of real-shaped data; a test that the app still works with the server
unreachable; and a record of the commands run, in the version record — a green build is not
evidence that a sync converged.

## What this plan does not decide

Host purchase, TLS provider, backup destination and the cutover date. Each needs an owner decision
at the step that needs it, recorded in that version.

## Risks worth naming now

- The local store was designed to be cloud-ready but never exercised against a server; C1 exists
  to find shape drift before any network code exists.
- Two authority models (device-local IDB, server PostgreSQL) can disagree in ways that look like
  user error; C4 is the step where that becomes visible, and it is the step most likely to slip.
- Sync indicators are product surface, not decoration: without them the accepted polling delay
  reads as data loss to a user.

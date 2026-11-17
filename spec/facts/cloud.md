# Canonical cloud model

Design accepted 2026-11-16 and **not implemented**: cloud storage stays disabled until the
owner opens it. This file is the current truth for the model to build against.

Companion: [storage.md](storage.md)
Schema: [postgres-schema.sql](../contract/postgres-schema.sql), accepted design DDL; application requires the migration runner.

## 1. Decision and ownership

One canonical logical model has two storage materializations: IndexedDB virtual files and PostgreSQL rows. Zip is an interchange projection. Adapters preserve ids/order/supported values rather than inventing different domain models. [storage.md](storage.md) owns local paths/chunks/publication/recovery/transfer/envelope and SPA integration. This ADR owns canonical types/codec, principal mapping, the cloud API, authentication, switching and operations. Design acceptance does not prove an implementation or deployed service.

Plain PostgreSQL sits behind exactly one small HTTP API we own. The same API/schema/container can move between a VPS, managed PostgreSQL and a home server without domain rewrite. PostgreSQL is not MySQL; jsonb, indexes and transactions provide persistence. A compose deployment runs API, database and reverse proxy. We own TLS, backups, patching, uptime and secrets; the benefit is portability, no platform ceremony and control of our data.

Two modes are first-class: local has single-device IDB authority; cloud has server authority and IDB cache, same account across devices, owner-only access. Cloud offline is viewing only; never silently switch into another writable history. Local mode is not deprecated. Retirement needs a separate owner decision, notice window, independently accepted cloud and verified export, without an invented date. v2.0.0 scope is defined by `storage.md`; cloud implementation follows that release. Product policy changes for cloud accounts/remote persistence must be adopted before activation.

## 2. Canonical model and stable identity

Every mutable domain entity has schemaVersion and positive authority-scoped recordVersion. Distinguish fileVersion, account tree revision and timestamps; versions are not cross-device merge clocks. Bigint versions travel as decimal strings. Domain instants are integer epoch milliseconds in the valid Date range (SQL bigint), operational audit times timestamptz.

| Entity | Canonical fields | Authority |
| --- | --- | --- |
| Account | accountId UUIDv4, handle, createdAt, updatedAt, registeredAt, schemaVersion, recordVersion, extensions | Identity/registration immutable, handle mutable; selected mode owns facts. |
| Profile | accountId, optional email, emailVerification=unverified, fields, times, schema/record versions, extensions/presence | App data, never access credentials; empty payload valid. |
| Settings | accountId, payload excluding plugin/device settings, times, versions, extensions/presence | Account data. |
| Plugin | accountId, registered pluginId, payload, times, versions, extensions | One record per plugin; games includes settings/cards. |
| Run chunk | accountId, UTC partition/sequence, ordered ordinal/hit entries, times, versions | Hits authoritative: stable id, at, schema/record versions and extras; no renumbering. |
| Import source | accountId, importId, canonical source document, times, versions | Content-deduplicated provenance, not identity adoption. |
| Account extensions | accountId, opaque/presence values, versions | Preserve arrays/null/scalars without flattening. |
| Run index | accountId, chunk descriptors, timestamp frequencies, totals/recent refs, projectionVersion/source revision | Derived from verified chunks, never authoritative over them. |
| Manifest | accountId, account revision, deviceId, logical path descriptors, versions/sha256/bytes, auth | Derived publication/integrity descriptor; revision authority-issued. |

Installation directory/device preferences, binding/gate/progress/pins, recovery bytes and sessions are not domain facts. Password hashes, bearer proofs and principal binding never enter file tree/export/manifest.

### AccountId and authUserId

Local accountId L uses `storage.md`'s UUID layout. Server authUserId P is the API-created principal UUID, stored as accounts.id; accounts.logical_id preserves L. All owned SQL FKs use P. One repository principal resolver maps authenticated session P↔server-owned L; features use L, never raw SQL ownership selectors. A second device obtains L through GET /account after authentication; P need not equal L.

No endpoint accepts account_id/accountId/logical_id/authUserId/principalId as a caller-selected SQL predicate, URL selector or authorization proof. All queries derive P from the validated bearer and include it internally. Registration allocates P and provisional L server-side, no caller id. A gated first connection may carry source L only inside the canonical tree as namespace metadata: API validates UUID/uniqueness/gate-bound source, derives every SQL account_id from session P, and permits provisional→source logical_id binding only before first published cloud tree. Published L cannot silently change; mismatch blocks connection. This metadata exception preserves canonical local paths without granting access to another principal. Local L never moves; exported namespace metadata is not an account credential.

### run-json-1 and integrity seam

Codec: recursively sort object keys by Unicode code point; preserve arrays; no insignificant whitespace; UTF-8; finite IEEE-754 numbers using ECMAScript JSON rendering, normalize -0 to 0; versions decimal strings; no string normalization. Explicit presence metadata handles absence. Reject duplicate keys, NaN/Infinity, unpaired surrogates, embedded NUL and incompatible jsonb values before connection, preserving diagnosed local source rather than dropping it.

API and SPA use one shared codec. jsonb stores values, not original bytes; reconstruct canonical envelopes before SHA/length, never substitute jsonb::text. Archive raw-byte verification is owned by `storage.md`; subsequent emitted canonical files get new hashes and preserved source provenance. Shared pure selectors derive index from chunks; no analytics service.

Manifest reserves `auth: {algorithm:null,keyId:null,signature:null}`. Exact full bytes produce integrity digest; future signable digest omits auth to avoid recursion. SHA detects corruption, not operator tampering. Client-side signature/trust/password-derived signing/key recovery is a separate later security decision. Password hashing/TLS do not supply encryption, signatures or operator-proof storage.

## 3. Authentication, sessions and recovery

Our API checks canonical handle+password against one account row. Registration requires no email and this system sends no mail. Optional profile.email always remains unverified and is never used for login/verification/recovery. No screens or copy are specified here.

Handle grammar `[a-z][a-z0-9_]{2,31}`, lowercase ASCII, C collation unique; reserved admin, administrator, root, support, system, auth, api, local, cloud, postgres. Local broader handles require explicit rename before connection. No suffix/identity adoption. Signup/update HANDLE_TAKEN deliberately reveals availability; login offers no public lookup.

Password minimum 12 Unicode characters, maximum 1,024 UTF-8 bytes; no normalization, truncation or arbitrary composition rules, allow manager paste. Enforce server-side. Argon2id PHC: random 16-byte salt, 32-byte output, 65,536 KiB memory, 3 iterations, parallelism 1, implemented in API. Upgrade allowed weaker hashes on successful login with guarded update; bound parsed PHC parameters to avoid untrusted allocations. Benchmark these accepted defaults before deployment, fail closed on hashing failure, never downgrade to SHA passwords. Passwords remain transient TLS request data, never client-persisted/logged.

Unknown/deleted handles, wrong passwords, invalid/used recovery proof and invalid/expired sessions return uniform 401 AUTH_FAILED. Unknown/deleted handle performs dummy bounded Argon2id verification. Login/recovery failures have fixed minimum 500 ms including work, matching shape/headers; slower work can exceed floor, so no constant-time guarantee. Bound concurrent hashing to prevent memory exhaustion.

Atomic rate_limits buckets commit separately from failed auth/domain transactions: login/recovery 5/handle/15 minutes and 30/trusted-IP/15 minutes; registration 5/IP/hour; authenticated writes 60/account/minute; refresh 30/account/minute; revision reads 30/account/minute. Multiple devices share account budget and honor 429 Retry-After. Use HMAC-SHA256 subject keys, no raw handle/IP logs; unknown handles count. Trust forwarded IP only from configured proxy. Do not reveal which bucket fired. Security counters do not require baseRevision or bump domain revision.

### Sessions

One opaque 256-bit CSPRNG base64url bearer, no second token type. Server stores only SHA-256 of decoded raw token. Sliding expiry 30 days from authenticated activity, capped at 90 days from creation. /auth/refresh validates and extends the same token within bounds; revoked/expired cannot refresh. No rotation claim: stolen bearer may remain useful until expiry/revocation. Every request checks session/account deleted state, allowing immediate server revocation.

Client session adapter in lib/storage uses sessionStorage and memory for reload survival, never the virtual tree/zip/URLs/logs/source. Closing tab loses token despite server lifetime. JavaScript-readable sessionStorage is exposed to XSS; there is no HttpOnly-cookie claim. Clear credentials/cache accessibility on sign-out/recovery invalidation, stop polling and prevent account-switch cache leakage. device_label is bounded metadata, not fingerprint/authority.

### Recovery

At registration show one 32-random-byte recovery code once. Store only Argon2id hash/account binding/used_at, same bounded hash parameters. Recovery accepts handle/code/newPassword; one transaction locks code/account, verifies, updates password hash, marks code used and revokes all sessions. No silent login; sign in again. One unused code/account. No automatic replacement mechanism is specified; without remaining code/password the account is unreachable, local mode/exports are fallback. A lost registration response can lose the shown-once code: do not store plaintext for replay. Recovery of future signing keys remains distinct.

## 4. Pre-connect gate and switch phases

Gate states: not-started | checking | blocked-profile | blocked-handle | blocked-store | blocked-envelope | blocked-identity | blocked-auth | retryable-error | ready | stale. Gate pass is not reservation/upload; any unchecked/failed/stale state leaves cloud disabled/local active.

- blocked-profile: missing/malformed account.json/profile.json, UUID/registration/schema or absent/invalid/reserved handle. Empty profile payload and absent email valid; optional email stays unverified. User fixes base first.
- blocked-handle: authenticated /connect/check or guarded rename finds another account, including tombstone, owns handle. Rename locally and recheck; own handle allowed, uniqueness enforced transactionally.
- blocked-store: unreadable current, unresolved quarantine/conflict, index/hash/integrity failure. Recover/resolve first.
- blocked-envelope: outside [`storage.md` section 7](storage.md#7-import-pipeline-and-supported-envelope), chunk cap or codec/jsonb compatibility. Preserve source, no truncation.
- blocked-identity: source L bound elsewhere, published remote L differs, binding mismatch or ownership selector. Only explicit provisional binding from section 2 is permitted.
- blocked-auth: absent/expired/revoked session, incomplete server account/password or incompatible/unaccepted API/schema implementation.
- retryable-error: unreachable backend, throttle, missing schema/health preparation or uncertain outcome; cached availability insufficient.
- stale: source revision/digest/handle/schema, principal, health/envelope or server base changed; rerun checks.

Persist local GateReport: operationId, source L/local revision/digest, nonsecret P binding, proposed handle, codec/measured envelope/check outcomes/reasons/time and remote base. API revalidates, never trusts ready flag. /connect/check accepts metadata not ownership ids; L stays local until canonical publication validation. No tokens/passwords/codes/emails in reports. Server operation_log records accepted gate/phase/result under session-derived P.

Switch phases: prepared | publishing | committed-unverified | verified | confirmed | cancelled | failed. Source local remains intact/selected until verified and user-confirmed. Failed gate never changes server history; signup can already create provisional empty account, reported not auto-erased. Lost response reconciles operation result before resubmission. No automatic background retries.

## 5. API, materializations, concurrency and polling

### Mechanical mapping

Use `storage.md`'s paths; L denotes canonical id and P session-derived principal.

| Logical material | PostgreSQL mapping |
| --- | --- |
| account.json | accounts.logical_id, handle, created_ms/updated_ms/registered_ms, schema_version/version/account_extensions; id=P internal only. |
| profile/settings/extensions files | accounts.profile/settings/extensions versioned jsonb envelopes. |
| plugins/<id>.json | account_plugins(P,plugin_id), payload and versions/times. |
| run/<partition>-<seq>.json | run_chunks(P,partition,seq), ordered hits + envelope fields/derived sha/bytes. |
| run/index.json | account_revision.run_index, derived at source revision. |
| imports source/index | account_imports rows; listing/dedup descriptors derived into manifest. |
| manifest.json | account_revision.manifest/manifest_digest/revision; not the installation-global manifest. |
| shared directory/extensions, device preferences, export metadata | local/interchange only; server never exposes a cross-account directory. |
| recovery entries | local rescue, not normal server materialization. |
| binding/gate/progress | local controls plus operation_log; credential/session proofs excluded. |

### HTTP contract

One same-origin service under /api behind TLS, paths below relative except /health. JSON version 1, Content-Type application/json, decimal-string versions. Success `{data:...,requestId:<opaque>}`. Reject unknown ownership selectors, parameterize all SQL. Account-bound cursors/range parameters are not owner selectors. Full publication uses bounded disk staging and ≤256 MiB canonical uncompressed body plus actual archive preflight from `storage.md`; validate every supported cap before commit, measure resource capacity before release.

Exact error shape (keys always present):

```json
{"error":{"code":"REVISION_CONFLICT","message":"The account changed; review before retrying.","requestId":"opaque","currentRevision":"7","changedPartitions":["y2026-m11"],"changedModules":["profile"],"retryAfterSeconds":null}}
```

Nonconflict currentRevision is null and changed lists empty; retryAfterSeconds set only for throttle. Uniform 401 uses code AUTH_FAILED/message `Authentication failed.`. Other codes: 400 INVALID_REQUEST/OWNERSHIP_SELECTOR_REJECTED; 409 REVISION_CONFLICT/HANDLE_TAKEN/IDENTITY_CONFLICT/OPERATION_REUSED/GATE_STALE; 413 ENVELOPE_EXCEEDED; 422 VALIDATION_FAILED/BASE_PROFILE_REQUIRED; 429 RATE_LIMITED; 503 UNAVAILABLE; 500 INTERNAL; scoped 404 NOT_FOUND. No SQL/secrets in message; random requestId does not encode identity.

| Method/path | Auth | Request | Response | Additional errors |
| --- | --- | --- | --- | --- |
| POST /auth/register | none | handle,password,deviceLabel | 201 token,expiresAt,recoveryCode once,redacted account,revision 0 | 409 handle;422 policy |
| POST /auth/login | none | handle,password,deviceLabel | token,expiresAt,account,revision | uniform401 |
| POST /auth/refresh | bearer | empty | expiresAt,same token | uniform401 |
| POST /auth/logout | bearer | empty | revoked=true | uniform401 |
| POST /auth/recover | none | handle,recoveryCode,newPassword | recovered=true,no token | uniform401;422 password independent of existence |
| GET /account | bearer | none | canonical account/profile/settings,revision | common |
| PATCH /account | bearer | baseRevision,operationId,handle/profile/settings/extensions patch | revision,changed descriptors | 409 stale/handle;422 schema |
| GET /manifest | bearer | optional atRevision | manifest,digest,revision | 409 snapshot moved |
| GET /chunks | bearer | fromPartition,toPartition,cursor,limit≤100,atRevision | ordered page,nextCursor,revision | 409 snapshot;422 range |
| POST /chunks/append | bearer | baseRevision,operationId,hits≤5000,optional coupled plugin delta | revision,accepted ids,changed chunks/digest | 409 stale/id;413;422 |
| PUT /plugins/:pluginId | bearer | baseRevision,operationId,payload | revision,descriptor | 409;422 unregistered |
| GET /revision | bearer | optional sinceRevision | revision,digest,changedPartitions/Modules | 400 future revision |
| GET /account/export | bearer | atRevision,cursor | full canonical account pages,manifest first,revision-bound cursor | 409 movement;413 |
| POST /connect/check | bearer | sourceRevision/digest,baseRevision,proposedHandle,profile summary,envelope | checks,status,currentRevision | 409 identity/handle/stale;422 profile |
| PUT /account/tree | bearer | baseRevision,operationId,sourceDigest,gate ref,explicit resolution,canonical tree | revision,digest,committed-unverified | 409 gate/stale/identity;413;422 |
| GET /operations/:operationId | bearer | none | sanitized phase/sourceDigest/resultRevision/digest | scoped404 |
| POST /operations/:operationId/confirm | bearer | baseRevision,sourceDigest,readbackDigest | confirmed,revision | 409 mismatch/stale |
| DELETE /account | bearer+password | baseRevision,operationId,password confirmation | tombstone revision,deleted,sessions revoked | 409 stale;uniform401 |
| GET /health | public | none | ok/degraded | 503 |

Common 400/401/429/503/500 apply. Health external path is /health. Read/check endpoints do not mutate domain data; session extension/rate counters are security bookkeeping. Domain writes require baseRevision+operationId; auth/session/recovery need no prior tree revision and do not bump it. Operation confirm carries baseRevision but changes bookkeeping only.

### Publication and idempotency

Authenticate P, rate-limit separately, validate/shared-codec work outside long locks; begin transaction and lock account_revision(P). Recheck deleted state, then operation_log(P,operationId) before rejecting stale base. Same id/request_digest returns sanitized prior result even when revision advanced; differing digest returns 409 OPERATION_REUSED. New operation requires matching baseRevision. Validate chunks/cross-chunk hit ids, apply minimal row changes, recompute index/manifest/counts/hash, bump account revision/changed record versions and record result/change descriptors in that transaction. Commit before success/cache publication. No client-supplied totals/hash authority. Idempotent same-content hit ids add once; conflicting content rejects. Batch rollover and coupled plugin effects share transaction.

Stale writes return 409 current revision and changed partitions/modules since base. operation_log retains domain change/idempotency descriptors without TTL; any future retention change needs explicit full-manifest fallback. User reviews counts/timestamps/modules and chooses keep cloud or overwrite cloud at newly confirmed revision; renewed movement needs renewed consent. No automatic merge/LWW/combine option. Lost commit response uses operationId lookup, not blind replay. Tokens/code plaintext are never logged for response replay.

Local→cloud publishes whole gated account tree in one transaction and result record. Server publishing phase is inside that transaction; committed-unverified becomes visible on commit. Read back consistent revision/digest/count/ids/at/modules; restart readback on movement. Server operation confirmation and local IDB mode flip are separate atomic steps reconciled after restart, not a cross-system transaction. Provisional binding uses section 2, local source stays intact. Costs are full upload/readback, duplicate source/cache/server space, auth/handle/source/revision races, quota/request/transaction limits and lost acknowledgement. If one-transaction supported envelope cannot be met, block/report rather than partially publish or silently lower limits.

Cloud→local uses verified cloud export at one revision and `storage.md`'s explicit zip import, preserving target metadata and hit ids/at. Different source L remains provenance and chunk ownership rebinds through codec. Revision-bound paged export restarts on movement rather than mixing snapshots; no credential adoption. In cloud mode cache GC retains verified working set, pins and in-flight/conflict candidate needed for explicit review, not a permanent full history. It never erases separately retained local source. Browser storage is not permanent.

### Polling and connection states

Accepted by the owner (section 9): GET /revision every 5 seconds while visible/online/authenticated, plus focus/reconnect/own successful mutation/before mutation checks. Hidden tabs stop; resume checks. Changed revision fetches manifest then only changed chunks/modules; statistics/calendar/log use `storage.md`'s derived selective reads. Paged movement restarts, no mixed snapshot.

Foreground healthy-network staleness is up to one interval plus request/refetch time. Outage/throttle/background suspension has no finite delay guarantee; label cached revision/freshness. This deliberate polling simplification avoids persistent push connections. SSE/websocket could be a future transport optimization, never a data-model prerequisite.

States: online-synced (last observed revision validated); online-conflict (rejected stale-write proposal needs choice); offline-readonly (cached viewing, all data/settings mutation controls disabled with localized reason); error (auth/cache/uncertain result requires safe revalidation). No fifth saved state; request-busy is transient. navigator.onLine alone is insufficient. Reconnect revalidates session/manifest before online state; conflict candidate remains review-only. Local writable mode is never an automatic network fallback. Token invalidation stops mutation and isolates cache; navigation/safe logout are not data edits.

## 6. PostgreSQL schema and migration runner

[postgres-schema.sql](../contract/postgres-schema.sql) is the accepted schema specification; the API migration runner applies it transactionally under advisory lock and a checksummed schema_migrations ledger. Reject checksum drift, block startup on failed/unsupported schema; never drop readable data to boot. CREATE IF NOT EXISTS is exact-initial-schema restart safety, not an upgrade plan. Argon2/SHA/HMAC and UUID generation run in API; no extension required.

Exact columns (types/defaults/checks/FKs in linked DDL):

| Table | Columns |
| --- | --- |
| accounts | id, logical_id, handle, password_hash, schema_version, version, created_ms, updated_ms, registered_ms, profile, settings, extensions, account_extensions, deleted_at, created_at, updated_at |
| run_chunks | account_id, partition, seq, hits, hit_count, bytes, sha256, codec, schema_version, version, created_ms, updated_ms |
| account_plugins | account_id, plugin_id, payload, schema_version, version, created_ms, updated_ms |
| account_imports | account_id, import_id, payload, source_digest, schema_version, version, created_ms, updated_ms |
| account_revision | account_id, revision, manifest, manifest_digest, run_index, device_id, updated_at |
| sessions | id, account_id, token_hash, created_at, expires_at, absolute_expires_at, last_used_at, device_label, revoked_at |
| recovery_codes | id, account_id, code_hash, created_at, used_at |
| rate_limits | scope, subject_hash, action, window_start, attempts, expires_at |
| operation_log | account_id, operation_id, kind, request_digest, base_revision, result_revision, phase, changed_partitions, changed_modules, gate_report, response, created_at, updated_at |

accounts PK id, UNIQUE logical_id/handle; chunks PK account_id/partition/seq and generated hit_count 1..5000, bytes≤1,000,000; plugins/imports composite owner PKs, source digest unique/account; revision PK/FK account_id; sessions unique 32-byte token_hash; operation PK account_id/operation_id. All owned child rows FK accounts. jsonb holds payload/manifest/index; digest bytea length32; versions bigint; domain times bigint; audit times timestamptz. Profile check requires unverified marker. API enforces full canonical schema beyond basic SQL checks.

PK/UNIQUE indexes cover range/identity/revision/token/operation reads. Additional indexes: recovery_one_unused_per_account, sessions_account_active(account_id,expires_at) partial revoked null, sessions_expiry, rate_limits_expiry, operation_log_revision(account_id,result_revision) partial nonnull. Avoid redundant chunk PK-prefix index. Expired security buckets/sessions can be maintained independently; operation descriptors retained as section 5 specifies.

Operator validation after applying through runner:

```sql
select name,to_regclass(name) from unnest(array[
 'public.accounts','public.run_chunks','public.account_plugins',
 'public.account_imports','public.account_revision','public.sessions',
 'public.recovery_codes','public.rate_limits','public.operation_log']) as t(name);
select tablename,indexname,indexdef from pg_indexes where schemaname='public'
 and tablename in ('accounts','run_chunks','account_plugins','account_imports',
 'account_revision','sessions','recovery_codes','rate_limits','operation_log')
 order by tablename,indexname;
select conrelid::regclass,conname,pg_get_constraintdef(oid)
 from pg_constraint where connamespace='public'::regnamespace
 order by conrelid::regclass::text,conname;
select rolname,rolsuper,rolcreatedb,rolcreaterole from pg_roles
 where rolname=current_user;
```

Expect nine tables and specified constraints/indexes; inspect runtime grants and runner ledger too. Operator catalog queries do not prove HTTP ownership isolation. Require actual cross-account endpoint checks and transactional restore validation before implementation acceptance.

## 7. Security and deletion

API is the only runtime holder of application DB credentials; operator migration/backup tools are explicit maintenance exceptions. One least-privilege runtime login gets CONNECT/USAGE and table SELECT/INSERT/UPDATE/DELETE, not superuser/admin/schema rights. Separate maintenance credentials stay operator-only; DB is not public. Ownership lives centrally in API query layer: every export/cursor/operation path derives P from session. One bypass can expose all accounts, a full data-breach risk; database privileges do not provide per-account separation inside the API's accessible tables. Independently verify every path with two accounts.

TLS mandatory for client and remote DB links; parameterized SQL, bounded requests/Argon2 concurrency, origin allowlist, rate limits, restrictive CSP and safe rendering of imported data. No passwords/tokens/recovery codes/real DSNs in source, memory records, telemetry, URL or application/proxy logs. Token hashes at rest do not protect stolen browser tokens; sessionStorage XSS risk is explicit. Do not claim email verification, encryption or operator-proof storage; signature seam is in section 2.

Soft deletion: authenticated current password, baseRevision, operationId and explicit product confirmation; one transaction sets deleted_at, publishes tombstone revision/manifest/result, revokes sessions and consumes remaining recovery codes. Handle stays reserved; all ordinary API/login/export/cache access denies deleted account. Now-revoked retry can return uniform401, not reauthorize to replay; lost deletion acknowledgement needs safe reconciliation policy and never automatic undelete. No restore endpoint or immediate physical-erasure promise. Tombstones/dumps persist under operator retention; hard purge/legal erasure and dump aging require explicit owner policy before such a promise. Downloaded local exports cannot be recalled.

## 8. Deployment, operations and non-goals

Repository implementation layout: app/ existing SPA; server/ single API, migration runner and operator backup tool; shared/ codec/types/pure index selectors used by both. Moves/source implementation require their own bounded packets. SPA lib/storage remains sole persistence boundary under `storage.md`. Shared JS/TypeScript codec avoids numeric rendering drift; implementation framework/dependencies require approval.

API Dockerfile: pinned multi-stage build/locked dependencies, non-root runtime, no baked secrets, bounded staging tmpfs/volume, health probe/graceful shutdown/read-only root where practical. Compose has api/postgres/reverse-proxy, named DB volume/private network/no published DB port; proxy serves SPA+/api and TLS. Managed DB omits postgres container and uses same API/DDL with TLS CA verification. Run migrations successfully before traffic then docker compose up -d, explicit readiness not sleep. Home deployment uses controlled TLS routing/tunnel, never public DB port.

Uncommitted inputs: DATABASE_URL runtime, MIGRATION_DATABASE_URL runner, BACKUP_DATABASE_URL operator; PUBLIC_ORIGIN/API_ORIGIN, TLS hostname/cert config, RATE_LIMIT_HMAC_KEY, session sliding/absolute lifetimes, body/staging limits, backup destination/encryption/retention. Bootstrap POSTGRES_PASSWORD is operator secret, never client env. Client receives public API URL only. Mount restrictive secret files outside version control; examples contain placeholders only. /health checks process/DB/schema with bounded query and returns ok/degraded/503 without internal DSN/secrets.

pg_dump operator script: custom-format consistent dump, restricted credentials, encrypted off-host copy/checksum, isolated restore verification before claiming recoverability. Retention design 7 daily +4 weekly encrypted dumps; pruning requires operator approval and only removes this tool's verified backup outputs after newer verified backup, not user rows. Include role/grant/runner-version/secret-reprovision runbook separately; pg_dump omits global roles. Target dump RPO≤24h; RTO measured by restore, no invented guarantee. Additional log-based recovery is separately scoped. Backups contain hashes/personal data; restrict/encrypt access and disclose deletion limits.

Self-hosting checklist:

1. Choose approved host/topology/maintained DB version, domain/TLS, pinned images/patch policy and capacity for Argon2/tree transactions.
2. Provision private DB volume/network, least-privilege runtime and separate maintenance credentials; verify remote DB CA where used.
3. Create restrictive secret files/origin/limit configuration and verify no secret leakage in image/logs.
4. Apply locked/checksummed migration, inspect catalog/grants/ledger; startup blocks on failure.
5. Start compose, verify /health/proxy/TLS and real register/login/recovery/session/account-isolation behavior.
6. Verify two-device CAS/polling/conflicts, offline disabled controls, gate/rename/switch/readback/export and lost-response idempotency; obtain independent acceptance before cloud activation.
7. Encrypt/dump/off-host copy/restore and verify ids/at/counts, record RTO and authorized backup retention.
8. Record patch/restart/rollback/contact/disk/health monitoring; exercise recovery without claiming precommit write success.

Non-goals: source/server/deployment execution from ADR acceptance; messaging/SMTP, sharing/grants, sync engine/background upload, analytics aggregation API, automatic conflict merge, automatic local-mode retirement or active client signing. Local release scope/transfer rejection and browser-data handling are owned by `storage.md`. Future implementation verification covers codec parity, query ownership, auth timing/rates/upgrades, sessions/recovery atomicity, no proofs in export/logs, stale batches/coupled effects, export consistency, gate/switch/recovery, compose/migrations and backup restore. Accepted design is not evidence those checks ran.

## 9. Owner rulings (2026-11-17)

The three rulings that were pending are decided. They constrain the design; none of them starts
implementation.

1. **Deployment is on a remote server.** Not a home connection, not a tunnel. Stable public TLS and
   an owned runbook are part of the delivery, and no purchase is authorised by this file.
2. **API and database are not guaranteed to share a host.** The design must therefore assume
   separation: connection pooling, retries with bounded backoff, explicit timeouts on every
   database call, and off-host backups as a requirement rather than an improvement. Same-host
   co-location stays the simplest supported arrangement, but never a documented assumption.
3. **Polling delay is acceptable**, and the interface must make the state visible instead of
   hiding it: every surface that shows synced data carries an explicit indicator —
   *syncing* while a batch is in flight, *not synced* when the last attempt failed or the device
   is offline, *synced* when the server revision matches. Push transport is not selected.

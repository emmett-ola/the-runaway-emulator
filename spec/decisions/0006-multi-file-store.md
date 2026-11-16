# ADR 0006: Multi-file device-local store

Status: accepted — the owner accepted the design on 2026-11-16. Earlier drafts are not reproduced.
Author: Soren (development)
Baseline: `efd6544b5dbb20f951afe6206af0664f8195affb`
Target release: v2.0.0

## 1. Context and scope

Replace the single `localStorage['runawaylog-data']` persistence unit with pure IndexedDB virtual files split by account, module and plugin. At the baseline, each successful Run reads/parses the store and synchronously serializes/replaces every account's history on the main thread; the Promise adapter does not make that I/O asynchronous ([storage/index.ts](../../src/lib/storage/index.ts), [storage.ts](../../src/storage.ts)). The new write serializes one bounded chunk plus derived index/manifest, not all accounts' data. Serialization and index CPU cost still exist.

v2.0.0 ships local mode only, with cloud disabled. No OPFS, server or desktop wrapper is part of this release. It starts with an empty store and shipped preference defaults; existing browser data/preferences are ignored without deleting or rewriting their keys. Local identity remains demo/session-scoped under [product.md](../product.md). Version/catalog/release-note changes belong to delivery; release notes must state that v1.2.0 exports cannot be imported into v2.0.0.

This ADR owns local file layout, publication/recovery, archive transfer and SPA integration. [ADR 0007](0007-canonical-cloud-model.md) owns the canonical domain model, run-json-1 codec, principal mapping, cloud/API/security/mode switching and deployment. The tree below is a materialization, not the repository API. Canonical model and transport seams are present in v2.0.0; their cloud implementation is not. Design acceptance does not constitute independent implementation acceptance.

## 2. Layout and identifiers

Two-account example (handles live in account.json):

```text
manifest.json
shared/accounts.json
shared/extensions.json
shared/export-metadata.json
device/preferences.json
accounts/11111111-1111-4111-8111-111111111111/account.json
accounts/11111111-1111-4111-8111-111111111111/profile.json
accounts/11111111-1111-4111-8111-111111111111/settings.json
accounts/11111111-1111-4111-8111-111111111111/extensions.json
accounts/11111111-1111-4111-8111-111111111111/plugins/games.json
accounts/11111111-1111-4111-8111-111111111111/run/index.json
accounts/11111111-1111-4111-8111-111111111111/run/y2026-m10-000001.json
accounts/11111111-1111-4111-8111-111111111111/run/y2026-m11-000001.json
accounts/11111111-1111-4111-8111-111111111111/run/y2026-m11-000002.json
accounts/11111111-1111-4111-8111-111111111111/imports/index.json
accounts/11111111-1111-4111-8111-111111111111/imports/i-00000001.json
accounts/22222222-2222-4222-8222-222222222222/account.json
accounts/22222222-2222-4222-8222-222222222222/profile.json
accounts/22222222-2222-4222-8222-222222222222/settings.json
accounts/22222222-2222-4222-8222-222222222222/extensions.json
accounts/22222222-2222-4222-8222-222222222222/plugins/games.json
accounts/22222222-2222-4222-8222-222222222222/run/index.json
accounts/22222222-2222-4222-8222-222222222222/run/y2026-m11-000001.json
accounts/22222222-2222-4222-8222-222222222222/imports/index.json
```

Folder accountId is a collision-checked canonical lowercase hyphenated UUIDv4. Validate `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` and path/account.json agreement. Handles never supply path segments. Rename atomically updates account.json, shared/accounts.json lookup and manifest; paths, chunks and registration do not move. Generation 0 creates the first UUID atomically; later accounts get UUIDs at their own creation.

All ordinary files are UTF-8 canonical JSON envelopes defined in ADR 0007. account.json owns account identity/handle/times/versions; profile.json is the optional-profile envelope; settings.json excludes plugin/device settings. One plugins/games.json contains game settings and cards, including unknown keys. extensions.json preserves account-owned opaque fields/presence; imports hold immutable content-deduplicated sources. Zero hits means zero chunks, not a missing account/profile/index. Empty-account files are account, profile, settings, extensions, games, run index and imports index.

shared/accounts.json is a derived installation directory. shared/extensions.json is installation-scoped, not another account's data container. Export metadata is interchange metadata. Explicit damaged-byte rescue uses registered recovery/ paths, separate from normal account imports.

Plugin ids come from a storage-owned registry (games initially), grammar `[a-z][a-z0-9-]{0,31}`, one envelope per plugin. Unknown plugins require a registered opaque-preservation codec or are rejected. Arbitrary extension keys stay inside JSON, not paths. Chunk/import sequences increase per account/partition and never derive from hit ids. Validate partition grammar from section 3; never sanitize an invalid path and continue.

device/preferences.json owns device timezone, appearance, language, calendar theme and selected mode. Shipped defaults remain: browser timezone ([time](../../src/lib/time/index.ts)), navigator.language through the existing [locale resolver](../../src/lib/i18n/index.ts), system dark preference otherwise light ([appearance](../../src/darkMode.ts)), calendar github-green and mode local ([preferences](../../src/lib/storage/preferences.ts)). Old preference keys are neither consulted nor deleted. Account import preserves current device preferences even when an archive carries export metadata.

## 3. Chunking and selective reads

Partition hits by UTC year/month of hit.at; changing display timezone never moves files. Filename grammar is `y<year>-m<month>-<sequence>.json`: nonnegative year at least four decimal digits, negative year `n` plus magnitude digits (for example yn0001-m01-000001.json); month 01–12; sequence starts 000001, at least six digits and never wraps. Support the full valid Date range.

Chunk envelope contains accountId, partition, sequence, timestamps, schemaVersion, recordVersion and ordered ordinal/hit entries. Ordinals preserve array order and equal-timestamp ties. Append to that month's last non-full chunk, including backdated writes; do not compact historical chunks on ordinary append. Before adding an entry, roll if the resulting full UTF-8 envelope exceeds 5,000 hits or 1,000,000 bytes, whichever first; exact equality allowed. Reject a hit too large to fit one chunk without changing data. Keep hit ids/at/extras intact.

Per-account run/index.json is derived and never authoritative over chunks. It records:

- projection/schema version, source revision, next ordinal, total, first array timestamp, global min/max;
- each chunk's path/partition/sequence, min/max timestamps, count, exact bytes, lowercase SHA-256 and ordinal range;
- exact sorted timestamp-frequency table with first ordinal/tie metadata and bounded recent-50 hit references.

Fixed UTC daily buckets cannot reproduce arbitrary timezone/DST statistics. The exact timestamp projection preserves existing day/hour/week/month/streak/peak/tie behavior via lib/time and can be rebuilt from chunks during repair/import. It is O(distinct timestamps), not constant-size; rewriting this user's index and manifest remains a residual cost. Measure it before separately approving sharding.

A normal single Run changes one chunk, this account's index and manifest, plus IDB generation/control metadata. Reuse all other blobs. Rollover creates one new chunk without rewriting the completed tail. A coupled game award adds its plugin file in the same atomic command, not an excuse to omit module state.

Read paths:

- Statistics use only verified index timestamp frequencies, including on timezone changes; no history chunk fetch.
- Calendar/print use the index's day counts for selected timezone/month. If details are needed, fetch only chunks whose timestamp bounds overlap that UTC interval; local month is not UTC month.
- Logs fetch only chunks referenced by recent 50, retain stable descending-at ordering and use index total for numbering. No complete history scan.
- Export/import merge/integrity audit and explicit full-record transfer may iterate chunks outside render paths, streaming rather than retaining all accounts' history.

## 4. IndexedDB schema and commit protocol

Database runawaylog-vfiles, IDB schema version 1, distinct from domain/archive versions:

| Object store | Key | Value |
| --- | --- | --- |
| control | current | generation id, monotonic revision, manifest digest |
| control | device-id | random installation id, atomically created at generation 0 |
| control | accountId-scoped binding/gate/switch keys | nonsecret source/revision/principal mapping and resumable progress; not virtual/export files |
| generations | generation id | parent/base revision, staged/committed/quarantined state, creation time, complete path→blob map, manifest digest |
| blobs | opaque unique blob id | immutable exact bytes, sha256, length, fileVersion |
| pins | reader/export id | generation id, renewable lease expiry |

A generation is an immutable complete logical tree map; unchanged blobs are referenced, not recopied. Generation 0 creates account UUID, required files/directory, defaults/deviceId and current pointer atomically. Later ids combine monotonic sequence and random writer nonce, checked for collisions. Only control/current publishes current; no localStorage pointer. Manifest and map membership agree; manifest has no recursive self-hash. Tokens belong outside this tree to the session adapter defined in ADR 0007.

Publication protocol:

1. Serialize local intent/patch commands per tab. Resolve handle once to accountId, target commands/locks by UUID. Read/pin latest base; compute candidate from it, not stale component arrays. Validate, serialize and hash outside transactions; freeze exact bytes.
2. Prepare one readwrite transaction spanning control/generations/blobs/pins. Compare base revision, insert changed blobs and a complete staged map, pin candidate/base; do not change current. Await transaction completion, not request success. Conflict rebases the original intent with unchanged hit id/at.
3. Read staged bytes back and verify length/hash/tree/index consistency. Ordinary writes verify changed blobs and retain previously verified unchanged references; first creation/import verifies the full candidate. Failure quarantines/stops candidate without changing current.
4. Commit one transaction across the same stores: recheck base revision and staged candidate, mark committed and atomically update current/revision/manifest reference. First commit compares against absent current and also writes device/id creation metadata. Conflict aborts/rebases/reverifies. Never hash or perform arbitrary async work inside IDB request callbacks.
5. Only transaction.oncomplete publishes the immutable snapshot and resolves command. Cross-tab revision notification is advisory; IDB revision checks govern concurrency. A put success is not a saved receipt. Missed notifications are reconciled on focus/visibility and before writes.

IDB multi-store transaction atomicity exposes old or new complete generation, never a partial tree. Crash during prepare leaves nothing or an unreferenced complete staged candidate; crash before commit leaves current unchanged; crash during commit leaves old/new pointer atomically; crash after commit before UI publication reopens new current. Request strict durability where supported; transaction atomicity is not protection against browser eviction or every power-loss failure. Never claim a copy outside this device.

## 5. Integrity

crypto.subtle.digest('SHA-256', exactBytes) runs before commit outside the transaction. Hash raw file bytes, not a parsed/reserialized approximation; bytes means UTF-8 length, not JS string length. Manifest descriptors include path, module/schema, monotonic fileVersion, length and lowercase hex sha256; run index repeats chunk descriptors. Store full manifest digest in generation and current pointer; verify all memberships/descriptors agree. Missing SubtleCrypto blocks verified writes/imports, never silently bypasses integrity or falls back to another store.

File versions start at 1, advance on committed content changes using a monotonic local revision source, and remain on byte-identical reuse; recovery/delete-recreate must not rewind them. deviceId in manifest is provenance, not account identity or ordering across backends. Imported versions/deviceId never replace local counters/device identity. Canonical serialization and the reserved auth/signature digest seam are owned by [ADR 0007 section 2](0007-canonical-cloud-model.md#2-canonical-model-and-stable-identity). Digests detect accidental corruption, not tampering; no active signing/encryption claim in v2.0.0.

## 6. Zip format

Archive format runawaylog-files, formatVersion 1; top-level logical store schemaVersion 2 is distinct from entity schemas and app release. Manifest includes running appVersion from the real version source, export time, selected accountId/handle-in-content, deviceId, auth block, user/recovery kind and per-file descriptors. Account binding/session state is never imported authority.

manifest.json is first; remaining entries are ASCII lexicographic logical paths without wrapper directories, duplicate entries or directory records. Fixed zip metadata timestamps/permissions plus canonical JSON give deterministic ordering; export time means independently created archives need not be byte-identical. Support STORE/DEFLATE, UTF-8 names, no encryption/symlinks/ZIP64. Use a bounded streaming library (fflate candidate, dependency/license/security approval in implementation packet), not a hand-built general parser.

Export pins the committed generation, projects the selected account plus allowed installation/device/export metadata, rewrites shared/accounts.json/manifest and excludes other account data and credentials. Recovery export may contain damaged bytes or multiple accounts and must clearly say so; it is not accepted by ordinary account import. No original old-browser bytes are included. Both file pickers accept .zip only; all transfer/error/dialog copy comes from the three locales. Read the authoritative committed data, not a stale UI snapshot.

## 7. Import pipeline and supported envelope

Parsing/preview never writes current. Validate in order:

1. Check input ≤64 MiB compressed zip and zip signature; unsupported content is rejected.
2. Bound central-directory entries ≤10,000 including manifest; ordinary payload ≤16 MiB; manifest ≤4 MiB; total uncompressed including manifest ≤256 MiB; path ≤4,096 ASCII bytes; JSON depth ≤64. Arrays are bounded by total bytes. Reject unsupported compression/encryption/ZIP64/ambiguous headers.
3. Validate raw names against the section 2 whitelist before normalization: reject dot/dot-dot, absolute/drive paths, backslashes, NUL/control/non-ASCII, encoded separator/dot aliases, repeated/empty segments, duplicates, symlinks and local-header/directory name disagreement. Never extract to host filesystem or sanitize-and-continue.
4. Bounded-decompress manifest, check supported versions/schema, unique exact entry membership. Count actual emitted bytes incrementally; manifest/advertised size cannot raise caps or cause unbounded allocation.
5. Verify every payload's length/sha256 before semantic parse, including all nonselected accounts/chunks. One failed chunk rejects whole import; no partial salvage/drop-and-continue.
6. Validate UUID/path/account-envelope agreement, schema/registration, valid finite at/id/ordinals, chunk partition/caps, index projection/hash agreement, registered modules and unknown-field preservation. Reject conflicting incoming duplicate ids and recovery-kind archive. Embedded import sources cannot bypass caps.
7. Select explicit source accountId or sole account; otherwise reject ambiguity. Confirm target UUID explicitly; handle alone proves no ownership. Source UUID is provenance when target differs; rebind chunk ownership through canonical codec, preserve hit ids/at and target identity.
8. On confirmation, queue local intent, re-read current target/revision and apply chosen merge/replace. Retry local CAS conflicts against latest state, reject missing target. Prepare/verify/commit via section 4; cancellation/quota/failure leaves current untouched.

Merge is id-based/idempotent: current wins duplicate ids; first new occurrence wins; sort new combined history by stable ascending at. Replace replaces only hits after explicit confirmation. Neither changes target UUID/handle/registration/profile/settings/plugin/device preferences or existing unknown values. Preserve incoming source, including unused extensions/plugin data, in deduplicated imports. Dedup logical source, not zip bytes/headers/export time; do not recursively add a new wrapper on repeated transfer. This explicit file-import merge is distinct from cloud concurrency rules in ADR 0007.

Envelope context: supplied sizing is 83 bytes/hit, approximately 410 KB per 5,000 hits and 4.1 MB per 50,000 hits before wrappers/indexes; roughly 30× realistic-history headroom is a conservative resource rationale, not a compression guarantee. This protects against hostile archives without truncating real history.

Export must preflight every supported limit, including final compressed bytes by staging/counting the encoded result before download. Refuse with localized diagnostic if the archive could not import back; never silently truncate/narrow a round trip. Large local data remains readable. Damaged-byte rescue is not a normal round trip and must also diagnose inability to fit format-1 export limits rather than bypass caps.

## 8. First boot, recovery, GC and rollback

With no current pointer, expose ready empty login/default preference snapshot; do not persist an empty generation before first login. First local login commits generation 0 as section 4 specifies. Competing tabs use distinct staged ids; one absent-pointer CAS wins. Same-handle loser reuses committed UUID/registration; different handle creates another account in a later generation. Reload hydrates current; interrupted first commit retries. An unreadable existing current is recovery, never permission to create empty replacement.

Before first login, preference choices are volatile until they join generation 0; do not report persistence before that commit. Existing browser data/backup/credential/preferences are not read to build the store and are not erased. Deployment requires closing/reloading obsolete clients; this is version hygiene, not a cross-store reconciliation mechanism.

GC runs only after healthy commit/boot, not failed recovery. Keep current, up to two previous healthy generations as available, live staged/reader pins and quarantined recovery evidence until explicit resolution. Generation 0 has no predecessor. Traverse retained maps and delete only unreachable blobs/expired unpinned staged candidates older than 24 hours; recheck roots/pins atomically in writer-shared transaction. Readers pin before fetching; expired lease must repin/restart. Quota failure never authorizes deleting last readable generation. Separate local-mode source is protected from future cache eviction; cloud cache retention is specified in ADR 0007.

Unreadable current blocks writes and preserves raw evidence. Verify retained committed generations newest first; a healthy older tree may supply labeled read-only recovery, never silent loss of newer hits. Explicit recovery commits a new generation referencing verified content without erasing damaged evidence. If none verifies, remain blocked and offer accessible original-byte rescue. If IDB cannot open, say rescue cannot access bytes. Do not fabricate an empty success.

Rollback to v1.2.0 cannot read this store. Export and verify v2 data first for later v2 recovery; retained browser IDB alone is not a usable old-build backup. Do not delete either browser store on rollback. If unreadable, recover first; do not claim export succeeded without accessible bytes.

## 9. Async repository and synchronous render snapshots

All repository/storage I/O is asynchronous. React synchronously consumes already hydrated immutable in-memory projections through hooks, never a synchronous backend call. Keeping full Store.users[*].hits during every render would violate selective reads.

```text
initializeStorage(): Promise<void>
getStorageState(): {status: booting|ready|blocked, revision, diagnostics}
subscribe(listener): unsubscribe
readStore(): Promise<Readonly<StoreSnapshot>>
readRecord(accountId): Promise<Readonly<AccountSnapshot>|null>
readRunView(accountId,timezone,month): Promise<Readonly<RunView>>
ensureRunView(accountId,timezone,month): Promise<void>
appendHit(accountId,hit): Promise<CommitReceipt>
updateProfile/updateSettings/updatePlugin(...patch): Promise<CommitReceipt>
createAccount(...)/deleteRecord(accountId): Promise<CommitReceipt>
readFullRecord(accountId): Promise<CanonicalAccount>
iterateFiles(generation): AsyncIterable<VirtualFile>
confirmImportedData(accountId,validated,mode): Promise<ImportReceipt>
readRecoverySnapshot(): Promise<RecoverySnapshot>
readPreferences(): Promise<Readonly<DevicePreferences>>
updatePreferences(patch): Promise<CommitReceipt>
getStorageDiagnostics(): readonly Diagnostic[]
flushWrites(): Promise<void>
```

State/subscribe/getSnapshot/diagnostics are memory observation only. Snapshot types do not masquerade as full canonical accounts or partial hits arrays. Full-record reads are explicit transfer/test operations, not Run/settings/profile hot paths. Retire synchronous loadStore/readStore/readRecord/writeRecord contracts; no stale whole-record save for metadata edits. Local flushWrites means durable IDB queue completion only; receipt identifies local generation, not account-server success.

App boot gate awaits device preferences, directory/manifest, selected-account metadata/plugins/index/current-month/recent-log hydration before mounting data consumers. User selection hydrates before routing/login resolves; creation commits before session entry. Never hydrate all histories. Hooks expose loading/blocked, repository rejects typed not-ready/blocked, no fabricated persisted empty account. useSyncExternalStore reads stable snapshot references; views key generation/accountId/timezone/month. Month/timezone change prepares matching view before replacing labels/counts. Use shipped defaults during locale/theme bootstrap; data gate prevents misleading transient labels.

Local queue stores intent/patch, allocates Run id/at once, rebases on latest local revision and publishes only after commit. Transient UI state is not a second writable persisted history. Hold animation lock until animation and save both finish; finally release on failure, with no count increment/scene claim/save success. Errors reject visibly rather than become null/missing account. A failed command does not poison safe retries; corruption blocks mutation. beforeunload is not a persistence guarantee.

Required implementation file scope:

- src/lib/storage/index.ts/model.ts/preferences.ts/adapter.ts plus responsibility files idb.ts/files.ts/chunks.ts/snapshot.ts/commit.ts/recovery.ts; one-way facade in src/storage.ts, async creation in src/auth.ts and snapshot/canonical types in src/types.ts. Remove storage adapter/root storage dependency cycle and synchronous whole-record Run path.
- src/app/App.tsx hydration gate; src/ui/Login.tsx async creation/recovery export. Local session semantics remain; principal mapping belongs to ADR 0007's resolver, not features.
- src/lib/i18n/index.ts, src/lib/time/index.ts, src/darkMode.ts and theme consumers: async preference hydration/commands or memory-only observation.
- Dashboard.tsx, Statistics.tsx, HitCalendar.tsx, HitLogs.tsx: RunView/total/month/recent projection, not full hits state. HitLogs numbering receives total separately.
- Profile.tsx profile patch/total; GamesHub.tsx plugin patch; Settings.tsx async transfer/month print; PrintCalendar.tsx month projection and accurate total.
- src/lib/data/transfer.ts plus archive/validation modules handle format, accessing stored bytes only through storage. Both pickers/handlers and locale files en_us/zh_cn/zh_tw change.
- Corresponding tests/setup adapt to async hydration/receipt; package/lockfile changes require implementation-packet authorization.

## 10. Size budgets and dependency rules

Approved design alignment exception to [architecture.md](../architecture.md): storage facade ≤120 lines, responsibility files ≤200–250, storage runtime aggregate ≤1,500 excluding pure model/test/conversion code; transfer facade ≤150, archive/validation each ≤250 and aggregate ≤650. Components target ≤150 lines, feature directory ≤6 files. Tests are not compressed to meet runtime budgets. Review justified overruns, do not hide feature-specific logic in storage. architecture.md alignment update belongs to implementation scope.

app/features → public storage domain interfaces; lib/data → storage transfer/file interface and pure codecs; storage → models/pure helpers/platform APIs. lib never imports features/app; features never deep-import another feature. lib/storage alone touches browser persistence APIs; transfer/components cannot open IDB or construct keys. Root compatibility facade points inward without cycle. Keep projection helpers independent of boot initialization. Add dependency/API-ownership checks. Canonical shared code and future server layout are owned by ADR 0007.

## 11. Test plan before independent implementation acceptance

Use fake-indexeddb as an explicitly authorized future dev dependency in jsdom, fresh factory/closed handles/reset queues/snapshots per case and awaited hydration/commit. It exercises request/transaction abort behavior better than an unfaithful Map. Fault injection wraps the driver. Use real runtime WebCrypto SHA-256, not integrity stubs. Real Chromium/Firefox/WebKit reload/tab/quota checks remain necessary; fake IDB cannot prove browser durability.

Required cases:

- Zip-only format/version/content rejection, round trip into a fresh local target with identical hit count/ids/at/extras, latest committed export and deterministic paths.
- UTC/month/count/byte rollover at equality/next hit, UTF-8 accounting, late writes, empty profile/zero chunks, full valid Date range and oversized-hit rejection without mutation.
- Corrupt/missing chunk, sha mismatch, malformed hit, index/membership disagreement and corruption in nonselected account reject whole import with old pointer intact.
- Actual-stream bomb caps, false sizes, too many entries, deep JSON, path/header aliases/duplicates, unsupported encoding/compression/encryption and export refusal before download at every limit.
- Idempotent merge/current-wins/stable ties, explicit replace confirmation, write-after-preview preservation, source dedup/unknown preservation without recursive wrapper growth.
- Account isolation, UUID-stable rename, same-handle competing creation, handle/path separation and supported canonical values; compare codec parity with ADR 0007 fixtures.
- Crash before prepare/between prepare+commit/during pointer transaction/after commit before publish; old or new complete generation only. Two writers rebase without loss; pinned readers and last healthy generation survive GC.
- Labeled previous-generation recovery, no silent newer-hit loss, no-readable-generation blocked, accessible raw rescue, IDB/open/quota/upgrade/SubtleCrypto failures visible.
- Clean empty-first boot, obsolete keys unchanged and not read, default preferences, repeated boot/login and competing accounts, interrupted first creation retry, unreadable-current not mistaken for absence.
- Unknown scalar/array/null fields, import sources/order and preferences survive save/export/import/recovery; fileVersion monotonicity/deviceId stability.
- Boot gate/strict-mode initialization, rejected Run/profile/import no success/scene, locks released, await commit before alerts/reload; local session scope preserved.
- Exact stats/calendar/log parity at DST/timezone/midnight/unsorted/equal timestamps; spy reads prove zero chunks for statistics and only recent-reference chunks for log. No full-record effect/render shortcut.
- Registration/preferences/consumer/transfer/surface/i18n/print contracts stay green under intended async/format changes. Record actual commands/exits/candidate SHA; independent reviewer accepts implementation, not its author.

## 12. Acceptance criteria

- Every new-store committed hit remains readable with identical id/at/extras; no identity/registration rewrite or cross-account leak.
- A single Run changes one chunk plus own index/manifest, sharing unrelated blobs; additional control metadata is explicit.
- Statistics reads no history chunks; calendar/log stay selective and agree with the same hit facts.
- Failed import/write never destroys readable data or acknowledges failure as success; crash exposes old/new complete generation, or absent current before first commit.
- Export→fresh-target import within section 7's envelope preserves hit count/ids/at; out-of-envelope export refuses before download, never truncates.
- Unknown fields/readable recovery bytes/current metadata/preferences and idempotent merge/replace rules survive; session scope and local-only release remain.
- Recovery never silently promotes shortened history; local retention is not browser-eviction protection. Cloud gates/security are separately accepted under ADR 0007.

## 13. Implementation increments

(a) Core + first boot + export: authorized test/archive dependencies, canonical codecs, IDB generations/CAS/GC/integrity, selective index, device preferences, boot/snapshot integration and preflighted export. Keep core/empty-start/isolation/selective-read/export/failure and unaffected surfaces green; importer-dependent gates remain explicitly incomplete. Unpublished candidate only, no half-synchronous release.

(b) Import/merge/recovery + dialog copy: bounded format-1 validation, latest-revision confirmation, recovery UI/rescue, tab/GC fault checks, pickers/three locales. Keep all local product/transfer/print/i18n contracts green and obtain independent browser acceptance before local v2 delivery. Delivery owns version/catalog/release notes and obsolete-client closure. Future authentication/cloud/offline surfaces follow ADR 0007, not these local increments.

# Bounded storage increment A — implementation report

## Result: BLOCKED unpublished candidate; independent acceptance pending

This is an implementation artifact, **not an accepted implementation or a release**. The one final full gate sequence completed: ESLint **0**, TypeScript **0**, tests **1**, build **0**. Tests reported **39 files: 35 passed / 4 failed; 355 cases: 342 passed / 13 failed**. Twelve failures are the deliberately retained positive importer contracts deferred by ADR0006 §13(a); the thirteenth is an unintended retained GamesHub source-structure contract failure. Thus the instruction to keep all 212 existing cases green was **not achieved**. No tests were skipped/deleted to conceal this result. Source was frozen before the final sequence and was not changed or regated afterward.

- Base: `400ce99046115d3ba770c428747b01ef6860bb8e`.
- Candidate implementation commit: `2a6fd6d12ba79259368bcb19e4e519045873a076`.
- Branch: `storage-v2`; never `main`.
- Working clone: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a` only, including isolated agent worktrees below its `.claude/worktrees/`. No owner's/design clone was accessed.
- `git status --porcelain=v1` after implementation commit: empty output (clean).
- `git remote -v`: empty output; origin absent.
- Local identity: `Emmett <emmett@initialize.in>`.
- Package/app version remains `1.2.0`; no catalog/version/release-note edits.
- This REPORT is committed separately after the implementation to avoid a self-referential SHA. **Final report HEAD is read using `git rev-parse HEAD` in the final read-only check**, and is distinct from the candidate above. The final check also verifies clean porcelain status and absent remotes.
- No browser/dev-server run, push, deployment, cloud API, or application network call was performed. Only the two authorized dependency downloads were used. Fake IndexedDB/Node WebCrypto evidence is not proof of Chromium/Firefox/WebKit durability, eviction resistance, power-loss behavior or a copy outside this device. **Rowan independent acceptance remains required.**

## Scope implemented, by accepted ADR section

Both ADR0006 and ADR0007 were read in full before implementation. The bounded scope is ADR0006 §13(a), not all of either ADR.

### ADR0007 §2: pure shared model/codec and digest roles

- Added storage-independent shared `run-json-1` encoder/decoder, canonical JSON value types and domain entity types. Recursive Unicode code-point key order; array order preserved; ECMAScript finite number rendering; negative zero normalized; UTF-8 with fatal decode; no normalization of strings.
- Rejects duplicate decoded object keys, NUL, unpaired surrogates, unsupported values, sparse arrays, nonplain objects, cycles, accessors/hidden/symbol properties and depth over 64. Uses real WebCrypto SHA-256 over an owned exact byte snapshot, not parsed/reformatted JSON.
- Exposes full manifest integrity digest and reserved signable digest omitting top-level auth. No signing/encryption/authentication upgrade is claimed.
- Shared pure run selectors own UTC partition formation, exact timestamp frequency and stable recent-50 maintenance; they import no storage initialization.
- Canonical runtime profile payload now contains `fields`, `emailVerification: 'unverified'` and optional email, projected to the existing consumer profile shape. Canonical hit typing is not yet fully enforced by the low-level append API; see gaps.

### ADR0006 §§2–5: virtual files, immutable generations, publication and selective index

- Added IndexedDB schema `runawaylog-vfiles` v1 with control/generations/blobs/pins. Storage owns all browser persistence; root compatibility facade points inward, with no storage→root adapter cycle.
- Canonical UUIDv4 paths, handles only in JSON, registered module/path whitelist, required zero-hit account files and no empty history chunk. Rename updates identity/directory without moving account paths or registration.
- Generation maps are complete and immutable; unchanged file blobs are referenced. Changed canonical UTF-8 files carry monotonic decimal file versions, exact bytes and SHA descriptors. Manifest excludes recursive self-hash, while generation/current store full manifest digest. Device provenance ID is atomically created with first publication.
- Per-tab serialized intents rebase on current CAS without reallocating hit ID/time. Prepare stages blobs/map and pins candidate/base; readback verifies exact bytes, membership, metadata and exact append-derived index; commit rechecks base/staging and changes the pointer atomically. Requests do not imply saved receipts: completion/abort governs success. Quarantined staging preserves evidence.
- Added exact index totals/first/min/max/chunk descriptors/frequencies/recent refs, and an ordinal-ordered derived `hitIds` list to enforce account-wide identity uniqueness without scanning historical chunks on ordinary append. This extra derived field increases index size and remains O(number of hits), explicitly not hidden as constant-size storage.
- UTC month chunks preserve ordinal/order/extras, allow equality at 5,000 entries and 1,000,000 UTF-8 envelope bytes, roll subsequent entries and support backdated partitions/full Date range. Ordinary Run changes one bounded chunk, own index and manifest; unrelated account blobs are reused.
- Staging projection checks compare the verified base index with changed chunks/preserved prefixes and recompute exact appended facts. Correctly rehashed false timestamps/bounds/recent/IDs reject before pointer publication.

### ADR0006 §§8–9: first boot, repository, snapshots and all named consumers

- Empty boot publishes volatile defaults/login only. First login atomically publishes generation 0; no localStorage pointer or runtime migration. Obsolete data/backups/credentials/preferences are ignored and unchanged. Same/different handle absent-pointer candidates exercise real CAS; command rebasing reuses the published identity on same handle.
- Device defaults use browser timezone, navigator locale resolution, system appearance, github-green and local mode. Pre-login choices remain volatile until first account commit; no cloud behavior is enabled.
- Async repository reads/patches/receipts and deeply frozen synchronous observations are separate. `useSyncExternalStore` consumes stable memory references; no render-time backend calls or full-history snapshot masquerading as account metadata.
- App gates mounting on initialization/device preferences and selected account/index/month/recent hydration. Selection/creation hydrates/commits before entering the session. Missing/unreadable persistence is an error, not a fabricated empty account.
- Dashboard uses index/month/recent views, stable UUID intents and no optimistic persisted count. Run lock waits save and animation, failures are visible, release locks and do not claim scenes; safe double-press retry is tested. Statistics uses exact weighted frequencies, calendar/print month day counts, logs recent-reference chunks plus authoritative total numbering.
- Profile patches only profile; GamesHub patches its plugin; Settings/SettingsMenu/ThemeSelector and i18n/time/appearance setters await async preference commands. Games/time/i18n helpers read memory/metadata, not full history. About/Releases/CardGame logout/session touchpoints use the new tab-scoped seam.
- SessionStorage v2 namespaced caches remain outside tree/export. The local-demo password/hash/empty-password behavior was preserved in the new session cache rather than silently removing credential checking. This is not secure server authentication and old credentials are intentionally not read.
- Monotonic snapshot fencing prevents slow older reconciliation replacing a newer receipt; null-prototype account lookup supports accepted broader local handles such as `__proto__`.
- Normal boot/reconciliation verifies metadata/index/descriptors without scanning all histories. Explicit audit/recovery performs the full chunk reconstruction. This honors selective reads but means latent unread old-chunk corruption is found when read/exported/audited rather than through a full boot scan; see explicit tradeoff below.

### ADR0006 §§6–8, §13(a): bounded ZIP export and recovery/GC primitives

- Runtime `fflate` streaming ZIP creation, manifest first then ASCII paths, fixed ZIP metadata, canonical selected-account directory/manifest projection. Authoritative committed export is pinned, ignores stale UI arrays and excludes other account paths/session credentials/obsolete browser rescue bytes.
- Preflight enforces supported compressed/entry/payload/manifest/uncompressed/path/depth limits; hashes and checks emitted file bytes, then stages/counts actual compressed output before allowing download. Both ordinary export and raw rescue refuse rather than truncate or claim success. No handwritten ZIP parser/importer.
- Raw recovery snapshots atomically capture accessible original bytes before validation; full audit labels a healthy previous generation read-only without pointer promotion. Malformed maps, aliases, missing references, staged/quarantined evidence and no-readable-generation cases retain diagnostics/raw evidence. Raw rescue archive warns that it may contain multiple accounts/damaged bytes and is not ordinary account import.
- GC shares a writer transaction, rechecks current/pins, retains current plus up to two older committed roots, live readers, young staged/base roots and quarantine, and deletes only unreachable blobs. Reader leases renew; expired read-only operations restart against current; writers explicitly do not replay a possibly committed intent. GC maintenance is not a save receipt.
- Import/merge/replace confirmation always diagnoses `import-deferred`; the old positive importer tests remain to show that incomplete contract. No new recovery UI, picker change, dialogs/three-locale copy, restore command, cloud/network/mode-switch implementation or legacy import was added.

## Exact final failures and known gaps

### Actual test failures

1. `src/test/i18n-structure.test.ts` — **one module CARDS retains all eight records, order and Chinese card strings; sentinels stay empty keys**. This unchanged source-structure test requires literal `CARDS.slice(startIndex, endIndex)` (and later `CARDS.forEach`). Snapshot integration uses `CARDS.slice(startIndex, startIndex + cardsPerPage)` and removed the read-side initialization/write effect. The first literal assertion fails. The eight module records/locale text still exist, but this retained contract is not green. It was found only in the single final full test gate and was not edited away or rerun afterward. No claim is made that every downstream assertion in this test ran.
2. `src/lib/data/transfer.test.ts` — seven positive importer/legacy/roundtrip cases fail at the explicit deferred importer, including the two merge/replace variants. Exact names and reasons are in the adaptation ledger and raw output below.
3. `src/test/settings-data.test.tsx` — four positive import/confirmation/roundtrip cases fail, three via visible import-deferred alert and one direct deferred rejection.
4. `src/test/settings-header-import.test.tsx` — its positive header-import confirmation case fails with the visible import-deferred alert.

The eight malformed-input rejection cases in importer-dependent files can pass merely because **every** import rejects as deferred; those green cases do not prove a bounded importer or semantic validation exists. Latest selected-account ZIP export has separate passing coverage. Baseline 212 cases are retained; 143 new cases bring the total to 355. The 13 failures are all existing contracts, so baseline cases are 199 passing / 13 failing; all 143 new cases passed in the final gate.

### Incomplete/ambiguous implementation criteria requiring review

- **Canonical hit metadata gap:** root UI Run allocates `schemaVersion:1` / `recordVersion:'1'`, but public `appendHit` and chunk validators still accept legacy-shaped hits missing versions and do not reject all explicitly invalid version fields. Shared canonical domain types are therefore not yet the single enforced runtime model. ID/at/extras are preserved rather than silently rewritten; this compatibility choice is not full ADR0007 §2 compliance.
- **Selective hydration vs corruption discovery:** metadata/index-only normal hydration deliberately avoids full histories; explicit `verifyHealthyGeneration`, recovery, export and fetched-chunk reads verify full/chosen bytes. A corrupted dormant chunk not needed by the selected view does not automatically block normal boot. A future independently reviewed cache/integrity policy must reconcile immediate global-corruption blocking with the no-full-history boot rule. No full-scan boot is claimed.
- **GC healthy-root qualification:** retention chooses older `committed` generations rather than performing a full audit of every older root inside GC. Normally these were verified before commit, but post-publication corruption of retained generations can leave fewer than two actually healthy predecessors. Quarantined evidence is retained indefinitely; explicit resolution is deferred. Automatic GC error is maintenance-only and swallowed rather than exposed in a separate maintenance diagnostics surface.
- **Recovery remains primitives only:** no explicit restore/new-generation command or recovery UI. Accessible previous trees are labeled read-only and raw rescue is available; no silent shortened-history promotion. This is deferred to §13(b), not asserted complete recovery delivery.
- **Failure after commit:** transaction completion precedes snapshot hydration/notification. A later unexpected hydrate/notification failure can still reject a command after an authoritative commit; that uncertain-outcome path is not exhaustively fault-tested. Normal verified publication paths and pointer-abort failure are covered, but this does not establish exactly-once acknowledgment across every postcommit UI/runtime fault.
- **Reader/writer suspension:** a real expired-reader+GC test proves read restart and atomic missing-generation handling; timer renewal/writer nonreplay is implemented. Long browser suspension, versionchange, eviction, blocked upgrades and every quota/power-loss boundary still need browser fault acceptance. Export iterators can refuse on expired inner lease rather than silently mix generations.
- **Competing tabs:** low-level real IDB absent-pointer same/different-handle CAS and stale candidate publication are tested. Full independent tab auth/queue/session rebase and crash-after-commit/reload UX are not browser-verified. Same-handle loser command code reuses directory identity, but low-level CAS coverage is not a real two-browser-tab proof.
- **Broader API validation:** typed file decoding still contains a generic trust assertion (`decodeCanonical(...) as T`) followed by responsibility validators; not every canonical entity/unknown envelope gets an exhaustive shared runtime validator at every API boundary. No `any`, double-unknown type escape or fake integrity success was introduced. This is an explicit validation seam, not proof of complete schema validation.
- **UI size targets and retained structure:** several large pre-existing components remain over the 150-line target, with a few increasing for async/error/lock integration. They were not refactored into unrelated features or hidden storage model files. Measured overruns follow.
- No performance timing/heap benchmark for very large O(distinct timestamp) indexes, O(hitIds) index rewrites or manifest growth was conducted. Hashing/canonical serialization CPU remains on the main thread; IndexedDB I/O being async does not make serialization free.
- Normal export relies on the registered tree/module ownership policy for opaque installation/account extension content. Arbitrary user JSON may itself contain sensitive text; path isolation/session exclusion is not a claim of semantic secret scanning.
- Build warnings include static/dynamic imports preventing module chunk separation and stale browsers data. Dependencies were not broadly upgraded to hide these warnings.

## Authority/scope choices and evidence handling

- No version/catalog/locales/picker/dialog/release/cloud code beyond named async/session integration. The general ADR mentions later picker/copy/import changes, but §13(a) and the packet explicitly defer them, so existing dormant import surfaces remain and fail visibly.
- Pure legacy migration/merge conversion utilities remain for baseline pure tests/transition evidence; they do not perform runtime legacy reads or enable an importer. Existing legacy-positive test fixtures are deliberately retained as conflict evidence.
- `npm install fflate && npm install -D fake-indexeddb` succeeded, exit 0. fflate was already a transitive dev dependency at 0.8.2 and is now the authorized runtime dependency 0.8.3; fake-indexeddb 6.2.8 is new dev-only. All unrelated dependency entries/versions were compared and retained. npm's unrelated repair of stale root lock version metadata was reverted to its baseline 1.0.0 fields; package.json and actual app source remain 1.2.0. This avoids an unauthorized release-metadata cleanup.
- Local `git config --local user.name Emmett` and email setup succeeded, exit 0. Attempts to place evidence under `.git/impl-evidence` and to move worktrees were permission-blocked; they were not forced or retried via escalation. Evidence instead lives under ignored `node_modules/.cache/impl-evidence/`. No permission boundary was bypassed through a peer.
- Internal agent worktrees remain under this same clone and are gitignored; ESLint/Vitest exclude those duplicate copies only. Initial targeted codec discovery saw duplicate worktree tests (152 executions for 76 unique shared cases); that is not counted as 152 independent tests.
- Development compiler/lint/selected-test checks are distinct from the final sequence. The final four commands ran once, strictly sequentially, preserving complete interleaved stdout/stderr directly to first-created log files and actual child exit statuses. The wrapper refuses a second run via an exclusive marker. No source edits or complete gate reruns followed the final result.
- Some targeted failures were transient integration/fixture problems: async locale/queue assertions, byte-array cross-realm equality, canonical profile fixture shape, importer compile plumbing, and the new Run failure test's fixture import/blob method. They were fixed before source freeze; earlier failures remain in the command ledger, not recast as passes.

## Measured size budgets

Line counts include blank/comment lines (newline count, with a final unterminated line counted). No source compression was used to hide overruns.

| Responsibility | Lines | Budget/result |
|---|---:|---|
| `src/lib/storage/adapter.ts` | 2 | responsibility ≤200–250: within |
| `src/lib/storage/chunks.ts` | 109 | responsibility ≤200–250: within |
| `src/lib/storage/commands.ts` | 176 | responsibility ≤200–250: within |
| `src/lib/storage/commit.ts` | 162 | responsibility ≤200–250: within |
| `src/lib/storage/files.ts` | 67 | responsibility ≤200–250: within |
| `src/lib/storage/idb.ts` | 107 | responsibility ≤200–250: within |
| `src/lib/storage/index.ts` | 9 | facade ≤120: within |
| `src/lib/storage/preferences.ts` | 52 | responsibility ≤200–250: within |
| `src/lib/storage/recovery.ts` | 196 | responsibility ≤200–250: within |
| `src/lib/storage/runtime.ts` | 95 | responsibility ≤200–250: within |
| `src/lib/storage/snapshot.ts` | 134 | responsibility ≤200–250: within |
| **Storage runtime aggregate** | **1109** | **≤1,500: within** |
| `src/lib/storage/model.ts` | 44 | pure compatibility types; excluded |
| `src/lib/storage/state-model.ts` | 111 | pure interfaces only; excluded, no runtime hidden here |
| `src/lib/storage/migrate.ts` | 124 | pre-existing pure conversion; excluded (actual count recorded below) |
| `src/lib/data/transfer.ts` | 82 | facade ≤150: within |
| `src/lib/data/archive.ts` | 166 | ≤250: within |
| `src/lib/data/validation.ts` | 114 | ≤250: within |
| **Transfer runtime aggregate** | **362** | **≤650: within** |

Shared pure codec/domain/selector files (outside persistence by ADR0007, not moved there to disguise storage logic):

- `shared/codec.ts`: 150 lines.
- `shared/domain.ts`: 75 lines.
- `shared/json-parser.ts`: 115 lines.
- `shared/json-values.ts`: 33 lines.
- `shared/run.ts`: 24 lines.
- `shared/types.ts`: 68 lines.

The pure shared runtime/type total is 465 lines; adding all shared files and the 81-line root compatibility facade to the 1,109-line storage figure gives a conservative 1,655-line broader implementation footprint (not the ADR storage-only aggregate). A stricter aggregate interpretation therefore exceeds 1,500 by 155; this accounting is explicit rather than hiding it as model code. Shared domain/types are 143 of those lines, and shared executable helpers/codec are 322.

| Existing component/facade | Base lines | Candidate lines | 150-line component target |
|---|---:|---:|---|
| `src/features/run/Dashboard.tsx` | 519 | 536 | OVER by 386 |
| `src/features/run/Statistics.tsx` | 204 | 170 | OVER by 20 |
| `src/features/run/HitCalendar.tsx` | 147 | 148 | within |
| `src/features/run/HitLogs.tsx` | 58 | 59 | within |
| `src/features/games/GamesHub.tsx` | 683 | 590 | OVER by 440 |
| `src/features/profile/Profile.tsx` | 173 | 161 | OVER by 11 |
| `src/features/settings/Settings.tsx` | 396 | 409 | OVER by 259 |
| `src/features/settings/SettingsMenu.tsx` | 198 | 213 | OVER by 63 |
| `src/features/print/PrintCalendar.tsx` | 213 | 215 | OVER by 65 |
| `src/storage.ts` | 100 | 81 | compatibility facade, not component |

Overruns are retained component rendering/animations/CSS-heavy markup plus necessary async lock/error handling, not persistence relocated into UI. They require review, not a false compliance statement. Feature-directory target ≤6 is exceeded by the run directory; settings is exactly at the target and scene is below it. Counts below include direct source/CSS/test files; tests are not compressed to meet a runtime target:

- `src/features/about`: 4 direct files, 3 excluding tests.
- `src/features/games`: 5 direct files, 4 excluding tests.
- `src/features/print`: 4 direct files, 3 excluding tests.
- `src/features/profile`: 6 direct files, 5 excluding tests.
- `src/features/run`: 12 direct files, 10 excluding tests (over all-files target) (also over runtime-only interpretation).
- `src/features/scene`: 4 direct files, 4 excluding tests.
- `src/features/settings`: 6 direct files, 6 excluding tests.

## Exact intentional file inventory

Implementation commit contains 88 files: 58 modified + 30 new. REPORT.md is the sole additional report-commit file. No owner/unrelated source files were overwritten.

| Status | Path | Lines |
|---|---|---:|
| MODIFIED | `.gitignore` | 31 |
| MODIFIED | `eslint.config.js` | 23 |
| MODIFIED | `package-lock.json` | 9115 |
| MODIFIED | `package.json` | 49 |
| NEW | `shared/codec.test.ts` | 191 |
| NEW | `shared/codec.ts` | 150 |
| NEW | `shared/domain.ts` | 75 |
| NEW | `shared/integrity.test.ts` | 61 |
| NEW | `shared/json-parser.ts` | 115 |
| NEW | `shared/json-values.ts` | 33 |
| NEW | `shared/run.ts` | 24 |
| NEW | `shared/types.ts` | 68 |
| MODIFIED | `spec/architecture.md` | 72 |
| MODIFIED | `src/app/App.tsx` | 61 |
| MODIFIED | `src/app/routes.test.tsx` | 41 |
| MODIFIED | `src/app/session.ts` | 22 |
| MODIFIED | `src/auth.ts` | 123 |
| MODIFIED | `src/darkMode.ts` | 43 |
| MODIFIED | `src/features/about/About.test.tsx` | 26 |
| MODIFIED | `src/features/about/About.tsx` | 52 |
| MODIFIED | `src/features/about/Releases.tsx` | 34 |
| MODIFIED | `src/features/games/CardGame.tsx` | 67 |
| MODIFIED | `src/features/games/Games.test.tsx` | 43 |
| MODIFIED | `src/features/games/GamesHub.tsx` | 590 |
| MODIFIED | `src/features/print/PrintCalendar.test.tsx` | 165 |
| MODIFIED | `src/features/print/PrintCalendar.tsx` | 215 |
| MODIFIED | `src/features/profile/Profile.test.tsx` | 33 |
| MODIFIED | `src/features/profile/Profile.tsx` | 161 |
| MODIFIED | `src/features/run/Dashboard.tsx` | 536 |
| MODIFIED | `src/features/run/HitCalendar.tsx` | 148 |
| MODIFIED | `src/features/run/HitLogs.tsx` | 59 |
| NEW | `src/features/run/Run.failure.test.tsx` | 84 |
| MODIFIED | `src/features/run/Run.test.tsx` | 164 |
| MODIFIED | `src/features/run/Statistics.tsx` | 170 |
| MODIFIED | `src/features/settings/Settings.tsx` | 409 |
| MODIFIED | `src/features/settings/SettingsMenu.tsx` | 213 |
| MODIFIED | `src/features/settings/ThemeSelector.tsx` | 53 |
| NEW | `src/lib/data/archive.export.test.ts` | 247 |
| NEW | `src/lib/data/archive.ts` | 166 |
| MODIFIED | `src/lib/data/transfer.test.ts` | 132 |
| MODIFIED | `src/lib/data/transfer.ts` | 82 |
| NEW | `src/lib/data/validation.ts` | 114 |
| MODIFIED | `src/lib/games/index.ts` | 9 |
| MODIFIED | `src/lib/i18n/extension.test.tsx` | 42 |
| MODIFIED | `src/lib/i18n/index.ts` | 80 |
| MODIFIED | `src/lib/i18n/parity.test.ts` | 177 |
| MODIFIED | `src/lib/storage/adapter.ts` | 2 |
| NEW | `src/lib/storage/byte-boundary.test.ts` | 26 |
| NEW | `src/lib/storage/chunks.ts` | 109 |
| NEW | `src/lib/storage/commands.ts` | 176 |
| NEW | `src/lib/storage/commit.ts` | 162 |
| MODIFIED | `src/lib/storage/consumers.test.ts` | 107 |
| NEW | `src/lib/storage/core.test.ts` | 169 |
| NEW | `src/lib/storage/files.ts` | 67 |
| NEW | `src/lib/storage/idb.ts` | 107 |
| MODIFIED | `src/lib/storage/index.ts` | 9 |
| NEW | `src/lib/storage/integrity-commands.test.ts` | 67 |
| MODIFIED | `src/lib/storage/migrate.test.ts` | 137 |
| MODIFIED | `src/lib/storage/model.ts` | 44 |
| NEW | `src/lib/storage/ownership.test.ts` | 26 |
| NEW | `src/lib/storage/platform-failure.test.ts` | 42 |
| MODIFIED | `src/lib/storage/preferences.test.ts` | 86 |
| MODIFIED | `src/lib/storage/preferences.ts` | 52 |
| MODIFIED | `src/lib/storage/preservation.test.ts` | 68 |
| NEW | `src/lib/storage/publication.test.ts` | 166 |
| NEW | `src/lib/storage/recovery.test.ts` | 308 |
| NEW | `src/lib/storage/recovery.ts` | 196 |
| MODIFIED | `src/lib/storage/registration.test.ts` | 67 |
| NEW | `src/lib/storage/runtime.ts` | 95 |
| NEW | `src/lib/storage/selective.test.ts` | 36 |
| NEW | `src/lib/storage/snapshot.ts` | 134 |
| NEW | `src/lib/storage/state-model.ts` | 111 |
| MODIFIED | `src/lib/time/index.ts` | 135 |
| MODIFIED | `src/storage.ts` | 81 |
| MODIFIED | `src/test/i18n-surfaces.test.tsx` | 322 |
| MODIFIED | `src/test/runScene.test.tsx` | 392 |
| MODIFIED | `src/test/settings-data.test.tsx` | 84 |
| MODIFIED | `src/test/settings-header-import.test.tsx` | 34 |
| MODIFIED | `src/test/settings-preferences.test.tsx` | 47 |
| MODIFIED | `src/test/setup.ts` | 19 |
| NEW | `src/test/storage-fixtures.ts` | 29 |
| MODIFIED | `src/test/storage.test.ts` | 144 |
| MODIFIED | `src/test/timezone.test.ts` | 166 |
| MODIFIED | `src/types.ts` | 13 |
| MODIFIED | `src/ui/Login.storage.test.tsx` | 29 |
| MODIFIED | `src/ui/Login.tsx` | 139 |
| MODIFIED | `src/ui/SurfaceBoundary.test.tsx` | 17 |
| MODIFIED | `vite.config.ts` | 86 |
| NEW | `REPORT.md` | 3016 |

## Commands and actual exits

Tool-denied commands did not run and have no process exit; they are recorded as blocked, not exit 0. File Read/Edit/Write/copy integration calls succeeded unless explicitly described above. Relevant setup and commit commands:

- `npm install fflate && npm install -D fake-indexeddb`: **0** (authorized packages only).
- `git config --local user.name Emmett`: **0**.
- `git config --local user.email emmett@initialize.in`: **0**.
- Initial evidence-directory/compound setup and later compound commit+redirect requests: **tool-blocked, not executed**, then simpler separately authorized commands used. `git worktree move` blocked and not forced.
- `npx vitest run shared/codec.test.ts shared/integrity.test.ts` initial targeted check: **0**, duplicated nested worktree copies produced 152 executions; actual unique suite 76.
- `node node_modules/.cache/impl-evidence/preserve-lock.mjs`: **0** before freeze; asserts unrelated dependency entries unchanged against original HEAD and preserves stale baseline root lock metadata.
- `git diff --check`: **0** before and after source freeze.
- `node node_modules/.cache/impl-evidence/prepare-report.mjs`: initially **1** (wrong JSON ledger key), then **0** after report-only script fix; source unchanged.
- `git add .gitignore eslint.config.js package.json package-lock.json spec/architecture.md shared src vite.config.ts`: **0**.
- `git commit -m "feat: implement unpublished IndexedDB file-store candidate" ...`: **0**, candidate `2a6fd6d12ba79259368bcb19e4e519045873a076`, 88 files / 4,679 insertions / 1,420 deletions, ends with required coauthor attribution.
- `git rev-parse HEAD`, `git branch --show-current`, `git status --porcelain=v1`, `git remote -v`, local identity queries and `git log -1 --format=fuller`: **0**, candidate/branch/clean/no-remotes/attribution verified.
- Report stage/commit and final read-only identity/status/remote checks are the final actions. Their actual outputs are relayed in the final response; this report intentionally refers to final HEAD via `git rev-parse HEAD` rather than inventing its own future hash.

Every captured coordinator development check follows (the timestamp is completion, UTC):

| UTC | Command | Actual exit | Raw local evidence |
|---|---|---:|---|
| 2026-11-16T03:00:24.315Z | `npx tsc -p tsconfig.app.json --noEmit --incremental false` | 2 | `targeted-core-compile.log` |
| 2026-11-16T03:04:15.766Z | `npx vitest run src/lib/storage/core.test.ts src/lib/data/archive.export.test.ts shared/codec.test.ts shared/integrity.test.ts` | 0 | `targeted-core-and-export.log` |
| 2026-11-16T03:05:33.236Z | `npx tsc -p tsconfig.app.json --noEmit --incremental false` | 2 | `targeted-integrated-compile.log` |
| 2026-11-16T03:06:10.818Z | `npx vitest run src/lib/storage/recovery.test.ts` | 1 | `targeted-recovery.log` |
| 2026-11-16T03:07:18.924Z | `npx vitest run src/lib/storage/recovery.test.ts src/lib/data/archive.export.test.ts` | 0 | `targeted-recovery-corrected.log` |
| 2026-11-16T03:08:15.461Z | `npx eslint src/lib/storage src/lib/data src/storage.ts src/auth.ts src/app/App.tsx src/app/session.ts src/ui/Login.tsx src/features shared` | 1 | `targeted-runtime-lint.log` |
| 2026-11-16T03:09:54.509Z | `npx vitest run src/lib/storage/core.test.ts src/lib/storage/ownership.test.ts src/lib/storage/recovery.test.ts` | 1 | `targeted-core-ownership.log` |
| 2026-11-16T03:11:29.020Z | `npx vitest run src/lib/storage/recovery.test.ts src/lib/storage/core.test.ts` | 0 | `targeted-recovery-faults.log` |
| 2026-11-16T03:12:24.568Z | `npx vitest run src/features/games/Games.test.tsx src/features/print/PrintCalendar.test.tsx src/features/profile/Profile.test.tsx src/features/run/Run.test.tsx src/lib/storage/consumers.test.ts src/lib/storage/migrate.test.ts src/lib/storage/preferences.test.ts src/lib/storage/preservation.test.ts src/lib/storage/registration.test.ts src/test/runScene.test.tsx src/test/settings-preferences.test.tsx src/test/storage.test.ts src/test/timezone.test.ts src/ui/Login.storage.test.tsx` | 1 | `targeted-adapted-tests.log` |
| 2026-11-16T03:13:52.436Z | `npx vitest run src/test/i18n-surfaces.test.tsx` | 0 | `targeted-i18n-surfaces.log` |
| 2026-11-16T03:14:24.973Z | `npx tsc -p tsconfig.app.json --noEmit --incremental false` | 2 | `targeted-source-types.log` |
| 2026-11-16T03:16:20.387Z | `npx vitest run src/features/run/Run.test.tsx src/features/profile/Profile.test.tsx src/features/print/PrintCalendar.test.tsx src/features/games/Games.test.tsx src/test/runScene.test.tsx src/test/settings-preferences.test.tsx src/lib/storage/consumers.test.ts src/lib/storage/recovery.test.ts src/ui/Login.storage.test.tsx` | 0 | `targeted-async-consumers.log` |
| 2026-11-16T03:17:14.108Z | `npx eslint src shared` | 0 | `targeted-post-integration-lint.log` |
| 2026-11-16T03:18:15.896Z | `npx tsc -p tsconfig.app.json --noEmit --incremental false` | 2 | `targeted-final-source-types.log` |
| 2026-11-16T03:20:44.601Z | `npx vitest run src/lib/storage/core.test.ts src/lib/storage/recovery.test.ts src/lib/storage/ownership.test.ts` | 0 | `targeted-core-projection.log` |
| 2026-11-16T03:21:01.299Z | `npx vitest run src/lib/i18n/extension.test.tsx src/lib/i18n/parity.test.ts src/app/routes.test.tsx` | 0 | `targeted-locale-await.log` |
| 2026-11-16T03:22:55.833Z | `npx vitest run src/lib/storage/core.test.ts src/lib/storage/recovery.test.ts src/features/profile/Profile.test.tsx src/lib/storage/consumers.test.ts` | 1 | `targeted-profile-canonical.log` |
| 2026-11-16T03:29:24.036Z | `npx vitest run src/lib/storage/recovery.test.ts src/lib/storage/core.test.ts` | 0 | `targeted-canonical-recovery.log` |
| 2026-11-16T03:29:25.920Z | `npx tsc -b` | 0 | `targeted-compile-complete.log` |
| 2026-11-16T03:31:03.228Z | `npx vitest run src/lib/data/transfer.test.ts src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx` | 1 | `targeted-import-deferral.log` |
| 2026-11-16T03:33:49.619Z | `npx vitest run src/features/about/About.test.tsx src/ui/SurfaceBoundary.test.tsx src/test/timezone.test.ts src/lib/storage/preservation.test.ts src/lib/storage/preferences.test.ts src/lib/storage/migrate.test.ts src/lib/storage/registration.test.ts src/test/storage.test.ts` | 0 | `targeted-unaffected-surfaces.log` |
| 2026-11-16T03:35:04.570Z | `npx vitest run src/lib/storage/publication.test.ts src/lib/storage/byte-boundary.test.ts` | 0 | `targeted-publication-boundaries.log` |
| 2026-11-16T03:36:56.266Z | `npx eslint src shared` | 0 | `targeted-current-lint.log` |
| 2026-11-16T03:37:42.855Z | `npx vitest run src/lib/storage/selective.test.ts` | 0 | `targeted-selective-paths.log` |
| 2026-11-16T03:37:44.762Z | `npx tsc -b` | 0 | `targeted-types-remaining.log` |
| 2026-11-16T03:38:17.544Z | `npx vitest run src/lib/storage/core.test.ts src/lib/storage/recovery.test.ts src/lib/storage/integrity-commands.test.ts src/lib/storage/publication.test.ts src/lib/storage/byte-boundary.test.ts src/lib/storage/selective.test.ts` | 0 | `targeted-identity-projection.log` |
| 2026-11-16T03:39:03.897Z | `npx vitest run src/lib/storage/integrity-commands.test.ts src/lib/storage/core.test.ts src/lib/storage/recovery.test.ts src/lib/storage/publication.test.ts src/features/run/Run.failure.test.tsx` | 1 | `targeted-lease-run-failure.log` |
| 2026-11-16T03:39:05.573Z | `npx tsc -b` | 2 | `targeted-prefreeze-types.log` |
| 2026-11-16T03:39:08.025Z | `npx eslint src shared` | 0 | `targeted-prefreeze-lint.log` |
| 2026-11-16T03:40:14.553Z | `npx vitest run src/features/run/Run.failure.test.tsx src/lib/storage/recovery.test.ts` | 0 | `targeted-run-failure-corrected.log` |
| 2026-11-16T03:40:16.231Z | `npx tsc -b` | 0 | `targeted-last-development-types.log` |
| 2026-11-16T03:41:12.143Z | `npx vitest run src/lib/storage/platform-failure.test.ts` | 0 | `targeted-platform-failures.log` |
| 2026-11-16T03:41:12.722Z | `npx eslint src/lib/storage/platform-failure.test.ts src/features/run/Run.failure.test.tsx` | 0 | `targeted-last-lint.log` |

These ignored development logs remain in `node_modules/.cache/impl-evidence/`; full final outputs are embedded below so acceptance does not depend on that ignored directory surviving npm cleanup. Agent-reported checks are not substituted for coordinator gates. All transient targeted failures remain listed.

## Existing-test adaptation ledger

All 212 baseline cases remain; no skips or deletions. The following ledger enumerates 199 cases in 23 modified existing test files, including unchanged pure cases for complete file accounting. Global test setup now resets a real fake-indexeddb factory, queues and snapshots, installs native Node WebCrypto, and awaits initialization/cleanup. The remaining existing files are textually unchanged. Exact original name templates, expanded names and table/loop variants are retained below; only the two explicit missing/rejected print-fallback variants were renamed to require an error rather than fabricated empty success.

### `src/features/games/Games.test.tsx` (2 cases)

- **"persists keyboard-accessible game toggles per user and leaves coming-soon controls inert"**. **body-and-shared-setup** — Await snapshot reads after plugin commands; compare the complete unchanged peer snapshot because required empty settings/plugin envelopes are now present; verify opening/closing the album leaves the player snapshot identical. Keyboard accessibility, inert coming-soon controls and remount persistence assertions retained. Setup: Await locale and command-seeded current/peer account fixtures; use the v2 tab-scoped username cache instead of the obsolete session key.
- **"returns from the card page to its games hub"**. **shared-setup-only** — Navigation assertions unchanged; shared fixture setup now waits for real committed accounts and locale. Setup: Await locale and command-seeded current/peer account fixtures; use the v2 tab-scoped username cache instead of the obsolete session key.

### `src/features/print/PrintCalendar.test.tsx` (7 cases)

- **"Settings opens the current month from the persisted record without invoking window.print"**. **body-and-shared-setup** — Replace synchronous writeRecord with awaited seedRecord. Existing month, timezone boundary count, username, focus, cancellation and no-print assertions retained. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.
- **"follows the existing calendar previous/next month owner across a year boundary without accumulating sheets"**. **shared-setup-only** — Pure month navigation assertions unchanged; shared preference/session setup and teardown are asynchronous. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.
- **"rebuckets stored at instants when the timezone or controlled month changes"**. **shared-setup-only** — Pure rebucketing and immutable input assertions unchanged; shared preference/session setup and teardown are asynchronous. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.
- **"retains localized dialog controls, dates and calendar-only sheet in en_us"** (template: "retains localized dialog controls, dates and calendar-only sheet in %s"); table variant: `"en_us"`. **body-and-shared-setup** — Await selected locale before rendering; retain all localized modal, date, weekday, print, close and calendar-only sheet assertions. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.
- **"retains localized dialog controls, dates and calendar-only sheet in zh_cn"** (template: "retains localized dialog controls, dates and calendar-only sheet in %s"); table variant: `"zh_cn"`. **body-and-shared-setup** — Await selected locale before rendering; retain all localized modal, date, weekday, print, close and calendar-only sheet assertions. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.
- **"retains localized dialog controls, dates and calendar-only sheet in zh_tw"** (template: "retains localized dialog controls, dates and calendar-only sheet in %s"); table variant: `"zh_tw"`. **body-and-shared-setup** — Await selected locale before rendering; retain all localized modal, date, weekday, print, close and calendar-only sheet assertions. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.
- **"declares A4, excludes application/dialog chrome and prevents splitting the single month sheet"**. **shared-setup-only** — Structural CSS assertions unchanged; only file-wide async preference/session setup and teardown affect this case. Setup: Use v2 tab username, await timezone/locale setup and locale teardown; legacy display-only hits props retained for isolated components.

### `src/features/profile/Profile.test.tsx` (3 cases)

- **"localizes member duration and persists email and the original registration date in en_us"** (template: "localizes member duration and persists email and the original registration date in %s"); table variant: `"en_us"`. **body-and-shared-setup** — Await locale selection, public async record reads and email patch completion; await locale changes inside act. Preserve every localized duration, remount email and immutable registration assertion for all three locales. Setup: Await locale, seed registration via public account creation, and use v2 session identity.
- **"localizes member duration and persists email and the original registration date in zh_cn"** (template: "localizes member duration and persists email and the original registration date in %s"); table variant: `"zh_cn"`. **body-and-shared-setup** — Await locale selection, public async record reads and email patch completion; await locale changes inside act. Preserve every localized duration, remount email and immutable registration assertion for all three locales. Setup: Await locale, seed registration via public account creation, and use v2 session identity.
- **"localizes member duration and persists email and the original registration date in zh_tw"** (template: "localizes member duration and persists email and the original registration date in %s"); table variant: `"zh_tw"`. **body-and-shared-setup** — Await locale selection, public async record reads and email patch completion; await locale changes inside act. Preserve every localized duration, remount email and immutable registration assertion for all three locales. Setup: Await locale, seed registration via public account creation, and use v2 session identity.

### `src/features/run/Run.test.tsx` (11 cases)

- **"records once under double press and claims the scene once across route remounts, rearming only for a new page tree"**. **body-and-shared-setup** — Replace snapshot.hits reads with awaited explicit readFullRecord hit counts; retain exact double-press counts, route/page scene lifetime and focus checks. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"wrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus"**. **body-and-shared-setup** — Patch plugin settings using account UUID, rehydrate matching RunView, await complete animation/save and explicit full-record counts; all failure/no-scene/control/focus checks retained. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"renders an independently registered two-control game and respects count, scene and wrong animation outcomes"**. **body-and-shared-setup** — Enable independently registered game through updatePlugin, hydrate view and await full-record hit counts; retain wrong animation, count-only/no-scene and boom guards. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"computes independent current/longest streaks: empty"** (template: "computes independent current/longest streaks: %s"); table variant: `["empty",[],0,0]`. **shared-setup-only** — All table inputs and pure current/longest streak assertions unchanged; shared fresh async storage fixture is hydrated. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"computes independent current/longest streaks: today only"** (template: "computes independent current/longest streaks: %s"); table variant: `["today only",["2026-11-13"],1,1]`. **shared-setup-only** — All table inputs and pure current/longest streak assertions unchanged; shared fresh async storage fixture is hydrated. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"computes independent current/longest streaks: yesterday only"** (template: "computes independent current/longest streaks: %s"); table variant: `["yesterday only",["2026-11-12"],0,1]`. **shared-setup-only** — All table inputs and pure current/longest streak assertions unchanged; shared fresh async storage fixture is hydrated. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"computes independent current/longest streaks: historical November 1/2"** (template: "computes independent current/longest streaks: %s"); table variant: `["historical November 1/2",["2026-11-01","2026-11-02"],0,2]`. **shared-setup-only** — All table inputs and pure current/longest streak assertions unchanged; shared fresh async storage fixture is hydrated. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"computes independent current/longest streaks: today streak independent of longer history"** (template: "computes independent current/longest streaks: %s"); table variant: `["today streak independent of longer history",["2026-11-01","2026-11-02","2026-11-03","2026-11-12","2026-11-13"],2,3]`. **shared-setup-only** — All table inputs and pure current/longest streak assertions unchanged; shared fresh async storage fixture is hydrated. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"computes independent current/longest streaks: duplicate days and gaps"** (template: "computes independent current/longest streaks: %s"); table variant: `["duplicate days and gaps",["2026-11-10","2026-11-10","2026-11-12","2026-11-13"],2,2]`. **shared-setup-only** — All table inputs and pure current/longest streak assertions unchanged; shared fresh async storage fixture is hydrated. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"derives streak days from at in the selected timezone, including DST calendar days"**. **shared-setup-only** — Pure timezone/DST streak assertions unchanged; shared async fixture setup only. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.
- **"statistics, calendar and logs rebucket the same stored instant without mutating v2 hits"**. **shared-setup-only** — Pure statistics/calendar/log parity and immutable hits assertions unchanged; shared async fixture setup only. Setup: Await locale/UTC preference, seed a real fresh runner through public commands, hydrate its RunView; fake Date/timeout only and settle until animation, durable writes and matching view hydration complete.

### `src/lib/data/transfer.test.ts` (13 cases)

- **"exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication"**. **body** — Pure-convert/explicitly seed legacy fixture (bootstrap still ignores old bytes); decode real ZIP, verify every descriptor hash/length, account isolation, exact hits and device metadata; deliberately exclude untouched raw obsolete browser rescue bytes per ADR. Positive ZIP import/confirm/re-export roundtrip remains positive and fails import-deferred. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"exports the latest typed record rather than a stale UI snapshot, including identity recovery bytes"**. **body** — Seed/append through commands and decode real exported ZIP to prove latest history; obsolete identity-backup inclusion deliberately reverses to exclusion with exact old bytes untouched per accepted fresh-start scope. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred.
- **"merge retains current identity/profile/games/cards and preserves imported unknown data"** (template: "%s retains current identity/profile/games/cards and preserves imported unknown data"); table variant: `"merge"`. **body** — Await seed/full-record/revision reads, positive original legacy JSON import, confirmation and real ZIP export; retain merge/replace identity/profile/plugin/cards/provenance assertions; deferred importer remains an explicit positive failure. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"replace retains current identity/profile/games/cards and preserves imported unknown data"** (template: "%s retains current identity/profile/games/cards and preserves imported unknown data"); table variant: `"replace"`. **body** — Await seed/full-record/revision reads, positive original legacy JSON import, confirmation and real ZIP export; retain merge/replace identity/profile/plugin/cards/provenance assertions; deferred importer remains an explicit positive failure. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"rejects unsafe imports without touching existing bytes: null"** (template: "rejects unsafe imports without touching existing bytes: %j"). **body** — Await real seed and compare entire canonical record/revision unchanged after existing broad rejection guard. Passing while universally deferred is not proof of implemented import validation. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred.
- **"rejects unsafe imports without touching existing bytes: undefined"** (template: "rejects unsafe imports without touching existing bytes: %j"); table variant: `[]`. **body** — Await real seed and compare entire canonical record/revision unchanged after existing broad rejection guard. Passing while universally deferred is not proof of implemented import validation. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred.
- **"rejects unsafe imports without touching existing bytes: {\"username\":\"x\",\"hits\":[null]}"** (template: "rejects unsafe imports without touching existing bytes: %j"); table variant: `{"username":"x","hits":[null]}`. **body** — Await real seed and compare entire canonical record/revision unchanged after existing broad rejection guard. Passing while universally deferred is not proof of implemented import validation. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred.
- **"rejects unsafe imports without touching existing bytes: {\"schemaVersion\":2,\"users\":{}}"** (template: "rejects unsafe imports without touching existing bytes: %j"); table variant: `{"schemaVersion":2,"users":{}}`. **body** — Await real seed and compare entire canonical record/revision unchanged after existing broad rejection guard. Passing while universally deferred is not proof of implemented import validation. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred.
- **"rejects unsafe imports without touching existing bytes: {\"username\":\"x\",\"hits\":[{\"date\":\"2024-02-30\"}]}"** (template: "rejects unsafe imports without touching existing bytes: %j"); table variant: `{"username":"x","hits":[{"date":"2024-02-30"}]}`. **body** — Await real seed and compare entire canonical record/revision unchanged after existing broad rejection guard. Passing while universally deferred is not proof of implemented import validation. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred.
- **"preserves arbitrary existing unknown values across a confirmed import"**. **body** — Seed opaque array through public extension command; await original positive JSON import/confirm and explicit full-record opaque-value equality; remains deferred failure. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"confirmed merge reads current storage rather than losing hits added after the dialog opened"**. **body** — Await original positive preview, use appendHit concurrent intent instead of whole-record save, await confirmation and exact old/concurrent/import ordering/full history; remains deferred failure. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"confirmed import propagates a storage failure without changing current bytes"**. **body** — Await seed/full-record/revision, retain positive preview; inject fake-IDB put quota failure and await confirm rejection, then exact record/revision preservation. Initial positive parse remains deferred failure, not converted to deferred rejection expectation. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"accepts legacy maps through the same migration and refuses ambiguous multi-user replacement"**. **unchanged-positive-conflict** — Original test body and positive legacy JSON acceptance/ambiguity/source-selection expectations intentionally retained as explicit incompatible legacy-format/deferred importer evidence. Setup: Use real async storage commands and canonical ZIP decoding; original positive importer contracts intentionally remain failing while importer is deferred. Positive importer contract intentionally retained; deferred behavior remains a failure.

### `src/lib/storage/consumers.test.ts` (5 cases)

- **"LocalStorageAdapter migrates on load and preserves extras and peers on save/delete"** (template: "%s migrates on load and preserves extras and peers on save/delete"); table variant: `{"$symbol":"LocalStorageAdapter"}`. **body-and-shared-setup** — Deliberate fresh-start change: ignored old handle initially missing; explicitly seed new committed accounts, hit/profile/opaque extras, use lightweight snapshot total/no hits, patch plugin cards and verify complete peer/history/unknown preservation through async delete; old bytes unchanged. Both inert Local/Cloud adapter rows preserved. Setup: Clear tab identity and legacy localStorage; retain old map/preferences only as ignored immutable evidence; remove fake-timer API-delay scaffolding.
- **"CloudStorageAdapter migrates on load and preserves extras and peers on save/delete"** (template: "%s migrates on load and preserves extras and peers on save/delete"); table variant: `{"$symbol":"CloudStorageAdapter"}`. **body-and-shared-setup** — Deliberate fresh-start change: ignored old handle initially missing; explicitly seed new committed accounts, hit/profile/opaque extras, use lightweight snapshot total/no hits, patch plugin cards and verify complete peer/history/unknown preservation through async delete; old bytes unchanged. Both inert Local/Cloud adapter rows preserved. Setup: Clear tab identity and legacy localStorage; retain old map/preferences only as ignored immutable evidence; remove fake-timer API-delay scaffolding.
- **"login recognizes migrated existing users and new login/register preserve all other users"**. **body-and-shared-setup** — Old browser handle creates a fresh empty account at current registration instead of adopting history/peer; v2 session identity, appends and new login/register preserve all actually committed new-store records and exact obsolete preferences/data. Setup: Clear tab identity and legacy localStorage; retain old map/preferences only as ignored immutable evidence; remove fake-timer API-delay scaffolding.
- **"auth data writes still reject while adapter saves still report failures without changing bytes"**. **body-and-shared-setup** — Inject fake-IDB put quota failure instead of obsolete localStorage writes; auth/plugin/append commands reject visibly (not silent save/null), revision/history unchanged, no fabricated new accounts and old browser bytes exact. Setup: Clear tab identity and legacy localStorage; retain old map/preferences only as ignored immutable evidence; remove fake-timer API-delay scaffolding.
- **"preserves credential checking, passwordless demo entry, and refuses registration over an existing record"**. **body-and-shared-setup** — Seed real existing account, await async full-history reads and use new tab credential cache; original wrong/correct/empty password and duplicate registration guards retained, not weakened. Setup: Clear tab identity and legacy localStorage; retain old map/preferences only as ignored immutable evidence; remove fake-timer API-delay scaffolding.

### `src/lib/storage/migrate.test.ts` (18 cases)

- **"migrates legacy map/single, derives registration and preserves extensions: {\"alice\":{\"username\":\"alice\",\"hits\":[{\"timestamp\":200},{\"id\":\"first\",\"timestamp\":0,\"date\":\"1970-01-01\",\"extra\":[\"keep\"]}],\"profile\":{\"email\":\"a@example.test\",\"custom\":true},\"settings\":{\"games\":{\"cardDropEnabled\":true,\"forkInTheRoadEnabled\":true}},\"cardCollections\":{\"#001\":7},\"custom\":{\"nested\":[1]}}}"** (template: "migrates legacy map/single, derives registration and preserves extensions: %j"); table variant: `{"alice":{"username":"alice","hits":[{"timestamp":200},{"id":"first","timestamp":0,"date":"1970-01-01","extra":["keep"]}],"profile":{"email":"a@example.test","custom":true},"settings":{"games":{"cardDropEnabled":true,"forkInTheRoadEnabled":true}},"cardCollections":{"#001":7},"custom":{"nested":[1]}}}`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"migrates legacy map/single, derives registration and preserves extensions: {\"username\":\"alice\",\"hits\":[{\"timestamp\":200},{\"id\":\"first\",\"timestamp\":0,\"date\":\"1970-01-01\",\"extra\":[\"keep\"]}],\"profile\":{\"email\":\"a@example.test\",\"custom\":true},\"settings\":{\"games\":{\"cardDropEnabled\":true,\"forkInTheRoadEnabled\":true}},\"cardCollections\":{\"#001\":7},\"custom\":{\"nested\":[1]}}"** (template: "migrates legacy map/single, derives registration and preserves extensions: %j"); table variant: `{"username":"alice","hits":[{"timestamp":200},{"id":"first","timestamp":0,"date":"1970-01-01","extra":["keep"]}],"profile":{"email":"a@example.test","custom":true},"settings":{"games":{"cardDropEnabled":true,"forkInTheRoadEnabled":true}},"cardCollections":{"#001":7},"custom":{"nested":[1]}}`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"is exactly idempotent for valid v2, including unknown rescue data"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves wrong shape/unreadable bytes without making up users: {broken"** (template: "preserves wrong shape/unreadable bytes without making up users: %s"); table variant: `"{broken"`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves wrong shape/unreadable bytes without making up users: null"** (template: "preserves wrong shape/unreadable bytes without making up users: %s"); table variant: `"null"`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves wrong shape/unreadable bytes without making up users: []"** (template: "preserves wrong shape/unreadable bytes without making up users: %s"); table variant: `"[]"`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves wrong shape/unreadable bytes without making up users: {\"schemaVersion\":3,\"users\":{}}"** (template: "preserves wrong shape/unreadable bytes without making up users: %s"); table variant: `"{\"schemaVersion\":3,\"users\":{}}"`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves wrong shape/unreadable bytes without making up users: {\"x\":{\"username\":\"x\",\"hits\":\"bad\"}}"** (template: "preserves wrong shape/unreadable bytes without making up users: %s"); table variant: `"{\"x\":{\"username\":\"x\",\"hits\":\"bad\"}}"`. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"converts date-only hits at local midnight, generates stable unique ids, and never mutates input"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"drops only unresolvable hits from active history, backs up everything, and reports each drop"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"persists no-history registration once and repairs missing/invalid v2 registration from history"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves unrelated record fields named date/timestamp without repeatedly migrating v2"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"derives registration for large histories without a spread-argument limit"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"preserves a known legacy registration even when history disagrees, and surfaces that conflict"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"backs up exact original bytes before rewriting, persists repair once, and preserves credentials"**. **body** — Deliberate ADR0006 fresh-start replacement of obsolete loader behavior: initialize/reopen an empty/new IDB authority; assert no legacy-key reads, writes or fabricated backups, exact obsolete bytes/credentials unchanged and new account survives reopen. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"blocks writes when runawaylog-data-backups fails; original user bytes survive"** (template: "blocks writes when %s fails; original user bytes survive"); table variant: `"runawaylog-data-backups"`. **body** — Deliberate ADR0006 change: failures writing obsolete localStorage data/backup keys cannot block actual IDB account creation, because these keys are never accessed; require ready status, no diagnostics, no localStorage writes and exact original bytes. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"blocks writes when runawaylog-data fails; original user bytes survive"** (template: "blocks writes when %s fails; original user bytes survive"); table variant: `"runawaylog-data"`. **body** — Deliberate ADR0006 change: failures writing obsolete localStorage data/backup keys cannot block actual IDB account creation, because these keys are never accessed; require ready status, no diagnostics, no localStorage writes and exact original bytes. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.
- **"never replaces malformed user data, exposes an exportable rescue, and reports diagnostics"**. **body** — Deliberate ADR0006 change: malformed obsolete browser bytes are ignored, not treated as corrupt IDB authority; assert no old-key reads/rewrite/backup, no false recovery diagnostics/logging, and successful fresh account creation. Actual IDB recovery belongs coordinator-owned recovery tests. Setup: Legacy localStorage clearing and mock restoration unchanged. Pure migration cases are explicitly unchanged.

### `src/lib/storage/preferences.test.ts` (6 cases)

- **"keeps calendar and locale preference bytes on their shipped device keys"**. **body-and-shared-setup** — Await actual preference commands, commit volatile selections with generation-zero account creation and reset/reopen to prove persistence; obsolete calendar/language keys remain unchanged sentinels rather than persistence targets. Setup: Clear both legacy browser data and v2 tab identity; reset data-theme for deterministic appearance.
- **"preserves opaque demo-identity cache bytes without changing keys or semantics"**. **body-and-shared-setup** — Opaque cache values now live in v2 tab session ownership; obsolete localStorage identity/token/credentials remain exact, removal affects only v2 token and clearing session removes v2 credentials. Setup: Clear both legacy browser data and v2 tab identity; reset data-theme for deterministic appearance.
- **"reads and writes the shipped dark-mode and timezone keys"**. **body-and-shared-setup** — Await IDB-owned appearance/timezone commands, commit and reopen; same dark UI/timezone guards retained while obsolete preference keys remain exact. Setup: Clear both legacy browser data and v2 tab identity; reset data-theme for deterministic appearance.
- **"repairs unavailable stored mode cloud to local without touching records"** (template: "repairs unavailable stored mode %s to local without touching records"); table variant: `"cloud"`. **body-and-shared-setup** — Deliberate fresh-start change: ignore obsolete unavailable mode without repairing/replacing its bytes; runtime stays local and obsolete records remain exact. Setup: Clear both legacy browser data and v2 tab identity; reset data-theme for deterministic appearance.
- **"repairs unavailable stored mode unknown to local without touching records"** (template: "repairs unavailable stored mode %s to local without touching records"); table variant: `"unknown"`. **body-and-shared-setup** — Deliberate fresh-start change: ignore obsolete unavailable mode without repairing/replacing its bytes; runtime stays local and obsolete records remain exact. Setup: Clear both legacy browser data and v2 tab identity; reset data-theme for deterministic appearance.
- **"cannot select or instantiate cloud storage and attempts no network request"**. **body-and-shared-setup** — Await preference setter and assert actual local public preference; cloud factory request returns local adapter without obsolete mode write or fetch. Setup: Clear both legacy browser data and v2 tab identity; reset data-theme for deterministic appearance.

### `src/lib/storage/preservation.test.ts` (5 cases)

- **"does not change a persisted registration when an otherwise valid update changes it"**. **body-and-shared-setup** — Create original registration via seedRecord; profile patch with colliding registeredAt plus UUID-stable rename/reopen cannot modify account registration. Identity immutability guarded without a retired whole-record writer. Setup: Clear both legacy localStorage and v2 tab session identity between cases.
- **"reports saved dropped-hit diagnostics on subsequent loads as well as the first migration"**. **body-and-shared-setup** — Deliberate fresh-start change: two boots ignore invalid obsolete hits, produce no dropped-hit diagnostics, read no obsolete data key and preserve exact original bytes. Setup: Clear both legacy localStorage and v2 tab session identity between cases.
- **"archives old full identity mirrors before reducing them to identity-only data"**. **body-and-shared-setup** — Deliberate session isolation: store new v2 tab identity separately, preserve old full identity mirror exactly, do not fabricate a new old-format archive. Setup: Clear both legacy localStorage and v2 tab session identity between cases.
- **"leaves the old identity mirror intact if its backup fails"**. **body-and-shared-setup** — Obsolete mirror backup must never be attempted; v2 tab identity succeeds while old mirror bytes remain exact even if that obsolete backup key would fail. Setup: Clear both legacy localStorage and v2 tab session identity between cases.
- **"does not overwrite malformed recovery archives or a mixed valid/invalid user map"**. **body-and-shared-setup** — Fresh IDB starts ready and creates only the new account; both obsolete map and malformed archive remain exact, and neither legacy valid nor invalid user is silently adopted. Setup: Clear both legacy localStorage and v2 tab session identity between cases.

### `src/lib/storage/registration.test.ts` (3 cases)

- **"uses the earliest finite instant and preserves all non-legacy fields and original history in backup"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing/mock restoration unchanged. First two pure migrate registration tests unchanged.
- **"uses now for empty or non-finite history and preserves existing dates idempotently"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing/mock restoration unchanged. First two pure migrate registration tests unchanged.
- **"repairs the whole legacy map once, round-trips extras, and records stored byte evidence"**. **body** — Deliberate fresh-start change: old map ignored rather than migrated, no reads/writes/backups and exact bytes retained; create a new account/profile and verify exact registration/profile snapshot across reopen. Setup: Existing localStorage clearing/mock restoration unchanged. First two pure migrate registration tests unchanged.

### `src/test/runScene.test.tsx` (23 cases)

- **"exposes role=dialog, aria-modal and a resolvable accessible name (AC-A1, AC-A2)"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"renders title, body, choices then Skip in that reading order (AC-A8)"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"uses native, keyboard-operable buttons for every control (AC-A9)"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T1: choice A always renders the exact outcome_board string, across repeated mounts"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T2: choice B renders outcome_wait and never leaks outcome_board"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T3: choosing consumes both choice buttons in that instance"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T4: Skip calls onClose exactly once, shows no outcome and removes the dialog"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T5: Escape closes from the choices state"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T5: Escape closes from the outcome state"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"Close dismisses the outcome (the same onClose path)"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T9: initial focus is the first choice button"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T9: Tab from the last control wraps to the first"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T9: Shift+Tab from the first control wraps to the last"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T9: focus stays inside the dialog when it starts outside (containment guard)"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"moves focus to Close when the choices are replaced, keeping it in the dialog"**. **shared-setup-only** — Original accessibility/determinism/keyboard/focus assertions unchanged; await initial device locale command before render. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T8: every run_scene key resolves in en_us"** (template: "T8: every run_scene key resolves in %s"); table variant: `"en_us"`. **body-and-shared-setup** — Await each locale preference before original key-resolution checks. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T8: every run_scene key resolves in zh_cn"** (template: "T8: every run_scene key resolves in %s"); table variant: `"zh_cn"`. **body-and-shared-setup** — Await each locale preference before original key-resolution checks. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T8: every run_scene key resolves in zh_tw"** (template: "T8: every run_scene key resolves in %s"); table variant: `"zh_tw"`. **body-and-shared-setup** — Await each locale preference before original key-resolution checks. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T8: the scene renders translated copy, not key paths"**. **body-and-shared-setup** — Await zh_cn locale before exact simplified-Chinese content/accessibility assertions. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T7: the scene opens after the first successful Run and not again in the same session"**. **body-and-shared-setup** — Await hydrated Dashboard render and complete 2200ms second animation/save window instead of obsolete 900ms; scene-once assertions unchanged. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T7: a fresh component tree (as a reload) re-arms the scene"**. **body-and-shared-setup** — Both trees await actual committed account and matching RunView hydration; rearming guards unchanged. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"T6: a full Run → choose → Close cycle writes nothing scene-related"**. **body-and-shared-setup** — Observe real committed addHit instead of removed saveUserData; verify one exact persisted hit/registration and inspect every committed virtual file path/bytes for scene/title/outcome absence, preserving and strengthening no-persistence guard. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.
- **"restores focus to the Run control after Skip and Escape (AC-A21)"**. **body-and-shared-setup** — Await matching account/view hydration before both render sessions; original Skip/Escape focus and enabled assertions unchanged. Setup: Await locale setup, reset command-observation list, retain deterministic random; Dashboard helper explicitly seeds fresh account and hydrates matching RunView before render.

### `src/test/settings-data.test.tsx` (7 cases)

- **"never writes on file selection or cancel; replace requires explicit destructive confirmation"**. **body-and-shared-setup** — Await full-record counts/metadata and missing-other snapshot; require positive import dialog without error alert, retain destructive checkbox gate and preserve exact public device preferences. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"merge deduplicates existing and incoming ids without changing identity or other user data"**. **body-and-shared-setup** — Retain positive duplicate-id legacy fixture and merge expectations; await full-record counts/profile; deferred importer remains failure. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"cancel preserves bytes and language switching keeps the open import without losing hits"**. **body-and-shared-setup** — Await positive dialog and locale change in act; capture revision after legitimate device-language commit, then cancel must preserve full record and exact revision. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"round-trips exported timestamps and ids while retaining game settings"**. **body-and-shared-setup** — Await actual ZIP download, assert Blob ZIP MIME and feed real exported .zip to positive importer; exact hits/plugin expectations retained, intentionally failing deferred import. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals. Positive importer contract intentionally retained; deferred behavior remains a failure.
- **"rejects malformed imports before any write: null"** (template: "rejects malformed imports before any write: %j"). **body-and-shared-setup** — Retain negative fixtures/rejection expectations; compare full current record/hits/revision unchanged instead of vacuous obsolete-key bytes. Green broad rejection is not implemented validation evidence. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals.
- **"rejects malformed imports before any write: {\"username\":\"x\",\"hits\":[null]}"** (template: "rejects malformed imports before any write: %j"); table variant: `{"username":"x","hits":[null]}`. **body-and-shared-setup** — Retain negative fixtures/rejection expectations; compare full current record/hits/revision unchanged instead of vacuous obsolete-key bytes. Green broad rejection is not implemented validation evidence. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals.
- **"rejects malformed imports before any write: {\"username\":\"x\",\"hits\":[{\"id\":\"a\",\"timestamp\":\"bad\",\"date\":\"2025-01-01\"}]}"** (template: "rejects malformed imports before any write: %j"); table variant: `{"username":"x","hits":[{"id":"a","timestamp":"bad","date":"2025-01-01"}]}`. **body-and-shared-setup** — Retain negative fixtures/rejection expectations; compare full current record/hits/revision unchanged instead of vacuous obsolete-key bytes. Green broad rejection is not implemented validation evidence. Setup: Await locale, seed real current account, use v2 tab username; positive legacy JSON selection remains explicit unsupported-format/deferred importer evidence; cleanup unstubs globals.

### `src/test/settings-header-import.test.tsx` (1 cases)

- **"header import obeys confirmation and preserves profile, games, identity, and device preferences"**. **body-and-shared-setup** — Keep original positive JSON selection/no-error dialog and checkbox confirmation expectations; await canonical full-record mutation/profile/registration guards and exact public device preferences. Deferred importer must remain positive failure. Setup: Await locale, real fixture commit and matching RunView hydration. Positive importer contract intentionally retained; deferred behavior remains a failure.

### `src/test/settings-preferences.test.tsx` (1 cases)

- **"settings changes persist across remount; cloud is inert and local writes never fetch"**. **body-and-shared-setup** — Wait for each committed appearance/theme/timezone/language selection and flush writes; inspect public preferences instead of obsolete keys; reset/reinitialize between remounts proves hydration; preserve inert cloud/no-fetch guards and untouched obsolete cloud key. Setup: Await initial locale and create account so subsequent preferences are durable rather than pre-login volatile.

### `src/test/storage.test.ts` (13 cases)

- **"returns null when no data exists"**. **shared-setup-only** — Original missing-account assertion unchanged; setup awaits actual UTC device preference. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"returns null when user does not exist"**. **body-and-shared-setup** — Seed another real account through public commands rather than ignored legacy bytes; requested account remains missing. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"loads existing user data"**. **body-and-shared-setup** — Seed committed record, load AccountSnapshot total/no hits and explicit full-record exact hits; no legacy browser persistence. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"retains the repaired registration date on a second load after the clock changes"**. **body-and-shared-setup** — Old map is ignored, then explicit creation under controlled clock fixes registration; reset/reopen after clock change preserves exact snapshot/date and legacy bytes. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"handles corrupted data gracefully"**. **body-and-shared-setup** — Reinitialize fresh IDB while malformed obsolete browser bytes remain ignored/untouched. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"saves new user data"**. **body-and-shared-setup** — Replace removed whole-record writer with seedRecord command sequence; reset/reopen proves persisted full record and no obsolete storage write. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"updates existing user data"**. **body-and-shared-setup** — Use appendHit and updateProfile intents instead of stale whole-record save; assert exact two hits, updated email and original registration. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"preserves other users data"**. **body-and-shared-setup** — Seed two accounts via commands and compare entire first account unchanged plus both canonical fixture fields. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"creates new user and adds hit"**. **body-and-shared-setup** — Explicit createAccount precedes append because append no longer implicitly creates records; retain hit id/time/no-date/no-timestamp and verify persisted exact hit. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"adds hit to existing user"**. **body-and-shared-setup** — Seed via commands; assert snapshot total and explicit full-history count both equal two. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"generates unique IDs"**. **body-and-shared-setup** — Explicitly create account before two appends; unique-id expectation unchanged. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"stores current timestamp"**. **body-and-shared-setup** — Explicitly create account before append; existing before/after timestamp bounds unchanged. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.
- **"timezone changes never rewrite stored hits or registration"**. **body-and-shared-setup** — Create/append, await real timezone preference, verify exact entire full record and chunk descriptors unchanged; include newly canonical schema/record version keys in exact hit-key assertion. Setup: Await UTC preference command in setup instead of writing obsolete timezone key.

### `src/test/timezone.test.ts` (21 cases)

- **"returns an array of timezones"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"includes UTC"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"includes major cities"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns a string"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns a valid timezone format"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns browser timezone when nothing is saved"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"saves and retrieves timezone"**. **body** — Await asynchronous timezone command before observing snapshot; expected timezone unchanged. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"overwrites previous timezone"**. **body** — Await both sequential asynchronous timezone commands; latest-wins expectation unchanged. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"converts timestamp to YYYY-MM-DD format"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"handles UTC timezone"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"handles different timezones"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"handles midnight edge case"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns a number"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns a positive number"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns current time"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"formats date with time"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"includes month, day, year, and time"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"returns a string"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"includes timezone name"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"includes UTC offset"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.
- **"handles invalid timezone gracefully"**. **unchanged** — Original pure test body and file-local setup unchanged; included only for complete original-case accounting. Setup: Existing localStorage clearing unchanged; global coordinator storage initialization handles memory reset.

### `src/ui/Login.storage.test.tsx` (1 cases)

- **"offers a downloadable original-byte rescue when a malformed store blocks login"**. **body-and-shared-setup** — Deliberate ADR0006 conflict: malformed obsolete browser key is no longer the authority, so fresh boot/login must succeed with an empty new-store account, no false rescue/download, no rewriting/backing up old bytes. New IDB corruption/rescue cases remain coordinator-owned. Setup: Await locale setup.

### `src/test/i18n-surfaces.test.tsx` (33 cases)

- **"Navigation opened menu resolves all three existing keys"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Print dialog declares its exact modal contract and resolves the localized title id"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Settings opens the loaded current-month calendar, never the Settings print surface"**; loop: `{"locale":"en_us"}`. **body-and-shared-setup** — Append real persisted boundary hit and spy readRunView (not removed synchronous/mocked record load); retain selected timezone/current month totals/no automatic print/focus assertions. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Print dialog and printed sheet resolve every label, Sunday-first weekday, month and date"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Album page 1 resolves six cards, rarity, owned counts and pagination"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Album page 2 resolves unowned legendary cards, four sentinels and wraparound"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Login language picker has the approved localized accessible name"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Navigation opened menu resolves all three existing keys"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Print dialog declares its exact modal contract and resolves the localized title id"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Settings opens the loaded current-month calendar, never the Settings print surface"**; loop: `{"locale":"zh_cn"}`. **body-and-shared-setup** — Append real persisted boundary hit and spy readRunView (not removed synchronous/mocked record load); retain selected timezone/current month totals/no automatic print/focus assertions. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Print dialog and printed sheet resolve every label, Sunday-first weekday, month and date"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Album page 1 resolves six cards, rarity, owned counts and pagination"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Album page 2 resolves unowned legendary cards, four sentinels and wraparound"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Login language picker has the approved localized accessible name"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Navigation opened menu resolves all three existing keys"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Print dialog declares its exact modal contract and resolves the localized title id"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Settings opens the loaded current-month calendar, never the Settings print surface"**; loop: `{"locale":"zh_tw"}`. **body-and-shared-setup** — Append real persisted boundary hit and spy readRunView (not removed synchronous/mocked record load); retain selected timezone/current month totals/no automatic print/focus assertions. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Print dialog and printed sheet resolve every label, Sunday-first weekday, month and date"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Album page 1 resolves six cards, rarity, owned counts and pagination"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Album page 2 resolves unowned legendary cards, four sentinels and wraparound"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Login language picker has the approved localized accessible name"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"traps forward/reverse Tab from the container, boundaries and escaped focus; recovers after printing"**. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"closes via escape and returns focus to the connected opener"** (template: "closes via %s and returns focus to the connected opener"); table variant: `"escape"`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"closes via overlay and returns focus to the connected opener"** (template: "closes via %s and returns focus to the connected opener"); table variant: `"overlay"`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"closes via close and returns focus to the connected opener"** (template: "closes via %s and returns focus to the connected opener"); table variant: `"close"`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"closes via cancel and returns focus to the connected opener"** (template: "closes via %s and returns focus to the connected opener"); table variant: `"cancel"`. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"does not restore focus to a disconnected opener"**. **shared-setup-only** — Original rendered strings, keyboard/modal/focus/print or album assertions retained; use real committed shared account/plugin fixture and awaited device locale/timezone setup. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Settings falls back to empty hits for missing data"** (template: "Settings falls back to empty hits for %s data"); table variant: `"missing"`. **body-and-shared-setup** — For missing delete actual account; for rejected spy async readRunView rejection. Require visible error, no dialog/day cells/totals/print-mode. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown. Current name: "Settings shows an error without a misleading empty calendar for missing data".
- **"Settings falls back to empty hits for rejected data"** (template: "Settings falls back to empty hits for %s data"); table variant: `"rejected"`. **body-and-shared-setup** — For missing delete actual account; for rejected spy async readRunView rejection. Require visible error, no dialog/day cells/totals/print-mode. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown. Current name: "Settings shows an error without a misleading empty calendar for rejected data".
- **"captures the click month once before awaiting the data load"**. **body-and-shared-setup** — Gate actual readRunView through a deferred promise, assert UUID/timezone/click-month request, cross month while pending and retain November sheet/count assertions. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"resolves keys on rerender without adding Print/Album language subscriptions or refetching"**. **body-and-shared-setup** — Await locale commands in act; spy public record/full-record/RunView reads instead of removed adapter mocks; all counts stable across rerenders. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"zh_cn rendered card strings and chrome equal the pinned baseline except the exact authorized rarity/menu changes"**. **body-and-shared-setup** — Await zh_cn locale and real album snapshot; all pinned strings/chrome/rarity/menu guards unchanged. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.
- **"Navigation keeps its existing persistent-route subscription"**. **body-and-shared-setup** — Await locale changes inside act; original live subscription assertions unchanged. Setup: Main-only adaptation: remove fake storage.load/save mocks; create real committed account, games/cards and v2 session identity through public boundary; await locale/timezone setup and teardown.

### `src/lib/i18n/extension.test.tsx` (4 cases)

- **"confines locale branching/data and formatting to libraries, including root quotes"**. **shared-setup-only** — Static ownership/formatting scan unchanged; async locale teardown only. Setup: Main-only adaptation: await locale teardown so no preference command escapes reset.
- **"localizes document language, calendar tooltip and unchanged first quote: en_us"** (template: "localizes document language, calendar tooltip and unchanged first quote: %s"); table variant: `["en_us","en-US","2026-11-13: 1 escape dream","The only impossible journey is the one you never begin."]`. **body-and-shared-setup** — Await locale before document/calendar/quote checks and await reset inside act; exact localized strings preserved. Setup: Main-only adaptation: await locale teardown so no preference command escapes reset.
- **"localizes document language, calendar tooltip and unchanged first quote: zh_cn"** (template: "localizes document language, calendar tooltip and unchanged first quote: %s"); table variant: `["zh_cn","zh-CN","2026-11-13：1 个跑路梦想","生活不是等待风暴过去，而是学会在雨中跳舞。"]`. **body-and-shared-setup** — Await locale before document/calendar/quote checks and await reset inside act; exact localized strings preserved. Setup: Main-only adaptation: await locale teardown so no preference command escapes reset.
- **"localizes document language, calendar tooltip and unchanged first quote: zh_tw"** (template: "localizes document language, calendar tooltip and unchanged first quote: %s"); table variant: `["zh_tw","zh-TW","2026-11-13：1 個跑路夢想","生活不是等待風暴過去，而是學會在雨中跳舞。"]`. **body-and-shared-setup** — Await locale before document/calendar/quote checks and await reset inside act; exact localized strings preserved. Setup: Main-only adaptation: await locale teardown so no preference command escapes reset.

### `src/lib/i18n/parity.test.ts` (13 cases)

- **"en_us: identical full locale key paths and placeholders, with every frozen baseline string byte preserved"**; loop: `{"locale":"en_us"}`. **body-and-shared-setup** — Await locale selection before exact frozen baseline/interpolation/markup assertions; all byte/placeholder/tag expectations unchanged. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"en_us: CJK / untranslated proper noun contract"**; loop: `{"locale":"en_us"}`. **shared-setup-only** — Original parity/compiler/static scan assertions unchanged; asynchronous locale teardown only. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"en_us: markup remains a string with exactly the shipped tags"**; loop: `{"locale":"en_us"}`. **body-and-shared-setup** — Await locale selection before exact frozen baseline/interpolation/markup assertions; all byte/placeholder/tag expectations unchanged. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"zh_cn: identical full locale key paths and placeholders, with every frozen baseline string byte preserved"**; loop: `{"locale":"zh_cn"}`. **body-and-shared-setup** — Await locale selection before exact frozen baseline/interpolation/markup assertions; all byte/placeholder/tag expectations unchanged. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"zh_cn: CJK / untranslated proper noun contract"**; loop: `{"locale":"zh_cn"}`. **shared-setup-only** — Original parity/compiler/static scan assertions unchanged; asynchronous locale teardown only. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"zh_cn: markup remains a string with exactly the shipped tags"**; loop: `{"locale":"zh_cn"}`. **body-and-shared-setup** — Await locale selection before exact frozen baseline/interpolation/markup assertions; all byte/placeholder/tag expectations unchanged. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"zh_tw: identical full locale key paths and placeholders, with every frozen baseline string byte preserved"**; loop: `{"locale":"zh_tw"}`. **body-and-shared-setup** — Await locale selection before exact frozen baseline/interpolation/markup assertions; all byte/placeholder/tag expectations unchanged. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"zh_tw: CJK / untranslated proper noun contract"**; loop: `{"locale":"zh_tw"}`. **shared-setup-only** — Original parity/compiler/static scan assertions unchanged; asynchronous locale teardown only. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"zh_tw: markup remains a string with exactly the shipped tags"**; loop: `{"locale":"zh_tw"}`. **body-and-shared-setup** — Await locale selection before exact frozen baseline/interpolation/markup assertions; all byte/placeholder/tag expectations unchanged. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"compiler rejects missing and extra keys at top level and nested levels"**. **shared-setup-only** — Original parity/compiler/static scan assertions unchanged; asynchronous locale teardown only. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"retains the existing hardcoded-copy AST rule and applies it to features/ui"**. **shared-setup-only** — Original parity/compiler/static scan assertions unchanged; asynchronous locale teardown only. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"preserves fallback, missing variables, language aliases, persistence and subscriptions"**. **body-and-shared-setup** — Await every alias selection, assert public async readPreferences language, and preserve an obsolete app-language sentinel unchanged rather than expecting legacy-key writes; missing key/interpolation/callback assertions retained. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.
- **"useT updates existing mounted state without remounting or losing the open dialog"**. **body-and-shared-setup** — Await locale change inside act; same dialog/input references/open state/edited value/no reload assertions retained. Setup: Main-only adaptation: await locale teardown so preferences settle before storage reset.

### `src/app/routes.test.tsx` (3 cases)

- **"recovers from a whole-surface failure through outer route navigation in en_us"** (template: "recovers from a whole-surface failure through outer route navigation in %s"); table variant: `"en_us"`. **body** — Main-only adaptation: await locale selection before rendering. All original outer-boundary/navigation/recovery/re-entry assertions unchanged. Setup: No shared setup adaptation.
- **"recovers from a whole-surface failure through outer route navigation in zh_cn"** (template: "recovers from a whole-surface failure through outer route navigation in %s"); table variant: `"zh_cn"`. **body** — Main-only adaptation: await locale selection before rendering. All original outer-boundary/navigation/recovery/re-entry assertions unchanged. Setup: No shared setup adaptation.
- **"recovers from a whole-surface failure through outer route navigation in zh_tw"** (template: "recovers from a whole-surface failure through outer route navigation in %s"); table variant: `"zh_tw"`. **body** — Main-only adaptation: await locale selection before rendering. All original outer-boundary/navigation/recovery/re-entry assertions unchanged. Setup: No shared setup adaptation.

### `src/features/about/About.test.tsx` (3 cases)

- **"links About to localized dated release history without a false latest badge in en_us"** (template: "links About to localized dated release history without a false latest badge in %s"); table variant: `"en_us"`. **body** — Main-only adaptation: async table callback awaits locale selection; all version/package/release-link/date/badge/localized-history assertions unchanged. Setup: No shared setup adaptation.
- **"links About to localized dated release history without a false latest badge in zh_cn"** (template: "links About to localized dated release history without a false latest badge in %s"); table variant: `"zh_cn"`. **body** — Main-only adaptation: async table callback awaits locale selection; all version/package/release-link/date/badge/localized-history assertions unchanged. Setup: No shared setup adaptation.
- **"links About to localized dated release history without a false latest badge in zh_tw"** (template: "links About to localized dated release history without a false latest badge in %s"); table variant: `"zh_tw"`. **body** — Main-only adaptation: async table callback awaits locale selection; all version/package/release-link/date/badge/localized-history assertions unchanged. Setup: No shared setup adaptation.

### `src/ui/SurfaceBoundary.test.tsx` (3 cases)

- **"isolates a real throwing surface and recovers by navigation in en_us"** (template: "isolates a real throwing surface and recovers by navigation in %s"); table variant: `"en_us"`. **body** — Main-only adaptation: async table callback awaits locale selection; all actual throwing surface, visible error/navigation and recovery assertions unchanged. Setup: No shared setup adaptation.
- **"isolates a real throwing surface and recovers by navigation in zh_cn"** (template: "isolates a real throwing surface and recovers by navigation in %s"); table variant: `"zh_cn"`. **body** — Main-only adaptation: async table callback awaits locale selection; all actual throwing surface, visible error/navigation and recovery assertions unchanged. Setup: No shared setup adaptation.
- **"isolates a real throwing surface and recovers by navigation in zh_tw"** (template: "isolates a real throwing surface and recovers by navigation in %s"); table variant: `"zh_tw"`. **body** — Main-only adaptation: async table callback awaits locale selection; all actual throwing surface, visible error/navigation and recovery assertions unchanged. Setup: No shared setup adaptation.


### Global setup-only impact on unchanged test files

The following 13 baseline cases are textually unchanged; only the globally awaited real persistence setup/cleanup applies. Their source assertions were not adapted or weakened:

- `src/test/i18n-hardcoded.test.ts` — **"walks all component/page TSX files and excludes comments by construction"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n-hardcoded.test.ts` — **"has no remaining hardcoded CJK or plain accessibility labels"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n-structure.test.ts` — **"one module CARDS retains all eight records, order and Chinese card strings; sentinels stay empty keys"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n-structure.test.ts` — **"Print subscribes reactively and delegates both date formats to the locale library; Album adds no manual subscription"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n-structure.test.ts` — **"new zh_tw strings use the exact approved Traditional forms, not their Simplified alternatives"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n.test.ts` — **"en_us: frozen baseline subset matches exactly and rejects a mutated string"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n.test.ts` — **"zh_cn: frozen baseline subset matches exactly"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n.test.ts` — **"zh_tw: frozen baseline subset matches exactly"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/i18n.test.ts` — **"every literal i18n.t call in every source file resolves to a string in every locale"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/quotes.test.ts` — **"returns a string"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/quotes.test.ts` — **"returns non-empty strings"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/quotes.test.ts` — **"returns different quotes over multiple calls"**: unchanged body; global real-IDB/WebCrypto lifecycle only.
- `src/test/quotes.test.ts` — **"never returns undefined or null"**: unchanged body; global real-IDB/WebCrypto lifecycle only.

## Exactly-once final full gate sequence: raw complete outputs

Source freeze: 2026-11-16T03:41:44Z; execution started 03:41:50Z. The four commands ran sequentially despite the test failure; no retry and no source edit followed. Stdout and stderr were directed to the same per-command file descriptor to preserve complete interleaved output. Raw ANSI escapes are intentionally retained inside the fences. Empty TypeScript output really is empty. Each output SHA-256 below enables byte-level cross-check against retained evidence.

### `npx eslint .` — actual exit 0

UTC 2026-11-16T03:41:50.102Z → 2026-11-16T03:41:52.333Z; signal null; spawn error null. SHA-256 of raw stdout/stderr: `4b26e86573abb5abbed064058ad9ba1b377a4eadbd38d84469a6bcecf2160deb`.

```text
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
```

### `npx tsc -b` — actual exit 0

UTC 2026-11-16T03:41:52.334Z → 2026-11-16T03:41:54.140Z; signal null; spawn error null. SHA-256 of raw stdout/stderr: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

```text

```

### `npm test -- --run` — actual exit 1

UTC 2026-11-16T03:41:54.140Z → 2026-11-16T03:42:08.167Z; signal null; spawn error null. SHA-256 of raw stdout/stderr: `b04eb179f317641174d46b1e43eee4e2fd1e270082ba45bac8b443e528bdbaca`.

```text

> runawaylog@1.2.0 test
> vitest --run


[1m[46m RUN [49m[22m [36mv4.0.15 [39m[90m/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a[39m

 [32m✓[39m shared/codec.test.ts [2m([22m[2m70 tests[22m[2m)[22m[32m 58[2mms[22m[39m
 [32m✓[39m src/test/timezone.test.ts [2m([22m[2m21 tests[22m[2m)[22m[32m 64[2mms[22m[39m
 [32m✓[39m src/test/storage.test.ts [2m([22m[2m13 tests[22m[2m)[22m[33m 584[2mms[22m[39m
 [32m✓[39m src/app/routes.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 435[2mms[22m[39m
 [31m❯[39m src/test/i18n-structure.test.ts [2m([22m[2m3 tests[22m[2m | [22m[31m1 failed[39m[2m)[22m[32m 113[2mms[22m[39m
[31m     [31m×[31m one module CARDS retains all eight records, order and Chinese card strings; sentinels stay empty keys[39m[32m 96[2mms[22m[39m
     [32m✓[39m Print subscribes reactively and delegates both date formats to the locale library; Album adds no manual subscription[32m 12[2mms[22m[39m
     [32m✓[39m new zh_tw strings use the exact approved Traditional forms, not their Simplified alternatives[32m 2[2mms[22m[39m
 [32m✓[39m src/features/print/PrintCalendar.test.tsx [2m([22m[2m7 tests[22m[2m)[22m[33m 771[2mms[22m[39m
     [33m[2m✓[22m[39m Settings opens the current month from the persisted record without invoking window.print [33m 423[2mms[22m[39m
 [31m❯[39m src/lib/data/transfer.test.ts [2m([22m[2m13 tests[22m[2m | [22m[31m7 failed[39m[2m)[22m[33m 1224[2mms[22m[39m
[31m     [31m×[31m exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication[39m[32m 297[2mms[22m[39m
     [32m✓[39m exports the latest typed record rather than a stale UI snapshot, including identity recovery bytes[32m 144[2mms[22m[39m
[31m     [31m×[31m merge retains current identity/profile/games/cards and preserves imported unknown data[39m[32m 58[2mms[22m[39m
[31m     [31m×[31m replace retains current identity/profile/games/cards and preserves imported unknown data[39m[32m 71[2mms[22m[39m
     [32m✓[39m rejects unsafe imports without touching existing bytes: null[32m 62[2mms[22m[39m
     [32m✓[39m rejects unsafe imports without touching existing bytes: undefined[32m 139[2mms[22m[39m
     [32m✓[39m rejects unsafe imports without touching existing bytes: {"username":"x","hits":[null]}[32m 60[2mms[22m[39m
     [32m✓[39m rejects unsafe imports without touching existing bytes: {"schemaVersion":2,"users":{}}[32m 45[2mms[22m[39m
     [32m✓[39m rejects unsafe imports without touching existing bytes: {"username":"x","hits":[{"date":"2024-02-30"}]}[32m 105[2mms[22m[39m
[31m     [31m×[31m preserves arbitrary existing unknown values across a confirmed import[39m[32m 137[2mms[22m[39m
[31m     [31m×[31m confirmed merge reads current storage rather than losing hits added after the dialog opened[39m[32m 47[2mms[22m[39m
[31m     [31m×[31m confirmed import propagates a storage failure without changing current bytes[39m[32m 57[2mms[22m[39m
[31m     [31m×[31m accepts legacy maps through the same migration and refuses ambiguous multi-user replacement[39m[32m 1[2mms[22m[39m
[90mstdout[2m | src/test/i18n.test.ts[2m > [22m[2mi18n shipped fixture parity[2m > [22m[2mevery literal i18n.t call in every source file resolves to a string in every locale
[22m[39mChecked 236 literal calls (158 unique paths) across 113 source files in all 3 locales.

 [32m✓[39m src/test/i18n.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 276[2mms[22m[39m
[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2men_us: identical full locale key paths and placeholders, with every frozen baseline string byte preserved
[22m[39men_us: 203 keys; changed-value diff: []

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2men_us: markup remains a string with exactly the shipped tags
[22m[39men_us dashboard.hit_count: <span>Runaway Count: <strong>42</strong></span>

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mzh_cn: identical full locale key paths and placeholders, with every frozen baseline string byte preserved
[22m[39mzh_cn: 203 keys; changed-value diff: []

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mzh_cn: markup remains a string with exactly the shipped tags
[22m[39mzh_cn dashboard.hit_count: <span>跑路次数：<strong>42</strong></span>

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mzh_tw: identical full locale key paths and placeholders, with every frozen baseline string byte preserved
[22m[39mzh_tw: 203 keys; changed-value diff: []

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mzh_tw: markup remains a string with exactly the shipped tags
[22m[39mzh_tw dashboard.hit_count: <span>跑路次數：<strong>42</strong></span>

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrecords once under double press and claims the scene once across route remounts, rearming only for a new page tree
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 [31m❯[39m src/test/settings-header-import.test.tsx [2m([22m[2m1 test[22m[2m | [22m[31m1 failed[39m[2m)[22m[33m 1204[2mms[22m[39m
[31m   [31m×[31m header import obeys confirmation and preserves profile, games, identity, and device preferences[39m[33m 1204[2mms[22m[39m
 [32m✓[39m src/features/games/Games.test.tsx [2m([22m[2m2 tests[22m[2m)[22m[33m 599[2mms[22m[39m
   [33m[2m✓[22m[39m persists keyboard-accessible game toggles per user and leaves coming-soon controls inert [33m 524[2mms[22m[39m
[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrenders an independently registered two-control game and respects count, scene and wrong animation outcomes
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrenders an independently registered two-control game and respects count, scene and wrong animation outcomes
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mrenders an independently registered two-control game and respects count, scene and wrong animation outcomes
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mcompiler rejects missing and extra keys at top level and nested levels
[22m[39mCompiler rejected missing: Type '{ title: string; }' is missing the following properties from type '{ title: string; run_button: string; hit_count: string; logout: string; settings: string; brand_title: string; }': "run_button", "hit_count", "logout", "settings", "brand_title"
Compiler rejected extra: Object literal may only specify known properties, and 'unexpected' does not exist in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }'.
Compiler rejected nested extra: Object literal may only specify known properties, and 'unexpected' does not exist in type '{ title: string; run_button: string; hit_count: string; logout: string; settings: string; brand_title: string; }'.
Compiler rejected top missing: Type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 13 more ...; run_scene: { ...; }; }' does not satisfy the expected type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }'.
  Property '"dashboard"' is missing in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 13 more ...; run_scene: { ...; }; }' but required in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }'.

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mretains the existing hardcoded-copy AST rule and applies it to features/ui
[22m[39mUnchanged hardcoded-copy AST rule: 37 sources; 0 findings; directories: src/features, src/ui

 [32m✓[39m src/lib/i18n/parity.test.ts [2m([22m[2m13 tests[22m[2m)[22m[33m 1281[2mms[22m[39m
     [33m[2m✓[22m[39m compiler rejects missing and extra keys at top level and nested levels [33m 1082[2mms[22m[39m
 [32m✓[39m src/features/run/Run.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 1657[2mms[22m[39m
     [33m[2m✓[22m[39m records once under double press and claims the scene once across route remounts, rearming only for a new page tree [33m 701[2mms[22m[39m
     [33m[2m✓[22m[39m wrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus [33m 453[2mms[22m[39m
 [32m✓[39m src/lib/storage/selective.test.ts [2m([22m[2m1 test[22m[2m)[22m[33m 1718[2mms[22m[39m
   [33m[2m✓[22m[39m hydrates no history on reload and fetches only recent-reference chunks for the log view [33m 1717[2mms[22m[39m
 [31m❯[39m src/test/settings-data.test.tsx [2m([22m[2m7 tests[22m[2m | [22m[31m4 failed[39m[2m)[22m[33m 3497[2mms[22m[39m
[31m     [31m×[31m never writes on file selection or cancel; replace requires explicit destructive confirmation[39m[33m 1183[2mms[22m[39m
[31m     [31m×[31m merge deduplicates existing and incoming ids without changing identity or other user data[39m[33m 1072[2mms[22m[39m
[31m     [31m×[31m cancel preserves bytes and language switching keeps the open import without losing hits[39m[33m 1059[2mms[22m[39m
[31m     [31m×[31m round-trips exported timestamps and ids while retaining game settings[39m[32m 75[2mms[22m[39m
     [32m✓[39m rejects malformed imports before any write: null[32m 36[2mms[22m[39m
     [32m✓[39m rejects malformed imports before any write: {"username":"x","hits":[null]}[32m 33[2mms[22m[39m
     [32m✓[39m rejects malformed imports before any write: {"username":"x","hits":[{"id":"a","timestamp":"bad","date":"2025-01-01"}]}[32m 37[2mms[22m[39m
 [32m✓[39m src/test/settings-preferences.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 462[2mms[22m[39m
   [33m[2m✓[22m[39m settings changes persist across remount; cloud is inert and local writes never fetch [33m 461[2mms[22m[39m
 [32m✓[39m src/test/i18n-surfaces.test.tsx [2m([22m[2m33 tests[22m[2m)[22m[33m 4213[2mms[22m[39m
     [33m[2m✓[22m[39m Settings opens the loaded current-month calendar, never the Settings print surface [33m 405[2mms[22m[39m
 [32m✓[39m src/lib/data/archive.export.test.ts [2m([22m[2m26 tests[22m[2m)[22m[33m 515[2mms[22m[39m
 [32m✓[39m src/ui/Login.storage.test.tsx [2m([22m[2m1 test[22m[2m)[22m[32m 277[2mms[22m[39m
 [32m✓[39m src/lib/storage/core.test.ts [2m([22m[2m11 tests[22m[2m)[22m[33m 1439[2mms[22m[39m
     [33m[2m✓[22m[39m projects exact timestamps and recent fifty without statistics fetching history chunks [33m 914[2mms[22m[39m
 [32m✓[39m src/lib/storage/byte-boundary.test.ts [2m([22m[2m1 test[22m[2m)[22m[33m 449[2mms[22m[39m
   [33m[2m✓[22m[39m allows exactly one million UTF-8 envelope bytes and rolls the next byte without rewriting the completed tail [33m 448[2mms[22m[39m
 [32m✓[39m src/features/run/Run.failure.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 3258[2mms[22m[39m
     [33m[2m✓[22m[39m shows a rejected real IDB write, preserves history and the scene claim, then unlocks for one safe retry [33m 3257[2mms[22m[39m
 [32m✓[39m src/features/profile/Profile.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 783[2mms[22m[39m
   [33m[2m✓[22m[39m localizes member duration and persists email and the original registration date in en_us [33m 450[2mms[22m[39m
 [32m✓[39m src/lib/storage/integrity-commands.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 1462[2mms[22m[39m
     [33m[2m✓[22m[39m rejects historical ids outside recent fifty using the index without fetching old chunks [33m 1272[2mms[22m[39m
 [32m✓[39m src/lib/storage/preservation.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 95[2mms[22m[39m
 [32m✓[39m src/features/about/About.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 328[2mms[22m[39m
 [32m✓[39m src/lib/storage/preferences.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 98[2mms[22m[39m
 [32m✓[39m src/lib/storage/migrate.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 397[2mms[22m[39m
 [32m✓[39m src/lib/storage/publication.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 261[2mms[22m[39m
 [32m✓[39m src/lib/storage/recovery.test.ts [2m([22m[2m14 tests[22m[2m)[22m[33m 389[2mms[22m[39m
 [32m✓[39m src/lib/i18n/extension.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[32m 145[2mms[22m[39m
 [32m✓[39m shared/integrity.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 39[2mms[22m[39m
 [32m✓[39m src/lib/storage/consumers.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 806[2mms[22m[39m
     [33m[2m✓[22m[39m class CloudStorageAdapter extends LocalStorageAdapter {
} migrates on load and preserves extras and peers on save/delete [33m 307[2mms[22m[39m
 [32m✓[39m src/lib/storage/registration.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 58[2mms[22m[39m
 [32m✓[39m src/lib/storage/ownership.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 19[2mms[22m[39m
 [32m✓[39m src/lib/storage/platform-failure.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 106[2mms[22m[39m
 [32m✓[39m src/test/quotes.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 9[2mms[22m[39m
[90mstdout[2m | src/test/i18n-hardcoded.test.ts[2m > [22m[2mi18n hardcoded copy — compiler API inventory[2m > [22m[2mwalks all component/page TSX files and excludes comments by construction
[22m[39mAST scanned 28 TSX files; 0 findings (comments excluded, empty alt allowed, placeholder unchecked).

 [32m✓[39m src/test/i18n-hardcoded.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 9[2mms[22m[39m
 [32m✓[39m src/ui/SurfaceBoundary.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[32m 215[2mms[22m[39m
 [32m✓[39m src/test/runScene.test.tsx [2m([22m[2m23 tests[22m[2m)[22m[33m 12595[2mms[22m[39m
     [33m[2m✓[22m[39m T7: the scene opens after the first successful Run and not again in the same session [33m 3956[2mms[22m[39m
     [33m[2m✓[22m[39m T7: a fresh component tree (as a reload) re-arms the scene [33m 3240[2mms[22m[39m
     [33m[2m✓[22m[39m T6: a full Run → choose → Close cycle writes nothing scene-related [33m 1608[2mms[22m[39m
     [33m[2m✓[22m[39m restores focus to the Run control after Skip and Escape (AC-A21) [33m 3165[2mms[22m[39m

[31m⎯⎯⎯⎯⎯⎯[39m[1m[41m Failed Tests 13 [49m[22m[31m⎯⎯⎯⎯⎯⎯⎯[39m

[41m[1m FAIL [22m[49m src/test/i18n-structure.test.ts[2m > [22mi18n retained component structure and approved copy[2m > [22mone module CARDS retains all eight records, order and Chinese card strings; sentinels stay empty keys
[31m[1mAssertionError[22m: expected 'import { useState, useRef } from \'re…' to contain 'CARDS.slice(startIndex, endIndex)'[39m

[32m- Expected[39m
[31m+ Received[39m

[32m- CARDS.slice(startIndex, endIndex)[39m
[31m+ import { useState, useRef } from 'react';[39m
[31m+ import { useNavigate } from 'react-router-dom';[39m
[31m+ import { Layout } from '../../ui/Layout';[39m
[31m+ import { useAccountSnapshot, updatePlugin } from '../../storage';[39m
[31m+ import { readIdentityCache } from '../../lib/storage/preferences';[39m
[31m+ import { logout } from '../../auth';[39m
[31m+ import { i18n, useT } from '../../lib/i18n';[39m
[31m+ import './GamesHub.css';[39m
[31m+[39m
[31m+ // 卡牌数据结构[39m
[31m+ type Card = {[39m
[31m+   id: string;[39m
[31m+   number: string;[39m
[31m+   nameKey: string;[39m
[31m+   descKey: string;[39m
[31m+   rarity: 'common' | 'uncommon' | 'rare' | 'legendary';[39m
[31m+   owned: boolean;[39m
[31m+   count: number;[39m
[31m+ };[39m
[31m+[39m
[31m+ // 8张占位卡片数据，带有编号[39m
[31m+ const CARDS: Card[] = [[39m
[31m+   {[39m
[31m+     id: 'card-1',[39m
[31m+     number: '#001',[39m
[31m+     nameKey: 'games.card_1_name',[39m
[31m+     descKey: 'games.card_1_desc',[39m
[31m+     rarity: 'common',[39m
[31m+     owned: true,[39m
[31m+     count: 3[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-2',[39m
[31m+     number: '#002',[39m
[31m+     nameKey: 'games.card_2_name',[39m
[31m+     descKey: 'games.card_2_desc',[39m
[31m+     rarity: 'common',[39m
[31m+     owned: true,[39m
[31m+     count: 5[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-3',[39m
[31m+     number: '#003',[39m
[31m+     nameKey: 'games.card_3_name',[39m
[31m+     descKey: 'games.card_3_desc',[39m
[31m+     rarity: 'uncommon',[39m
[31m+     owned: true,[39m
[31m+     count: 2[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-4',[39m
[31m+     number: '#004',[39m
[31m+     nameKey: 'games.card_4_name',[39m
[31m+     descKey: 'games.card_4_desc',[39m
[31m+     rarity: 'uncommon',[39m
[31m+     owned: false,[39m
[31m+     count: 0[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-5',[39m
[31m+     number: '#005',[39m
[31m+     nameKey: 'games.card_5_name',[39m
[31m+     descKey: 'games.card_5_desc',[39m
[31m+     rarity: 'rare',[39m
[31m+     owned: true,[39m
[31m+     count: 1[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-6',[39m
[31m+     number: '#006',[39m
[31m+     nameKey: 'games.card_6_name',[39m
[31m+     descKey: 'games.card_6_desc',[39m
[31m+     rarity: 'rare',[39m
[31m+     owned: false,[39m
[31m+     count: 0[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-7',[39m
[31m+     number: '#007',[39m
[31m+     nameKey: 'games.card_7_name',[39m
[31m+     descKey: 'games.card_7_desc',[39m
[31m+     rarity: 'legendary',[39m
[31m+     owned: false,[39m
[31m+     count: 0[39m
[31m+   },[39m
[31m+   {[39m
[31m+     id: 'card-8',[39m
[31m+     number: '#008',[39m
[31m+     nameKey: 'games.card_8_name',[39m
[31m+     descKey: 'games.card_8_desc',[39m
[31m+     rarity: 'legendary',[39m
[31m+     owned: false,[39m
[31m+     count: 0[39m
[31m+   }[39m
[31m+ ];[39m
[31m+[39m
[31m+ export const GamesHub = () => {[39m
[31m+   useT();[39m
[31m+   const navigate = useNavigate();[39m
[31m+   const username = readIdentityCache('username') || '';[39m
[31m+   const userData = useAccountSnapshot(username);[39m
[31m+   const forkInTheRoadEnabled = userData?.settings?.games?.forkInTheRoadEnabled ?? false;[39m
[31m+   const cardDropEnabled = userData?.settings?.games?.cardDropEnabled ?? false;[39m
[31m+   const saving = useRef(false);[39m
[31m+   const [error, setError] = useState('');[39m
[31m+   const [showCardAlbum, setShowCardAlbum] = useState(false);[39m
[31m+   const [currentPage, setCurrentPage] = useState(0);[39m
[31m+   const cardsPerPage = 6;[39m
[31m+   [39m
[31m+   // 卡片数据已按顺序排列，可直接通过索引访问[39m
[31m+   [39m
[31m+   const handleLogout = () => {[39m
[31m+     logout();[39m
[31m+     navigate('/');[39m
[31m+     window.location.reload();[39m
[31m+   };[39m
[31m+   [39m
[31m+   const saveGameSetting = async (patch: { forkInTheRoadEnabled?: boolean; cardDropEnabled?: boolean }) => {[39m
[31m+     if (!userData || saving.current) return;[39m
[31m+     saving.current = true;[39m
[31m+     setError('');[39m
[31m+     try {[39m
[31m+       await updatePlugin(userData.accountId, { settings: patch });[39m
[31m+     } catch (reason) {[39m
[31m+       setError(reason instanceof Error ? reason.message : String(reason));[39m
[31m+     } finally {[39m
[31m+       saving.current = false;[39m
[31m+     }[39m
[31m+   };[39m
[31m+[39m
[31m+   const handleForkInTheRoadToggle = () => saveGameSetting({ forkInTheRoadEnabled: !forkInTheRoadEnabled });[39m
[31m+   const handleCardDropToggle = () => saveGameSetting({ cardDropEnabled: !cardDropEnabled });[39m
[31m+[39m
[31m+   // Toggle slot machine enabled state[39m
[31m+   const handleSlotMachineToggle = () => {[39m
[31m+     // Slot machine is coming soon, so this is just a placeholder[39m
[31m+     return;[39m
[31m+   };[39m
[31m+   [39m
[31m+   // Toggle achievements enabled state[39m
[31m+   const handleAchievementsToggle = () => {[39m
[31m+     // Achievements is coming soon, so this is just a placeholder[39m
[31m+     return;[39m
[31m+   };[39m
[31m+   [39m
[31m+   // Toggle daily challenges enabled state[39m
[31m+   const handleDailyChallengesToggle = () => {[39m
[31m+     // Daily challenges is coming soon, so this is just a placeholder[39m
[31m+     return;[39m
[31m+   };[39m
[31m+   [39m
[31m+   // 打开集卡册[39m
[31m+   const openCardAlbum = () => {[39m
[31m+     setShowCardAlbum(true);[39m
[31m+     setCurrentPage(0);[39m
[31m+   };[39m
[31m+   [39m
[31m+   // 关闭集卡册[39m
[31m+   const closeCardAlbum = () => {[39m
[31m+     setShowCardAlbum(false);[39m
[31m+   };[39m
[31m+   [39m
[31m+   // 下一页[39m
[31m+   const nextPage = () => {[39m
[31m+     setCurrentPage((prev) => {[39m
[31m+       const totalPages = Math.ceil(CARDS.length / cardsPerPage);[39m
[31m+       return (prev + 1) % totalPages;[39m
[31m+     });[39m
[31m+   };[39m
[31m+   [39m
[31m+   // 上一页[39m
[31m+   const prevPage = () => {[39m
[31m+     setCurrentPage((prev) => {[39m
[31m+       const totalPages = Math.ceil(CARDS.length / cardsPerPage);[39m
[31m+       return (prev - 1 + totalPages) % totalPages;[39m
[31m+     });[39m
[31m+   };[39m
[31m+   [39m
[31m+   // Album pages derive from the stable, history-free plugin snapshot.[39m
[31m+   const startIndex = currentPage * cardsPerPage;[39m
[31m+   const currentPageCards: Card[] = CARDS.slice(startIndex, startIndex + cardsPerPage).map(card => {[39m
[31m+     const count = userData?.cardCollections?.[card.number] || 0;[39m
[31m+     return { ...card, count, owned: count > 0 };[39m
[31m+   });[39m
[31m+   while (currentPageCards.length < cardsPerPage) {[39m
[31m+     currentPageCards.push({[39m
[31m+       id: `empty-${currentPageCards.length + startIndex}`, number: '', nameKey: '', descKey: '',[39m
[31m+       rarity: 'common', owned: false, count: 0,[39m
[31m+     });[39m
[31m+   }[39m
[31m+   const rarityLabels = {[39m
[31m+     common: i18n.t('games.rarity_common'),[39m
[31m+     uncommon: i18n.t('games.rarity_uncommon'),[39m
[31m+     rare: i18n.t('games.rarity_rare'),[39m
[31m+     legendary: i18n.t('games.rarity_legendary'),[39m
[31m+   };[39m
[31m+   return ([39m
[31m+     <Layout username={username} onLogout={handleLogout}>[39m
[31m+       <div className="games-hub">[39m
[31m+       <div className="games-container">[39m
[31m+         <h1 className="games-title">{i18n.t('games.hub_title')}</h1>[39m
[31m+         {error && <p role="alert">{error}</p>}[39m
[31m+         <p className="games-subtitle">[39m
[31m+           {i18n.t('games.hub_subtitle')}[39m
[31m+         </p>[39m
[31m+[39m
[31m+         <div className="games-grid">[39m
[31m+           <div className="game-card" style={{ position: 'relative', cursor: 'default' }}>[39m
[31m+             {/* Enable checkbox in top-right corner */}[39m
[31m+             <div role="switch" tabIndex={0} aria-label={i18n.t('games.card_drop')} aria-checked={cardDropEnabled} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); void handleCardDropToggle(); } }} style={{[39m
[31m+               position: 'absolute',[39m
[31m+               top: '1rem',[39m
[31m+               right: '1rem',[39m
[31m+               zIndex: 10,[39m
[31m+               cursor: 'pointer',[39m
[31m+               display: 'flex',[39m
[31m+               alignItems: 'center',[39m
[31m+               justifyContent: 'center',[39m
[31m+               width: '30px',[39m
[31m+               height: '30px',[39m
[31m+               borderRadius: '50%',[39m
[31m+               background: cardDropEnabled ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#e0e0e0',[39m
[31m+               transition: 'all 0.3s ease',[39m
[31m+               boxShadow: 'var(--shadow-sm)',[39m
[31m+               opacity: 1[39m
[31m+             }} onClick={() => {[39m
[31m+               handleCardDropToggle();[39m
[31m+             }}>[39m
[31m+               {cardDropEnabled && ([39m
[31m+                 <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">[39m
[31m+                   <polyline points="20 6 9 17 4 12" />[39m
[31m+                 </svg>[39m
[31m+               )}[39m
[31m+             </div>[39m
[31m+             <div className="game-icon">🃏</div>[39m
[31m+             <h3 className="game-name">{i18n.t('games.card_drop')}</h3>[39m
[31m+             <p className="game-description">[39m
[31m+               {i18n.t('games.card_drop_description')}[39m
[31m+             </p>[39m
[31m+             <button style={{[39m
[31m+               padding: '0.5rem 1rem',[39m
[31m+               background: cardDropEnabled ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#e0e0e0',[39m
[31m+               border: 'none',[39m
[31m+               borderRadius: '20px',[39m
[31m+               cursor: cardDropEnabled ? 'pointer' : 'not-allowed',[39m
[31m+               fontWeight: '600',[39m
[31m+               color: cardDropEnabled ? 'white' : 'var(--text-tertiary)',[39m
[31m+               fontSize: '0.85rem',[39m
[31m+               margin: '0.5rem',[39m
[31m+               opacity: cardDropEnabled ? 1 : 0.7,[39m
[31m+               transition: 'all 0.3s ease'[39m
[31m+             }} onClick={() => {[39m
[31m+               if (cardDropEnabled) {[39m
[31m+                 openCardAlbum();[39m
[31m+               }[39m
[31m+             }}>[39m
[31m+               {i18n.t('games.card_album')}[39m
[31m+             </button>[39m
[31m+           </div>[39m
[31m+[39m
[31m+           <div className="game-card" style={{ position: 'relative' }}>[39m
[31m+             {/* Enable checkbox in top-right corner */}[39m
[31m+             <div role="switch" tabIndex={0} aria-label={i18n.t('games.fork_in_the_road')} aria-checked={forkInTheRoadEnabled} onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); void handleForkInTheRoadToggle(); } }} style={{[39m
[31m+               position: 'absolute',[39m
[31m+               top: '1rem',[39m
[31m+               right: '1rem',[39m
[31m+               zIndex: 10,[39m
[31m+               cursor: 'pointer',[39m
[31m+               display: 'flex',[39m
[31m+               alignItems: 'center',[39m
[31m+               justifyContent: 'center',[39m
[31m+               width: '30px',[39m
[31m+               height: '30px',[39m
[31m+               borderRadius: '50%',[39m
[31m+               background: forkInTheRoadEnabled ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : '#e0e0e0',[39m
[31m+               transition: 'all 0.3s ease',[39m
[31m+               boxShadow: 'var(--shadow-sm)'[39m
[31m+             }} onClick={() => handleForkInTheRoadToggle()}>[39m
[31m+               {forkInTheRoadEnabled && ([39m
[31m+                 <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">[39m
[31m+                   <polyline points="20 6 9 17 4 12" />[39m
[31m+                 </svg>[39m
[31m+               )}[39m
[31m+             </div>[39m
[31m+             <div className="game-icon">➡️</div>[39m
[31m+             <h3 className="game-name">{i18n.t('games.fork_in_the_road')}</h3>[39m
[31m+             <p className="game-description">[39m
[31m+               {i18n.t('games.fork_in_the_road_description')}[39m
[31m+             </p>[39m
[31m+           </div>[39m
[31m+[39m
[31m+           <div className="game-card disabled" style={{ position: 'relative' }}>[39m
[31m+             {/* Enable checkbox placeholder - coming soon */}[39m
[31m+             <div style={{[39m
[31m+               position: 'absolute',[39m
[31m+               top: '1rem',[39m
[31m+               right: '1rem',[39m
[31m+               zIndex: 10,[39m
[31m+               cursor: 'not-allowed',[39m
[31m+               display: 'flex',[39m
[31m+               alignItems: 'center',[39m
[31m+               justifyContent: 'center',[39m
[31m+               width: '30px',[39m
[31m+               height: '30px',[39m
[31m+               borderRadius: '50%',[39m
[31m+               background: '#e0e0e0',[39m
[31m+               transition: 'all 0.3s ease',[39m
[31m+               boxShadow: 'var(--shadow-sm)',[39m
[31m+               opacity: 0.6[39m
[31m+             }} onClick={handleSlotMachineToggle}>[39m
[31m+               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">[39m
[31m+                 <polyline points="20 6 9 17 4 12" />[39m
[31m+               </svg>[39m
[31m+             </div>[39m
[31m+             <div className="game-icon">🎰</div>[39m
[31m+             <h3 className="game-name">{i18n.t('games.slot_machine')}</h3>[39m
[31m+             <p className="game-description">[39m
[31m+               {i18n.t('games.slot_machine_description')}[39m
[31m+             </p>[39m
[31m+             <span className="game-status">{i18n.t('games.coming_soon')}</span>[39m
[31m+           </div>[39m
[31m+[39m
[31m+           <div className="game-card disabled" style={{ position: 'relative' }}>[39m
[31m+             {/* Enable checkbox placeholder - coming soon */}[39m
[31m+             <div style={{[39m
[31m+               position: 'absolute',[39m
[31m+               top: '1rem',[39m
[31m+               right: '1rem',[39m
[31m+               zIndex: 10,[39m
[31m+               cursor: 'not-allowed',[39m
[31m+               display: 'flex',[39m
[31m+               alignItems: 'center',[39m
[31m+               justifyContent: 'center',[39m
[31m+               width: '30px',[39m
[31m+               height: '30px',[39m
[31m+               borderRadius: '50%',[39m
[31m+               background: '#e0e0e0',[39m
[31m+               transition: 'all 0.3s ease',[39m
[31m+               boxShadow: 'var(--shadow-sm)',[39m
[31m+               opacity: 0.6[39m
[31m+             }} onClick={handleAchievementsToggle}>[39m
[31m+               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">[39m
[31m+                 <polyline points="20 6 9 17 4 12" />[39m
[31m+               </svg>[39m
[31m+             </div>[39m
[31m+             <div className="game-icon">🏆</div>[39m
[31m+             <h3 className="game-name">{i18n.t('games.achievements')}</h3>[39m
[31m+             <p className="game-description">[39m
[31m+               {i18n.t('games.achievements_description')}[39m
[31m+             </p>[39m
[31m+             <span className="game-status">{i18n.t('games.coming_soon')}</span>[39m
[31m+           </div>[39m
[31m+[39m
[31m+           <div className="game-card disabled" style={{ position: 'relative' }}>[39m
[31m+             {/* Enable checkbox placeholder - coming soon */}[39m
[31m+             <div style={{[39m
[31m+               position: 'absolute',[39m
[31m+               top: '1rem',[39m
[31m+               right: '1rem',[39m
[31m+               zIndex: 10,[39m
[31m+               cursor: 'not-allowed',[39m
[31m+               display: 'flex',[39m
[31m+               alignItems: 'center',[39m
[31m+               justifyContent: 'center',[39m
[31m+               width: '30px',[39m
[31m+               height: '30px',[39m
[31m+               borderRadius: '50%',[39m
[31m+               background: '#e0e0e0',[39m
[31m+               transition: 'all 0.3s ease',[39m
[31m+               boxShadow: 'var(--shadow-sm)',[39m
[31m+               opacity: 0.6[39m
[31m+             }} onClick={handleDailyChallengesToggle}>[39m
[31m+               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">[39m
[31m+                 <polyline points="20 6 9 17 4 12" />[39m
[31m+               </svg>[39m
[31m+             </div>[39m
[31m+             <div className="game-icon">⚡</div>[39m
[31m+             <h3 className="game-name">{i18n.t('games.daily_challenges')}</h3>[39m
[31m+             <p className="game-description">[39m
[31m+               {i18n.t('games.daily_challenges_description')}[39m
[31m+             </p>[39m
[31m+             <span className="game-status">{i18n.t('games.coming_soon')}</span>[39m
[31m+           </div>[39m
[31m+         </div>[39m
[31m+[39m
[31m+         {/* 集卡册模态框 */}[39m
[31m+         {showCardAlbum && ([39m
[31m+           <div style={{[39m
[31m+             position: 'fixed',[39m
[31m+             top: 0,[39m
[31m+             left: 0,[39m
[31m+             right: 0,[39m
[31m+             bottom: 0,[39m
[31m+             background: 'rgba(0, 0, 0, 0.7)',[39m
[31m+             display: 'flex',[39m
[31m+             alignItems: 'center',[39m
[31m+             justifyContent: 'center',[39m
[31m+             zIndex: 1000,[39m
[31m+             backdropFilter: 'blur(5px)'[39m
[31m+           }}>[39m
[31m+             <div style={{[39m
[31m+               background: 'var(--bg-primary)',[39m
[31m+               borderRadius: '20px',[39m
[31m+               padding: '2rem',[39m
[31m+               maxWidth: '900px',[39m
[31m+               width: '95%',[39m
[31m+               maxHeight: '90vh',[39m
[31m+               overflowY: 'auto',[39m
[31m+               boxShadow: 'var(--shadow-lg)',[39m
[31m+               textAlign: 'center',[39m
[31m+               position: 'relative'[39m
[31m+             }}>[39m
[31m+               {/* 关闭按钮 */}[39m
[31m+               <button style={{[39m
[31m+                 position: 'absolute',[39m
[31m+                 top: '1rem',[39m
[31m+                 right: '1rem',[39m
[31m+                 background: 'none',[39m
[31m+                 border: 'none',[39m
[31m+                 fontSize: '1.5rem',[39m
[31m+                 cursor: 'pointer',[39m
[31m+                 color: 'var(--text-secondary)'[39m
[31m+               }} onClick={closeCardAlbum}>[39m
[31m+                 ✕[39m
[31m+               </button>[39m
[31m+               [39m
[31m+               {/* 集卡册标题 */}[39m
[31m+               <h2 style={{[39m
[31m+                 fontSize: '2rem',[39m
[31m+                 marginBottom: '1.5rem',[39m
[31m+                 color: 'var(--text-primary)'[39m
[31m+               }}>[39m
[31m+                 {i18n.t('games.card_album')}[39m
[31m+               </h2>[39m
[31m+               [39m
[31m+               {/* 分页信息 */}[39m
[31m+               <div style={{[39m
[31m+                 marginBottom: '1.5rem',[39m
[31m+                 fontSize: '0.9rem',[39m
[31m+                 color: 'var(--text-secondary)'[39m
[31m+               }}>[39m
[31m+                 {i18n.t('games.album_page_info', { current: currentPage + 1, total: Math.ceil(CARDS.length / cardsPerPage) })}[39m
[31m+               </div>[39m
[31m+               [39m
[31m+               {/* 卡片网格展示区域 */}[39m
[31m+               <div style={{[39m
[31m+                 display: 'grid',[39m
[31m+                 gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',[39m
[31m+                 gap: '1.5rem',[39m
[31m+                 margin: '1rem 0',[39m
[31m+                 justifyContent: 'center'[39m
[31m+               }}>[39m
[31m+                 {currentPageCards.map((card) => {[39m
[31m+                   // 检查是否为空白卡片[39m
[31m+                   const isEmptyCard = !card.nameKey;[39m
[31m+                   [39m
[31m+                   if (isEmptyCard) {[39m
[31m+                     // 空白卡片只显示空白格子，保持布局一致性[39m
[31m+                     return ([39m
[31m+                       <div key={card.id} style={{[39m
[31m+                         background: 'rgba(255, 255, 255, 0.2)',[39m
[31m+                         borderRadius: '15px',[39m
[31m+                         padding: '1.5rem',[39m
[31m+                         minHeight: '250px',[39m
[31m+                         display: 'flex',[39m
[31m+                         flexDirection: 'column',[39m
[31m+                         alignItems: 'center',[39m
[31m+                         justifyContent: 'center',[39m
[31m+                         opacity: 0.5,[39m
[31m+                         transition: 'all 0.3s ease'[39m
[31m+                       }} />[39m
[31m+                     );[39m
[31m+                   }[39m
[31m+                   [39m
[31m+                   // 正常卡片的渲染[39m
[31m+                   return ([39m
[31m+                     <div key={card.id} style={{[39m
[31m+                       background: card.owned ? 'white' : 'rgba(255, 255, 255, 0.7)',[39m
[31m+                       border: `2px solid ${card.owned ? '#4caf50' : '#e0e0e0'}`,[39m
[31m+                       borderRadius: '15px',[39m
[31m+                       padding: '1.5rem',[39m
[31m+                       minHeight: '250px',[39m
[31m+                       display: 'flex',[39m
[31m+                       flexDirection: 'column',[39m
[31m+                       alignItems: 'center',[39m
[31m+                       justifyContent: 'center',[39m
[31m+                       opacity: card.owned ? 1 : 0.7,[39m
[31m+                       transition: 'all 0.3s ease',[39m
[31m+                       position: 'relative'[39m
[31m+                     }}>[39m
[31m+                       {/* 卡片编号，显示在左上角 */}[39m
[31m+                       <div style={{[39m
[31m+                         position: 'absolute',[39m
[31m+                         top: '0.8rem',[39m
[31m+                         left: '0.8rem',[39m
[31m+                         fontSize: '0.7rem',[39m
[31m+                         fontWeight: '600',[39m
[31m+                         color: 'var(--text-tertiary)',[39m
[31m+                         background: 'var(--bg-secondary)',[39m
[31m+                         padding: '0.2rem 0.5rem',[39m
[31m+                         borderRadius: '8px'[39m
[31m+                       }}>[39m
[31m+                         {card.number}[39m
[31m+                       </div>[39m
[31m+                       [39m
[31m+                       <h3 style={{[39m
[31m+                         fontSize: '1.4rem',[39m
[31m+                         marginBottom: '0.8rem',[39m
[31m+                         color: card.owned ? 'var(--text-primary)' : '#9e9e9e'[39m
[31m+                       }}>[39m
[31m+                         {i18n.t(card.nameKey)}[39m
[31m+                       </h3>[39m
[31m+                       <p style={{[39m
[31m+                         fontSize: '0.9rem',[39m
[31m+                         marginBottom: '0.8rem',[39m
[31m+                         color: card.owned ? 'var(--text-secondary)' : '#9e9e9e',[39m
[31m+                         maxWidth: '90%',[39m
[31m+                         flex: 1[39m
[31m+                       }}>[39m
[31m+                         {i18n.t(card.descKey)}[39m
[31m+                       </p>[39m
[31m+                       <div style={{[39m
[31m+                         fontSize: '0.75rem',[39m
[31m+                         fontWeight: '600',[39m
[31m+                         padding: '0.2rem 0.6rem',[39m
[31m+                         borderRadius: '10px',[39m
[31m+                         marginBottom: '0.5rem',[39m
[31m+                         color: 'white',[39m
[31m+                         background: card.rarity === 'common' ? '#4caf50' :[39m
[31m+                                    card.rarity === 'uncommon' ? '#2196f3' :[39m
[31m+                                    card.rarity === 'rare' ? '#9c27b0' : '#ff9800'[39m
[31m+                       }}>[39m
[31m+                         {rarityLabels[card.rarity]}[39m
[31m+                       </div>[39m
[31m+                       {card.owned && ([39m
[31m+                         <div style={{[39m
[31m+                           fontSize: '0.85rem',[39m
[31m+                           fontWeight: '600',[39m
[31m+                           color: '#4caf50',[39m
[31m+                           marginTop: '0.5rem'[39m
[31m+                         }}>[39m
[31m+                           {i18n.t('games.album_owned_count', { count: card.count })}[39m
[31m+                         </div>[39m
[31m+                       )}[39m
[31m+                     </div>[39m
[31m+                   );[39m
[31m+                 })}[39m
[31m+               </div>[39m
[31m+               [39m
[31m+               {/* 分页导航按钮 */}[39m
[31m+               <div style={{[39m
[31m+                 display: 'flex',[39m
[31m+                 justifyContent: 'space-between',[39m
[31m+                 alignItems: 'center',[39m
[31m+                 marginTop: '2rem'[39m
[31m+               }}>[39m
[31m+                 <button onClick={prevPage} style={{[39m
[31m+                   padding: '0.75rem 1.5rem',[39m
[31m+                   background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',[39m
[31m+                   border: 'none',[39m
[31m+                   borderRadius: '50px',[39m
[31m+                   cursor: 'pointer',[39m
[31m+                   fontWeight: '600',[39m
[31m+                   color: 'white',[39m
[31m+                   fontSize: '1rem'[39m
[31m+                 }}>[39m
[31m+                   {i18n.t('games.album_prev')}[39m
[31m+                 </button>[39m
[31m+                 [39m
[31m+                 <button onClick={nextPage} style={{[39m
[31m+                   padding: '0.75rem 1.5rem',[39m
[31m+                   background: 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)',[39m
[31m+                   border: 'none',[39m
[31m+                   borderRadius: '50px',[39m
[31m+                   cursor: 'pointer',[39m
[31m+                   fontWeight: '600',[39m
[31m+                   color: 'white',[39m
[31m+                   fontSize: '1rem'[39m
[31m+                 }}>[39m
[31m+                   {i18n.t('games.album_next')}[39m
[31m+                 </button>[39m
[31m+               </div>[39m
[31m+             </div>[39m
[31m+           </div>[39m
[31m+         )}[39m
[31m+       </div>[39m
[31m+     </div>[39m
[31m+     </Layout>[39m
[31m+   );[39m
[31m+ };[39m
[31m+[39m

[36m [2m❯[22m src/test/i18n-structure.test.ts:[2m46:18[22m[39m
    [90m 44| [39m    [35mconst[39m text [33m=[39m source[33m.[39mtext[33m;[39m
    [90m 45| [39m    [34mexpect[39m(text)[33m.[39m[34mtoContain[39m([32m'const cardsPerPage = 6;'[39m)[33m;[39m
    [90m 46| [39m    [34mexpect[39m(text)[33m.[39m[34mtoContain[39m([32m'CARDS.slice(startIndex, endIndex)'[39m)[33m;[39m
    [90m   | [39m                 [31m^[39m
    [90m 47| [39m    [34mexpect[39m(text)[33m.[39m[34mtoContain[39m([32m'CARDS.forEach'[39m)[33m;[39m
    [90m 48| [39m    [34mexpect[39m(text)[33m.[39m[34mtoContain[39m([32m'const isEmptyCard = !card.nameKey;'[39m)[33m;[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/test/settings-data.test.tsx[2m > [22msettings data-management invariants[2m > [22mnever writes on file selection or cancel; replace requires explicit destructive confirmation
[41m[1m FAIL [22m[49m src/test/settings-data.test.tsx[2m > [22msettings data-management invariants[2m > [22mmerge deduplicates existing and incoming ids without changing identity or other user data
[41m[1m FAIL [22m[49m src/test/settings-data.test.tsx[2m > [22msettings data-management invariants[2m > [22mcancel preserves bytes and language switching keeps the open import without losing hits
[31m[1mAssertionError[22m[39m: expected "bound " to not be called at all, but actually been called 1 times[90m

Received: 

[1m  1st bound  call:

[22m    Array [
      "❌ Import failed: Archive import is deferred to the import/recovery implementation increment.",
    ]
[39m[90m

Number of calls: [1m1[22m
[39m

Ignored nodes: comments, script, style
[36m<html>[39m
  [36m<head />[39m
  [36m<body>[39m
    [36m<div>[39m
      [36m<nav[39m
        [33mclass[39m=[32m"pro-navigation"[39m
      [36m>[39m
        [36m<div[39m
          [33mclass[39m=[32m"nav-container"[39m
        [36m>[39m
          [36m<div[39m
            [33mclass[39m=[32m"nav-brand"[39m
          [36m>[39m
            [36m<span[39m
              [33mclass[39m=[32m"nav-logo"[39m
            [36m>[39m
              [0m🏃[0m
            [36m</span>[39m
            [36m<span[39m
              [33mclass[39m=[32m"nav-title"[39m
            [36m>[39m
              [0mThe Runaway Simulator[0m
            [36m</span>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"nav-links"[39m
          [36m>[39m
            [36m<a[39m
              [33maria-current[39m=[32m"page"[39m
              [33mclass[39m=[32m"nav-link active"[39m
              [33mdata-discover[39m=[32m"true"[39m
              [33mhref[39m=[32m"/"[39m
            [36m>[39m
              [0mHome[0m
            [36m</a>[39m
            [36m<a[39m
              [33mclass[39m=[32m"nav-link "[39m
              [33mdata-discover[39m=[32m"true"[39m
              [33mhref[39m=[32m"/games"[39m
            [36m>[39m
              [0mGames[0m
            [36m</a>[39m
            [36m<a[39m
              [33mclass[39m=[32m"nav-link "[39m
              [33mdata-discover[39m=[32m"true"[39m
              [33mhref[39m=[32m"/settings"[39m
            [36m>[39m
              [0mSettings[0m
            [36m</a>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"nav-actions"[39m
          [36m>[39m
            [36m<div[39m
              [33mclass[39m=[32m"user-menu-container"[39m
            [36m>[39m
              [36m<button[39m
                [33maria-expanded[39m=[32m"false"[39m
                [33maria-haspopup[39m=[32m"true"[39m
                [33mclass[39m=[32m"nav-user"[39m
              [36m>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"nav-user-icon"[39m
                [36m>[39m
                  [0m👤[0m
                [36m</span>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"nav-username"[39m
                [36m>[39m
                  [0mcurrent[0m
                [36m</span>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"nav-user-menu-icon"[39m
                [36m>[39m
                  [0m☰[0m
                [36m</span>[39m
              [36m</button>[39m
            [36m</div>[39m
          [36m</div>[39m
        [36m</div>[39m
      [36m</nav>[39m
      [36m<div[39m
        [33mclass[39m=[32m"settings-page"[39m
      [36m>[39m
        [36m<div[39m
          [33mclass[39m=[32m"settings-container"[39m
        [36m>[39m
          [36m<h1[39m
            [33mclass[39m=[32m"settings-title"[39m
          [36m>[39m
            [0m⚙️ Settings[0m
          [36m</h1>[39m
          [36m<div[39m
            [33mclass[39m=[32m"settings-grid"[39m
          [36m>[39m
            [36m<div[39m
              [33mclass[39m=[32m"settings-card"[39m
            [36m>[39m
              [36m<h2[39m
                [33mclass[39m=[32m"settings-card-title"[39m
              [36m>[39m
                [0m🎨 Appearance Settings[0m
              [36m</h2>[39m
              [36m<div[39m
                [33mclass[39m=[32m"setting-item"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"setting-label"[39m
                [36m>[39m
                  [0m🌓 Dark Mode[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"dark-mode-toggle-container"[39m
                [36m>[39m
                  [36m<label[39m
                    [33mclass[39m=[32m"dark-mode-toggle-label"[39m
                  [36m>[39m
                    [36m<input[39m
                      [33maria-label[39m=[32m"🌓 Dark Mode"[39m
                      [33mclass[39m=[32m"dark-mode-toggle-checkbox"[39m
                      [33mtype[39m=[32m"checkbox"[39m
                    [36m/>[39m
                    [36m<span[39m
                      [33mclass[39m=[32m"dark-mode-toggle-slider"[39m
                    [36m/>[39m
                  [36m</label>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"dark-mode-text"[39m
                  [36m>[39m
                    [0mLight[0m
                  [36m</span>[39m
                [36m</div>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"setting-item"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"setting-label"[39m
                [36m>[39m
                  [0m🎨 Theme[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"theme-grid"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"theme-option active"[39m
                    [33mstyle[39m=[32m"background: linear-gradient(135deg, rgb(123, 201, 111) 0%, rgb(25, 97, 39) 100%);"[39m
                    [33mtitle[39m=[32m"GitHub Green"[39m
                  [36m/>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"theme-option "[39m
                    [33mstyle[39m=[32m"background: linear-gradient(135deg, rgb(77, 184, 232) 0%, rgb(13, 90, 143) 100%);"[39m
                    [33mtitle[39m=[32m"Ocean Blue"[39m
                  [36m/>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"theme-option "[39m
                    [33mstyle[39m=[32m"background: linear-gradient(135deg, rgb(255, 169, 77) 0%, rgb(204, 102, 0) 100%);"[39m
                    [33mtitle[39m=[32m"Sunset Orange"[39m
                  [36m/>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"theme-option "[39m
                    [33mstyle[39m=[32m"background: linear-gradient(135deg, rgb(171, 71, 188) 0%, rgb(106, 27, 154) 100%);"[39m
                    [33mtitle[39m=[32m"Purple Dream"[39m
                  [36m/>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"theme-option "[39m
                    [33mstyle[39m=[32m"background: linear-gradient(135deg, rgb(239, 83, 80) 0%, rgb(198, 40, 40) 100%);"[39m
                    [33mtitle[39m=[32m"Fire Red"[39m
                  [36m/>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"theme-option "[39m
                    [33mstyle[39m=[32m"background: linear-gradient(135deg, rgb(158, 158, 158) 0%, rgb(33, 33, 33) 100%);"[39m
                    [33mtitle[39m=[32m"Monochrome Gray"[39m
                  [36m/>[39m
                [36m</div>[39m
              [36m</div>[39m
            [36m</div>[39m
            [36m<div[39m
              [33mclass[39m=[32m"settings-card"[39m
            [36m>[39m
              [36m<h2[39m
                [33mclass[39m=[32m"settings-card-title"[39m
              [36m>[39m
                [0m🌍 Regional Settings[0m
              [36m</h2>[39m
              [36m<div[39m
                [33mclass[39m=[32m"setting-item"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"setting-label"[39m
                [36m>[39m
                  [0m🌍 Timezone[0m
                [36m</div>[39m
                [36m<select[39m
                  [33maria-label[39m=[32m"🌍 Timezone"[39m
                  [33mclass[39m=[32m"settings-select"[39m
                [36m>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"UTC"[39m
                  [36m>[39m
                    [0mUTC (UTC+0)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/New_York"[39m
                  [36m>[39m
                    [0mAmerica/New York (UTC-5)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Chicago"[39m
                  [36m>[39m
                    [0mAmerica/Chicago (UTC-6)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Denver"[39m
                  [36m>[39m
                    [0mAmerica/Denver (UTC-7)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Los_Angeles"[39m
                  [36m>[39m
                    [0mAmerica/Los Angeles (UTC-8)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Anchorage"[39m
                  [36m>[39m
                    [0mAmerica/Anchorage (UTC-9)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Pacific/Honolulu"[39m
                  [36m>[39m
                    [0mPacific/Honolulu (UTC-10)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Toronto"[39m
                  [36m>[39m
                    [0mAmerica/Toronto (UTC-5)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Mexico_City"[39m
                  [36m>[39m
                    [0mAmerica/Mexico City (UTC-6)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"America/Sao_Paulo"[39m
                  [36m>[39m
                    [0mAmerica/Sao Paulo (UTC-3)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Europe/London"[39m
                  [36m>[39m
                    [0mEurope/London (UTC+0)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Europe/Paris"[39m
                  [36m>[39m
                    [0mEurope/Paris (UTC+1)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Europe/Berlin"[39m
                  [36m>[39m
                    [0mEurope/Berlin (UTC+1)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Europe/Rome"[39m
                  [36m>[39m
                    [0mEurope/Rome (UTC+1)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Europe/Madrid"[39m
                  [36m>[39m
                    [0mEurope/Madrid (UTC+1)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Europe/Moscow"[39m
                  [36m>[39m
                    [0mEurope/Moscow (UTC+3)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Africa/Cairo"[39m
                  [36m>[39m
                    [0mAfrica/Cairo (UTC+2)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Africa/Johannesburg"[39m
                  [36m>[39m
                    [0mAfrica/Johannesburg (UTC+2)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Dubai"[39m
                  [36m>[39m
                    [0mAsia/Dubai (UTC+4)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Kolkata"[39m
                  [36m>[39m
                    [0mAsia/Kolkata (UTC+5:30)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Shanghai"[39m
                  [36m>[39m
                    [0mAsia/Shanghai (UTC+8)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Tokyo"[39m
                  [36m>[39m
                    [0mAsia/Tokyo (UTC+9)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Seoul"[39m
                  [36m>[39m
                    [0mAsia/Seoul (UTC+9)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Hong_Kong"[39m
                  [36m>[39m
                    [0mAsia/Hong Kong (UTC+8)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Asia/Singapore"[39m
                  [36m>[39m
                    [0mAsia/Singapore (UTC+8)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Australia/Sydney"[39m
                  [36m>[39m
                    [0mAustralia/Sydney (UTC+11)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Australia/Melbourne"[39m
                  [36m>[39m
                    [0mAustralia/Melbourne (UTC+11)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"Pacific/Auckland"[39m
                  [36m>[39m
                    [0mPacific/Auckland (UTC+13)[0m
                  [36m</option>[39m
                [36m</select>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"setting-item"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"setting-label"[39m
                [36m>[39m
                  [0m🌐 Language[0m
                [36m</div>[39m
                [36m<select[39m
                  [33maria-label[39m=[32m"🌐 Language"[39m
                  [33mclass[39m=[32m"settings-select"[39m
                [36m>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"en_us"[39m
                  [36m>[39m
                    [0mEnglish (US)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"zh_cn"[39m
                  [36m>[39m
                    [0m中文 (简体)[0m
                  [36m</option>[39m
                  [36m<option[39m
                    [33mvalue[39m=[32m"zh_tw"[39m
                  [36m>[39m
                    [0m中文 (繁体)[0m
                  [36m</option>[39m
                [36m</select>[39m
              [36m</div>[39m
            [36m</div>[39m
            [36m<div[39m
              [33mclass[39m=[32m"settings-card"[39m
            [36m>[39m
              [36m<h2[39m
                [33mclass[39m=[32m"settings-card-title"[39m
              [36m>[39m
                [0m💾 Data Management[0m
              [36m</h2>[39m
              [36m<div[39m
                [33mclass[39m=[32m"setting-item"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"setting-label"[39m
                [36m>[39m
                  [0m📤 Import/Export[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"import-export-buttons"[39m
                [36m>[39m
                  [36m<button[39m
                    [33mclass[39m=[32m"settings-button primary"[39m
                  [36m>[39m
                    [0m📤 Export Data[0m
                  [36m</button>[39m
                  [36m<button[39m
                    [33mclass[39m=[32m"settings-button secondary"[39m
                  [36m>[39m
                    [0m📥 Import Data[0m
                  [36m</button>[39m
                  [36m<button[39m
                    [33mclass[39m=[32m"settings-button secondary"[39m
                  [36m>[39m
                    [0m🖨️ Print Calendar[0m
                  [36m</button>[39m
                [36m</div>[39m
                [36m<input[39m
                  [33maccept[39m=[32m".json"[39m
                  [33mstyle[39m=[32m"display: none;"[39m
                  [33mtype[39m=[32m"file"[39m
                [36m/>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"setting-item"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"setting-label"[39m
                [36m>[39m
                  [0m☁️ Storage[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"storage-mode-options"[39m
                [36m>[39m
                  [36m<label[39m
                    [33mclass[39m=[32m"storage-mode-option active"[39m
                  [36m>[39m
                    [36m<input[39m
                      [33mchecked[39m=[32m""[39m
                      [33mclass[39m=[32m"storage-mode-radio"[39m
                      [33mname[39m=[32m"storage-mode"[39m
                      [33mtype[39m=[32m"radio"[39m
                      [33mvalue[39m=[32m"local"[39m
                    [36m/>[39m
                    [36m<div[39m
                      [33mclass[39m=[32m"storage-mode-content"[39m
                    [36m>[39m
                      [36m<div[39m
                        [33mclass[39m=[32m"storage-mode-name"[39m
                      [36m>[39m
                        [0m📁 [0m
                        [0mLocal Storage[0m
                      [36m</div>[39m
                      [36m<div[39m
                        [33mclass[39m=[32m"storage-mode-description"[39m
                      [36m>[39m
                        [0mData stored only on this device, offline available, privacy secure[0m
                      [36m</div>[39m
                    [36m</div>[39m
                  [36m</label>[39m
                  [36m<label[39m
                    [33mclass[39m=[32m"storage-mode-option  storage-mode-option-disabled"[39m
                  [36m>[39m
                    [36m<input[39m
                      [33mclass[39m=[32m"storage-mode-radio"[39m
                      [33mdisabled[39m=[32m""[39m
                      [33mname[39m=[32m"storage-mode"[39m
                      [33mtype[39m=[32m"radio"[39m
                      [33mvalue[39m=[32m"cloud"[39m
                    [36m/>[39m
                    [36m<div[39m
                      [33mclass[39m=[32m"storage-mode-content"[39m
                    [36m>[39m
                      [36m<div[39m
                        [33mclass[39m=[32m"storage-mode-name"[39m
                      [36m>[39m
                        [0m☁️ [0m
                        [0mCloud Storage[0m
                      [36m</div>[39m
                      [36m<div[39m
                        [33mclass[39m=[32m"storage-mode-description"[39m
                      [36m>[39m
                        [0mData synchronized to the cloud, accessible across devices, real-time updates (Coming Soon)[0m
                      [36m</div>[39m
                    [36m</div>[39m
                  [36m</label>[39m
                [36m</div>[39m
              [36m</div>[39m
            [36m</div>[39m
          [36m</div>[39m
        [36m</div>[39m
      [36m</div>[39m
    [36m</div>[39m
  [36m</body>[39m
[36m</html>[39m
[36m [2m❯[22m src/test/settings-data.test.tsx:[2m27:30[22m[39m
    [90m 25| [39m  fireEvent.change(view.container.querySelector('input[type="file"]')!…
    [90m 26| [39m  [35mawait[39m [34mwaitFor[39m(() [33m=>[39m {
    [90m 27| [39m    [34mexpect[39m(window[33m.[39malert)[33m.[39mnot[33m.[39m[34mtoHaveBeenCalled[39m()[33m;[39m
    [90m   | [39m                             [31m^[39m
    [90m 28| [39m    expect(view.getByText(i18n.t('import_dialog.title'))).toBeInTheDoc…
    [90m 29| [39m  })[33m;[39m
[90m [2m❯[22m runWithExpensiveErrorDiagnosticsDisabled node_modules/@testing-library/dom/dist/config.js:[2m47:12[22m[39m
[90m [2m❯[22m checkCallback node_modules/@testing-library/dom/dist/wait-for.js:[2m124:77[22m[39m
[90m [2m❯[22m Timeout.checkRealTimersCallback node_modules/@testing-library/dom/dist/wait-for.js:[2m118:16[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/test/settings-data.test.tsx[2m > [22msettings data-management invariants[2m > [22mround-trips exported timestamps and ids while retaining game settings
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/test/settings-data.test.tsx:[2m72:26[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/test/settings-header-import.test.tsx[2m > [22mheader import obeys confirmation and preserves profile, games, identity, and device preferences
[31m[1mAssertionError[22m[39m: expected "bound " to not be called at all, but actually been called 1 times[90m

Received: 

[1m  1st bound  call:

[22m    Array [
      "❌ Import failed: Archive import is deferred to the import/recovery implementation increment.",
    ]
[39m[90m

Number of calls: [1m1[22m
[39m

Ignored nodes: comments, script, style
[36m<html[39m
  [33mstyle[39m=[32m"--intensity-0: #ebedf0; --intensity-1: #c6e48b; --intensity-2: #7bc96f; --intensity-3: #239a3b; --intensity-4: #196127;"[39m
[36m>[39m
  [36m<head />[39m
  [36m<body>[39m
    [36m<div>[39m
      [36m<div[39m
        [33mclass[39m=[32m"dashboard-container"[39m
      [36m>[39m
        [36m<header[39m
          [33mclass[39m=[32m"dashboard-header"[39m
        [36m>[39m
          [36m<div[39m
            [33mclass[39m=[32m"user-info"[39m
          [36m>[39m
            [36m<span[39m
              [33mclass[39m=[32m"user-icon"[39m
            [36m>[39m
              [0m👤[0m
            [36m</span>[39m
            [36m<span[39m
              [33mclass[39m=[32m"username"[39m
            [36m>[39m
              [0mcurrent[0m
            [36m</span>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"header-actions"[39m
          [36m>[39m
            [36m<input[39m
              [33maccept[39m=[32m".json"[39m
              [33mstyle[39m=[32m"display: none;"[39m
              [33mtype[39m=[32m"file"[39m
            [36m/>[39m
            [36m<div[39m
              [33mclass[39m=[32m"settings-menu-container"[39m
            [36m>[39m
              [36m<button[39m
                [33maria-label[39m=[32m"Settings"[39m
                [33mclass[39m=[32m"settings-button"[39m
                [33mtitle[39m=[32m"Settings"[39m
              [36m>[39m
                [0m⚙️ Settings[0m
              [36m</button>[39m
            [36m</div>[39m
            [36m<button[39m
              [33mclass[39m=[32m"logout-button"[39m
            [36m>[39m
              [0mLogout[0m
            [36m</button>[39m
          [36m</div>[39m
        [36m</header>[39m
        [36m<input[39m
          [33maccept[39m=[32m".json"[39m
          [33mstyle[39m=[32m"display: none;"[39m
          [33mtype[39m=[32m"file"[39m
        [36m/>[39m
        [36m<main[39m
          [33mclass[39m=[32m"dashboard-main"[39m
        [36m>[39m
          [36m<div[39m
            [33mclass[39m=[32m"hit-section"[39m
          [36m>[39m
            [36m<h2[39m
              [33mclass[39m=[32m"section-title"[39m
            [36m>[39m
              [0m11:41:57[0m
            [36m</h2>[39m
            [36m<div>[39m
              [36m<button[39m
                [33mclass[39m=[32m"hit-button"[39m
                [33mdata-control-index[39m=[32m"0"[39m
              [36m>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"hit-button-text"[39m
                [36m>[39m
                  [0mRUN[0m
                [36m</span>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"hit-button-icon"[39m
                [36m>[39m
                  [0m🏃[0m
                [36m</span>[39m
              [36m</button>[39m
            [36m</div>[39m
            [36m<p[39m
              [33mclass[39m=[32m"motivational-quote"[39m
            [36m>[39m
              [0m"[0m
              [0mLife begins at the end of your comfort zone.[0m
              [0m"[0m
            [36m</p>[39m
            [36m<p[39m
              [33mclass[39m=[32m"hit-count"[39m
            [36m>[39m
              [0mRunaway Count: [0m
              [36m<strong>[39m
                [0m1[0m
              [36m</strong>[39m
            [36m</p>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"data-section"[39m
          [36m>[39m
            [36m<div[39m
              [33mclass[39m=[32m"statistics-container"[39m
            [36m>[39m
              [36m<h3[39m
                [33mclass[39m=[32m"statistics-title"[39m
              [36m>[39m
                [0m📊 [0m
                [0mStatistics[0m
              [36m</h3>[39m
              [36m<div[39m
                [33mclass[39m=[32m"stats-grid"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m1[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mTotal[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m0[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mToday[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m0[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mThis Week[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m0[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mThis Month[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m0[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mDaily Average[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m0[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mCurrent Streak[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m1[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mLongest Streak[0m
                  [36m</div>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"stat-card"[39m
                [36m>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-value"[39m
                  [36m>[39m
                    [0m1[0m
                  [36m</div>[39m
                  [36m<div[39m
                    [33mclass[39m=[32m"stat-label"[39m
                  [36m>[39m
                    [0mPeak Day[0m
                  [36m</div>[39m
                [36m</div>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"stats-insights"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"insight-item"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"insight-icon"[39m
                  [36m>[39m
                    [0m📅[0m
                  [36m</span>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"insight-text"[39m
                  [36m>[39m
                    [0mMost active on[0m
                    [0m [0m
                    [36m<strong>[39m
                      [0mThursday[0m
                    [36m</strong>[39m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"insight-item"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"insight-icon"[39m
                  [36m>[39m
                    [0m🕐[0m
                  [36m</span>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"insight-text"[39m
                  [36m>[39m
                    [0mPeak runaway time:[0m
                    [0m [0m
                    [36m<strong>[39m
                      [0m16:00 - 17:00[0m
                    [36m</strong>[39m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"insight-item"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"insight-icon"[39m
                  [36m>[39m
                    [0m🔥[0m
                  [36m</span>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"insight-text"[39m
                  [36m>[39m
                    [0mRecord day:[0m
                    [0m [0m
                    [36m<strong>[39m
                      [0m1[0m
                      [0m [0m
                      [0mrunaways[0m
                    [36m</strong>[39m
                    [0m [0m
                    [0mon[0m
                    [0m [0m
                    [0m2025-10-09[0m
                  [36m</span>[39m
                [36m</div>[39m
              [36m</div>[39m
            [36m</div>[39m
            [36m<div[39m
              [33mclass[39m=[32m"calendar-container"[39m
            [36m>[39m
              [36m<div[39m
                [33mclass[39m=[32m"calendar-header"[39m
              [36m>[39m
                [36m<button[39m
                  [33mclass[39m=[32m"calendar-nav-btn"[39m
                [36m>[39m
                  [0m←[0m
                [36m</button>[39m
                [36m<h3[39m
                  [33mclass[39m=[32m"calendar-title"[39m
                [36m>[39m
                  [0mNovember 2026[0m
                [36m</h3>[39m
                [36m<button[39m
                  [33mclass[39m=[32m"calendar-nav-btn"[39m
                [36m>[39m
                  [0m→[0m
                [36m</button>[39m
              [36m</div>[39m
              [36m<button[39m
                [33mclass[39m=[32m"calendar-today-btn"[39m
              [36m>[39m
                [0mToday[0m
              [36m</button>[39m
              [36m<div[39m
                [33mclass[39m=[32m"calendar-weekdays"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mSun[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mMon[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mTue[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mWed[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mThu[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mFri[0m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"weekday"[39m
                [36m>[39m
                  [0mSat[0m
                [36m</div>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"calendar-grid"[39m
              [36m>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-01: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m1[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-02: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m2[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-03: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m3[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-04: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m4[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-05: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m5[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-06: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m6[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-07: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m7[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-08: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m8[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-09: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m9[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-10: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m10[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-11: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m11[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-12: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m12[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-13: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m13[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-14: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m14[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-15: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m15[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-16: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m16[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-17: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m17[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-18: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m18[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-19: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m19[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-20: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m20[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-21: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m21[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-22: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m22[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-23: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m23[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-24: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m24[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-25: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m25[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-26: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m26[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-27: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m27[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-28: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m28[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-29: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m29[0m
                  [36m</span>[39m
                [36m</div>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"calendar-day intensity-0"[39m
                  [33mtitle[39m=[32m"2026-11-30: 0 escape dreams"[39m
                [36m>[39m
                  [36m<span[39m
                    [33mclass[39m=[32m"day-number"[39m
                  [36m>[39m
                    [0m30[0m
                  [36m</span>[39m
                [36m</div>[39m
              [36m</div>[39m
              [36m<div[39m
                [33mclass[39m=[32m"calendar-legend"[39m
              [36m>[39m
                [36m<span>[39m
                  [0mLess[0m
                [36m</span>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"legend-item intensity-0"[39m
                [36m/>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"legend-item intensity-1"[39m
                [36m/>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"legend-item intensity-2"[39m
                [36m/>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"legend-item intensity-3"[39m
                [36m/>[39m
                [36m<div[39m
                  [33mclass[39m=[32m"legend-item intensity-4"[39m
                [36m/>[39m
                [36m<span>[39m
                  [0mMore[0m
                [36m</span>[39m
              [36m</div>[39m
            [36m</div>[39m
          [36m</div>[39m
          [36m<div[39m
            [33mclass[39m=[32m"logs-container"[39m
          [36m>[39m
            [36m<h3[39m
              [33mclass[39m=[32m"logs-title"[39m
            [36m>[39m
              [0mEscape Dreams Log[0m
            [36m</h3>[39m
            [36m<div[39m
              [33mclass[39m=[32m"logs-list"[39m
            [36m>[39m
              [36m<div[39m
                [33mclass[39m=[32m"log-item"[39m
              [36m>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"log-number"[39m
                [36m>[39m
                  [0m#[0m
                  [0m1[0m
                [36m</span>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"log-time"[39m
                [36m>[39m
                  [0mOct 09, 2025, 04:53:20 PM[0m
                [36m</span>[39m
                [36m<span[39m
                  [33mclass[39m=[32m"log-icon"[39m
                [36m>[39m
                  [0m🏃[0m
                [36m</span>[39m
              [36m</div>[39m
            [36m</div>[39m
          [36m</div>[39m
        [36m</main>[39m
      [36m</div>[39m
    [36m</div>[39m
  [36m</body>[39m
[36m</html>[39m
[36m [2m❯[22m src/test/settings-header-import.test.tsx:[2m24:30[22m[39m

[90m [2m❯[22m runWithExpensiveErrorDiagnosticsDisabled node_modules/@testing-library/dom/dist/config.js:[2m47:12[22m[39m
[90m [2m❯[22m checkCallback node_modules/@testing-library/dom/dist/wait-for.js:[2m124:77[22m[39m
[90m [2m❯[22m MutationObserver.checkRealTimersCallback node_modules/@testing-library/dom/dist/wait-for.js:[2m118:16[22m[39m
[90m [2m❯[22m MutationObserver.invokeTheCallbackFunction node_modules/jsdom/lib/jsdom/living/generated/MutationCallback.js:[2m19:26[22m[39m
[90m [2m❯[22m notifyMutationObservers node_modules/jsdom/lib/jsdom/living/helpers/mutation-observers.js:[2m160:22[22m[39m
[90m [2m❯[22m node_modules/jsdom/lib/jsdom/living/helpers/mutation-observers.js:[2m133:5[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22mexports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/lib/data/transfer.test.ts:[2m48:28[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22mmerge retains current identity/profile/games/cards and preserves imported unknown data
[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22mreplace retains current identity/profile/games/cards and preserves imported unknown data
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/lib/data/transfer.test.ts:[2m75:28[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22mpreserves arbitrary existing unknown values across a confirmed import
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/lib/data/transfer.test.ts:[2m102:28[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22mconfirmed merge reads current storage rather than losing hits added after the dialog opened
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/lib/data/transfer.test.ts:[2m109:28[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22mconfirmed import propagates a storage failure without changing current bytes
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/lib/data/transfer.test.ts:[2m119:28[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/13]⎯[22m[39m

[41m[1m FAIL [22m[49m src/lib/data/transfer.test.ts[2m > [22mv2 transfer[2m > [22maccepts legacy maps through the same migration and refuses ambiguous multi-user replacement
[31m[1mExportError[22m: Archive import is deferred to the import/recovery implementation increment.[39m
[36m [2m❯[22m importUserData src/lib/data/transfer.ts:[2m73:25[22m[39m
    [90m 71| [39m  [35mvoid[39m file[33m;[39m
    [90m 72| [39m  [35mvoid[39m username[33m;[39m
    [90m 73| [39m  return Promise.reject(new ExportError('import-deferred', 'Archive im…
    [90m   | [39m                        [31m^[39m
    [90m 74| [39m}[33m;[39m
    [90m 75| [39m
[90m [2m❯[22m src/lib/data/transfer.test.ts:[2m128:19[22m[39m

[31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/13]⎯[22m[39m


[2m Test Files [22m [1m[31m4 failed[39m[22m[2m | [22m[1m[32m35 passed[39m[22m[90m (39)[39m
[2m      Tests [22m [1m[31m13 failed[39m[22m[2m | [22m[1m[32m342 passed[39m[22m[90m (355)[39m
[2m   Start at [22m 11:41:54
[2m   Duration [22m 13.78s[2m (transform 2.74s, setup 8.20s, import 4.36s, tests 41.91s, environment 16.30s)[22m

```

### `npm run build` — actual exit 0

UTC 2026-11-16T03:42:08.168Z → 2026-11-16T03:42:11.612Z; signal null; spawn error null. SHA-256 of raw stdout/stderr: `0b21ebc30335486d3480bdb3d6da239b5203068221a9f65b84dc46e324c015a0`.

```text

> runawaylog@1.2.0 build
> tsc -b && vite build

vite v7.2.6 building client environment for production...
transforming...
✓ 182 modules transformed.
[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/files.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/chunks.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/chunks.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, dynamic import will not move module into another chunk.

rendering chunks...
computing gzip size...
dist/registerSW.js                0.13 kB
dist/manifest.webmanifest         0.40 kB
dist/index.html                   1.04 kB │ gzip:   0.50 kB
dist/assets/index-g06rwGX2.css   48.85 kB │ gzip:   8.46 kB
dist/assets/index-8XL2d04W.js   428.04 kB │ gzip: 140.05 kB
✓ built in 647ms
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
Browserslist: browsers data (caniuse-lite) is 12 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme

PWA v1.2.0
mode      generateSW
precache  7 entries (467.17 KiB)
files generated
  dist/sw.js
  dist/workbox-1d305bb8.js
```

## Final disposition

**Blocked unpublished implementation candidate.** ESLint, TypeScript and production build passed; full tests did not. The raw result is 342 passed / 13 failed, not “212 green.” Do not release, deploy, represent this as accepted, or infer browser durability. Import/recovery delivery remains deferred, the GamesHub structure regression and canonical/runtime validation gaps remain explicit. Rowan must independently review the artifact, raw outputs, scope/budgets and repository state. No source/gate retry was performed after this final sequence.

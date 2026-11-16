# Round B implementation report — BLOCKED

## 1. Disposition and exact candidate

**Round B is BLOCKED, not complete and not independently accepted.** The single final sequence returned ESLint **0**, TypeScript **0**, tests **1**, build **0**. The test run discovered **46 files / 492 cases: 45 files passed, 1 failed; 491 cases passed, 1 failed**. No test was skipped. The remaining failure is the existing persisted-hit fixture in `src/features/print/PrintCalendar.test.tsx`, test **`Settings opens the current month from the persisted record without invoking window.print`**. Its `hits` literals at lines 19–21 lack the newly mandatory `schemaVersion: 1` / positive decimal-string `recordVersion`. `seedRecord` reaches the public append boundary and correctly rejects that malformed fixture before the print assertions run. This fixture adaptation was missed before freeze; it was **not fixed after the final gates**, as instructed. The failure is not claimed to be a browser print regression, nor is the unexecuted remainder of that test claimed to pass.

- Role: executor for Soren; unpublished bounded ADR0006 §13(b) candidate, not acceptance or release.
- Authorized workspace: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a`.
- Branch: `storage-v2` (actual primary workspace branch; tool-created internal segment branches are not the delivery branch).
- Starting revision: `70a2179874dd05d9efe8a4add110af660ee64830`.
- **Implementation candidate:** `c195da23843f99600935d0fbd18df9f70a9d75d3`.
- Implementation commit: `feat: implement bounded ZIP import and explicit recovery candidate`.
- Source frozen at **2026-11-16T04:40:29.125Z**; gates ended **2026-11-16T04:40:50.485Z**, before the packet deadline `2026-11-16T05:26:00Z`.
- All 57 source/test file SHA-256 values in the freeze record were checked unchanged after the gates and before the implementation commit. No post-final source edit, fix pass, rerun, browser, push, deploy, server, network or cloud operation occurred.
- Primary worktree was clean after the implementation commit and before this separate report. No remotes are configured. `REPORT.md`, package/lockfiles, spec, version source and versions catalog are unchanged from the starting revision.
- The report commit is deliberately separate. Its exact final HEAD and final clean status are supplied by the read-only final check in the terminal handoff, rather than a self-referential hash inside this file. The candidate SHA above remains the tested source revision.

Maia's existing round-A baseline verification was **not repeated**. The baseline supplied by the packet was 39 files / 355 cases, 342 passed / 13 failed. B adds **7 test files and 137 instantiated cases**: 36 ZIP decoder, 51 source codec, 12 canonical validation, 5 cross-tab, 6 GC fault, 7 restore, 8 recovery UI, 9 additional transfer cases and 1 additional selective-provenance case plus 2 ownership cases. This totals 492, retaining the original 355 cases, with the expressly authorized legacy-source test rename. B closes the importer-positive and brittle CARDS failures but leaves the separate missed print fixture failure above. “All original 355 now pass” is therefore **not** a claim of this report.

## 2. Changed behavior by accepted ADR responsibility

### ADR0006 §§4–7, 13(b): real bounded ZIP import

`lib/data/transfer.ts` now accepts real format-1 ZIP bytes, never arbitrary or legacy JSON. `archive-import.ts` uses the existing authorized `fflate` runtime dependency; `zip-preflight.ts` is a narrow raw header gate, not a replacement ZIP/DEFLATE decoder. Preview is write-free. Source selection is an explicit UUID or the sole validated account. A source handle is never authority and multi-account ambiguity refuses before preview. A WeakMap binds confirmation to the original validated preview object, with an independent cloned intent so caller mutation of displayed arrays/provenance cannot alter what is confirmed.

Implemented validation order:

1. Check the compressed File/byte view **≤64 MiB** before copying/reading the bounded input, then require the ZIP local signature and a single unambiguous EOCD/central directory. Freeze the supplied view before asynchronous hashing.
2. Gate central/local headers: **≤10,000 entries including manifest**; first physical/central entry `manifest.json`, remaining unique payload names in ASCII order; manifest advertised **≤4 MiB**, ordinary payload **≤16 MiB**, sum **≤256 MiB** including manifest. ZIP64/split archives, encryption, symlinks/nonregular files and unsupported flags/encoding/compression refuse.
3. Validate each original raw name as printable ASCII **≤4,096 bytes**, through the exact registered whitelist **before any normalization**. Reject absolute/drive/dot/dotdot/backslash/NUL/control/non-ASCII/percent aliases, empty/repeated segments, duplicate or unregistered paths. Verify local-vs-central name/method/flags/time/CRC/sizes, contiguous offsets without gaps/overlap, exact payload spans, and optional streaming descriptors. Reject extra fields (including Unicode and ZIP64 overrides), unlisted bytes and ambiguous directory structure.
4. STORE copies bounded slices; `fflate Inflate` receives at most **1 KiB compressed input per push**. Count actual emitted per-entry and aggregate bytes incrementally, without allocating from advertised output size. Refuse actual cap+1, false lengths, bad CRC, unfinished streams and trailing compressed bytes. Equality is accepted.
5. Decode the bounded manifest as strict run-json-1 JSON with **depth ≤64**; require supported format/version/schema, user kind, auth shape, exact unique descriptors and ZIP membership. A recovery-kind rescue is **not** a normal import.
6. Decode/decompress and verify **every payload's exact byte length and real SHA-256 before any payload semantic JSON parse**, including nonselected accounts and retained sources. Then reject malformed UTF-8, duplicate JSON keys, NUL, unsupported/nonfinite JSON and depth>64.
7. Audit the complete canonical tree: UUID/path/envelope/schema/version/time/registration agreement; required files and registered plugin/module ownership; exact chunk partition/sequence/count/byte/hash/bounds/ordinals; exact whole index totals/first/min/max/frequencies/IDs/recent stable order; imports membership/IDs/ownership/digests/nonrecursive bounded source representation. Only incoming import mode permits canonical-identical repeated IDs; conflicting copies reject the entire archive.
8. Select the explicit source UUID or sole account, return preview only, and require a separately supplied existing target UUID at confirmation. No partial account salvage or identity adoption.

Numeric binary limits are MiB (`1024*1024`), while the run chunk limit remains exactly **1,000,000 UTF-8 bytes and 5,000 hits**, both inclusive. Source transport uses inline canonical source ≤12 MiB when the full envelope depth fits; otherwise shallow canonical file strings split into ≤8 MiB binary parts, each base64 marker in an ordinary ≤16 MiB source envelope, at most 32 parts / 256 MiB wire source. Complete adjacent ordered groups, exact owner/count/hash and canonical base64 are mandatory. This is storage runtime and is counted in its budget.

Strict ZIP-profile choice: all extra fields are rejected, including harmless extended timestamps. STORE, DEFLATE, standard streaming data descriptors, supported ASCII/UTF8 flags and comments work with the existing fflate exporter. This is not a promise to accept every general-purpose ZIP writer. fflate 0.8 has no public consumed-byte endpoint, so a narrow dependency-coupled guard inspects its decoder endpoint state (`s.f`, `s.l`, residual `p` versus `ceil(s.p/8)`). Tests cover missing final block and trailing junk. A dependency upgrade must retain those tests; no handwritten general DEFLATE parser was added.

### ADR0006 §§7–8: queued latest-state merge/replace and export

`lib/storage/imports.ts` owns publication, not transfer/UI. Confirmation clones incoming intent, enters the shared serialized storage queue, pins/rereads the latest committed base, fully verifies it and resolves the **target UUID** on every CAS retry. A command never saves a stale preview-era whole account. Candidate staging, exact readback/full canonical verification and the existing pointer CAS publish an all-or-nothing new generation.

- **Merge:** current target wins duplicate IDs; first new canonical-identical incoming duplicate wins; append unseen incoming hits and stable-sort ascending `at`. Equal-time target ordering precedes equal-time newly imported ordering. Conflicting IDs inside the source archive refuse before selection/confirmation.
- **Replace:** replace only hits/run projection, still deduplicate incoming identical copies and stable-sort ascending `at`. Target UUID/handle/registration/profile/settings/games/cards/extensions and device preferences remain current-owned. Neither mode creates the source identity or adopts its metadata.
- Source provenance consists of flat logical original files/shared documents. Previously retained sources are decoded and carried forward directly; `imports/*` wrappers are excluded from the new logical source, and export-time manifest timestamps/digests are not nested. Canonical source content digests deduplicate repeated original sources. Existing source order and supported opaque scalar/null/array/presence values survive. Shared installation account directory is intentionally excluded from provenance to avoid unrelated account identities.
- Large/deep sources use the bounded source codec rather than an unbounded single file or recursively nested envelopes. Each original file retains its independent depth-64 budget. Pure preview/source dedup uses a shallow deterministic file-string key.
- Batch rebuilding partitions sorted hits once and calculates exact canonical entry/comma/envelope bytes before saving bounded chunks, avoiding an O(n²) append-command loop. Indexes, ordinals, frequencies, bounds and recent50 are rebuilt from those facts. Current metadata blobs are reused.
- Normal export still pins latest authoritative state, isolates the selected account and refuses out-of-envelope data before download. It now runs a lazy full selected-tree semantic audit after raw integrity preflight, rehashes lazy reads against substitution and rechecks encoding-pass bytes. It retains one decoded chunk rather than a whole uncompressed selected history during that audit. ZIP MIME/download/pickers are real `.zip`.
- Preview/cancel/failure do not publish target changes. Failed candidate material can remain staged/quarantined as evidence; there is no false success receipt or partial pointer swap.

### ADR0006 §§3–6 and ADR0007 §2: canonical runtime boundaries

`validateHit` now requires actual `schemaVersion === 1` and a **string** matching `^[1-9][0-9]*$`, plus valid canonical id/time/unknown JSON. No silent metadata repair is performed. Public append freezes the original input before queueing and validates it before duplicate lookup; append/chunk validators reject malformed caller and persisted metadata.

Shared storage-owned envelope/directory validators check UUID ownership, positive decimal string record versions, valid instants, supported JSON, local envelope versions against generation revision, directory uniqueness and registration/handle agreement. Selective boot/ordinary queued base checks enforce manifest/descriptors, directory, profile/settings/games/extensions/import-index envelopes and index revision ownership without reading historical chunks or retained source payloads. They do not republish an unchanged snapshot before an attempted write, preserving failed-write referential/notification contracts. A missing SubtleCrypto write refuses without poisoning the safe retry contract.

Full canonical audits are explicit import/export/recovery/full-record work, not render-time history loads. Full record reads and import confirmation now audit complete current facts before returning/rewriting; discovered persisted corruption blocks later writes. Imported hit record versions are authority-scoped facts and may exceed the local tree revision; they are preserved exactly, not incorrectly compared to local counters. Unknown original source metadata is preserved as provenance, never promoted into current account identity/preferences. Shared pure code remains unchanged and independent of persistence/application runtime.

### ADR0006 §§5–6, 13(b): recovery, rescue, restore and UI

Damaged current data blocks normal login/mutation and never becomes an empty store. Recovery atomically captures accessible exact original bytes before semantic inspection, then verifies retained committed trees newest first; future/unpublished revisions cannot masquerade as older recovery. A verified older tree is explicitly **read-only**, with generation/revision/account/count labels and on-demand noneditable details. Merely viewing it never changes current or publishes an older writable snapshot.

Restore requires explicit checkbox consent and the preview's expected current pointer. It serializes with other local commands, rejects stale consent rather than silently rebasing, rechecks/pins the chosen older committed source and commits a **new** fully verified generation through existing prepare/readback/CAS. It preserves installation deviceId, advances local generation/file/envelope counters above retained known local counters and preserves exact hits/authority-scoped hit versions (including very large versions), identity/registration/unknown values. Quarantine companion roots preserve all newer committed evidence and their untouched original generation/maps/blobs through subsequent GC; restore does not run GC itself.

No healthy retained generation leaves storage blocked but permits accessible exact-byte rescue. Rescue ZIP includes explicit recovery kind/warning/diagnostics/raw path mapping, may contain damaged bytes/multiple accounts, and is not a verified normal backup/import. It refuses numeric limits rather than truncate. If IndexedDB cannot open, UI explicitly states original bytes are inaccessible and does not invent a download. `App` boot and `Login` render this flow without mounting writable routes. Busy ref fencing prevents duplicate recovery actions.

Three locales receive new recovery/ZIP/UUID/hits-only replace/error keys. **All existing frozen locale strings and shipped markup remain byte-for-byte preserved**; safe new plain-text import warnings use `source_warning`, not untrusted archive handles interpolated into `dangerouslySetInnerHTML`. Existing warning/replace keys remain for compatibility, not as the new dialog description. Both Settings and Dashboard await UUID confirmation before success/reload and use returned replacement count. Preference consumers use the public storage facade.

Cross-tab tests use independent actual module queues/snapshots/IDB handles over real fake-indexeddb and genuine WebCrypto call-through pauses, with advisory notifications dropped. They cover stale-base append CAS, same/different-handle first creation, UUID-stable rename/handle reuse and duplicate losing intents. GC tests abort actual transactions **after request success** in each store, assert complete rollback, protect active readers over another connection and reject premature local lease extension. No Map persistence or stub digest substitutes were used.

## 3. Known gaps, overruns and scope choices

1. **Blocking final test failure:** missed canonical metadata in `PrintCalendar.test.tsx` persisted fixture, exact test/error above and raw output below. No source fix or second gate was authorized/performed. All-four-zero requirement is unmet.
2. **Storage runtime budget overrun:** 1,696 lines versus ≤1,500, **+196** (13.1%). Excluding only genuinely pure model/type/conversion files, not validators/codec/import/restore, is deliberate. Responsibility files individually remain ≤200–250; this does not waive the aggregate limit. More decomposition/line relocation into model files would hide rather than solve it. Owner review required; no spec exception was edited.
3. **Maximal provenance envelope headroom:** canonical file-string escaping and base64 expansion can make some otherwise ≤256 MiB source archives exceed the 256 MiB source transport or later export envelope. Confirmation safely refuses over-cap wire rather than truncate/partially publish; accumulated current+provenance may later cause export refusal. No claim that every maximal valid archive round-trips. Ordinary/deep64 cases and real inline/fragment equality are tested; full maximal installation capacity/browser memory is not established.
4. **Restore exact chunk equality:** increasing a local version digit can expand an exact 1,000,000-byte older chunk, causing full candidate validation to refuse safely. Original evidence remains. No silent truncation/cap bypass.
5. **Selective boot:** dormant historical chunk/source corruption is diagnosed on access/full audit, not an immediate all-history boot scan. Ordinary source-payload reads were explicitly removed and tested. GC currently retains the two previous committed roots, pins, young stages and quarantined roots; it does not independently re-audit every predecessor inside its transaction to prove those two are the last two healthy generations.
6. Explicit recovery snapshot/full-tree verification may materialize accessible bytes and explicit full reads can scan the whole installation; this is not a bounded-memory hot-path claim. The ZIP decoder retains bounded output ≤256 MiB, not zero-copy streaming publication.
7. fflate private endpoint-state coupling and rejection of all ZIP extras are explicit strict-profile choices, not general ZIP support; see §2.
8. Existing large component target overruns persist (table below). No broad UI split or architecture/spec/version/release edits were in the packet. ADR0006's architecture alignment work is left to owner scope because packet explicitly forbids spec edits.
9. Import source selection API supports explicit multi-account UUID, while current dialogs reject ambiguous archives rather than add a broad account-selector redesign. Target comes from hydrated current UUID and is shown explicitly. No cloud/auth/legacy migration feature was activated.
10. SHA-256 detects integrity, not malicious operator authenticity. Browser reload/tab/quota/durability/eviction/power-loss acceptance remains independent work; browser activity was forbidden here and no such result is claimed. Existing stale browser data advisories, Vite mixed static/dynamic import notices, React act warnings and jsdom navigation notices are preserved in raw outputs rather than suppressed.

## 4. Intentional file inventory and size budgets

Implementation contains **57 changed source/test files: 16 new, 41 modified**, **+3,107 / −336 lines** by Git. Line counts include imports/comments/blanks, count a terminal newline once, and do not compress tests for budget compliance. The exact per-file old/new/add/delete inventory is generated below from the frozen candidate; report itself is the sole separate report-commit addition.

| File | Kind | Baseline lines | Candidate lines | Added | Deleted |
|---|---|---:|---:|---:|---:|
| `src/app/App.tsx` | modified | 61 | 62 | 6 | 5 |
| `src/features/about/About.tsx` | modified | 52 | 52 | 1 | 1 |
| `src/features/about/Releases.tsx` | modified | 34 | 34 | 1 | 1 |
| `src/features/games/CardGame.tsx` | modified | 67 | 67 | 1 | 1 |
| `src/features/games/GamesHub.tsx` | modified | 590 | 590 | 1 | 1 |
| `src/features/profile/Profile.tsx` | modified | 161 | 161 | 1 | 1 |
| `src/features/run/Dashboard.tsx` | modified | 536 | 538 | 25 | 23 |
| `src/features/settings/Settings.tsx` | modified | 409 | 409 | 23 | 23 |
| `src/features/settings/SettingsMenu.tsx` | modified | 213 | 213 | 3 | 3 |
| `src/features/settings/ThemeSelector.tsx` | modified | 53 | 53 | 1 | 1 |
| `src/lib/data/archive-import.test.ts` | new | 0 | 275 | 275 | 0 |
| `src/lib/data/archive-import.ts` | new | 0 | 90 | 90 | 0 |
| `src/lib/data/archive.export.test.ts` | modified | 247 | 264 | 29 | 12 |
| `src/lib/data/archive.ts` | modified | 166 | 174 | 8 | 0 |
| `src/lib/data/transfer.test.ts` | modified | 132 | 275 | 178 | 35 |
| `src/lib/data/transfer.ts` | modified | 82 | 109 | 61 | 34 |
| `src/lib/data/zip-preflight.ts` | new | 0 | 109 | 109 | 0 |
| `src/lib/i18n/locales/en_us.ts` | modified | 292 | 320 | 29 | 1 |
| `src/lib/i18n/locales/zh_cn.ts` | modified | 291 | 319 | 29 | 1 |
| `src/lib/i18n/locales/zh_tw.ts` | modified | 291 | 319 | 29 | 1 |
| `src/lib/storage/byte-boundary.test.ts` | modified | 26 | 26 | 2 | 2 |
| `src/lib/storage/canonical-validation.test.ts` | new | 0 | 260 | 260 | 0 |
| `src/lib/storage/chunks.ts` | modified | 109 | 139 | 37 | 7 |
| `src/lib/storage/commands.ts` | modified | 176 | 197 | 30 | 9 |
| `src/lib/storage/commit.ts` | modified | 162 | 170 | 11 | 3 |
| `src/lib/storage/consumers.test.ts` | modified | 107 | 107 | 4 | 4 |
| `src/lib/storage/core.test.ts` | modified | 169 | 169 | 13 | 13 |
| `src/lib/storage/cross-tab.test.ts` | new | 0 | 230 | 230 | 0 |
| `src/lib/storage/envelope-validation.ts` | new | 0 | 34 | 34 | 0 |
| `src/lib/storage/files.ts` | modified | 67 | 69 | 3 | 1 |
| `src/lib/storage/gc-fault.test.ts` | new | 0 | 223 | 223 | 0 |
| `src/lib/storage/imports.ts` | new | 0 | 105 | 105 | 0 |
| `src/lib/storage/index.ts` | modified | 9 | 15 | 7 | 1 |
| `src/lib/storage/integrity-commands.test.ts` | modified | 67 | 67 | 8 | 8 |
| `src/lib/storage/ownership.test.ts` | modified | 26 | 48 | 23 | 1 |
| `src/lib/storage/platform-failure.test.ts` | modified | 42 | 42 | 3 | 3 |
| `src/lib/storage/publication.test.ts` | modified | 166 | 166 | 5 | 5 |
| `src/lib/storage/recovery.test.ts` | modified | 308 | 309 | 4 | 3 |
| `src/lib/storage/recovery.ts` | modified | 196 | 154 | 46 | 88 |
| `src/lib/storage/restore.test.ts` | new | 0 | 158 | 158 | 0 |
| `src/lib/storage/restore.ts` | new | 0 | 105 | 105 | 0 |
| `src/lib/storage/runtime.ts` | modified | 95 | 104 | 15 | 6 |
| `src/lib/storage/selective.test.ts` | modified | 36 | 60 | 25 | 1 |
| `src/lib/storage/snapshot.ts` | modified | 134 | 154 | 29 | 9 |
| `src/lib/storage/source-codec.test.ts` | new | 0 | 193 | 193 | 0 |
| `src/lib/storage/source-codec.ts` | new | 0 | 139 | 139 | 0 |
| `src/lib/storage/state-model.ts` | modified | 111 | 124 | 14 | 1 |
| `src/lib/storage/tree-validation.ts` | new | 0 | 150 | 150 | 0 |
| `src/test/archive-fixtures.ts` | new | 0 | 104 | 104 | 0 |
| `src/test/i18n-structure.test.ts` | modified | 72 | 72 | 2 | 2 |
| `src/test/i18n-surfaces.test.tsx` | modified | 322 | 322 | 1 | 1 |
| `src/test/settings-data.test.tsx` | modified | 84 | 88 | 9 | 5 |
| `src/test/settings-header-import.test.tsx` | modified | 34 | 39 | 9 | 4 |
| `src/test/storage.test.ts` | modified | 144 | 144 | 4 | 4 |
| `src/ui/Login.tsx` | modified | 139 | 134 | 6 | 11 |
| `src/ui/RecoveryPanel.test.tsx` | new | 0 | 121 | 121 | 0 |
| `src/ui/RecoveryPanel.tsx` | new | 0 | 75 | 75 | 0 |

Storage aggregate includes all nontest responsibility/facade/adapter runtime files, even the 139-line source codec and 150-line whole-tree validator. Excluded only `model.ts` (44), `state-model.ts` (124, type declarations only) and `migrate.ts` (124, pure conversion not runtime import). Baseline same-method runtime was 1,109; candidate is **1,696 (+587)**. All nontest files including exclusions total 1,988. No storage implementation was moved into pure models/shared files.

| Budget | Candidate | Result |
|---|---:|---|
| Storage facade ≤120 | `index.ts` 15 | within |
| Storage responsibility ≤200–250 each | largest `commands.ts` 197; `commit.ts` 170; snapshot/recovery154 each; tree150; chunks/source codec139 each; others≤107 | within individual ceiling |
| Storage runtime aggregate ≤1,500 | **1,696** | **over by196** |
| Transfer facade ≤150 | 109 | within |
| Archive/validation each≤250 | archive174, validation114, importer90, raw preflight109 | within |
| Archive/validation aggregate≤650 | **487** excluding transfer; **596** even including transfer | within |
| Component target≤150 | App62, Login134, new RecoveryPanel75 | within for boot/recovery |
| Existing component target overruns | Dashboard538 (baseline536), Settings409 (baseline409), SettingsMenu213 (baseline213), GamesHub590 (baseline590), Profile161 (baseline161) | retained/reported |

No new dependency, package/lock/config/exclude modification was made. Existing exclusions already avoid internal segment duplicate test discovery; the final run contains 46 actual project test files, not nested-worktree copies. Ownership tests extend public-facade/cross-feature/shared independence, not hide files.

## 5. Exact added/adapted test ledger

Parameterized titles below give the literal test template and all row values where applicable; each instantiated case is included in the final totals. Every retained assertion remains except accepted async/ZIP/fresh-start changes, two more specific centralized diagnostic strings, and exactly the two expressly authorized CARDS source-expression adaptations. No test was deleted/skipped or its required behavior weakened to obtain green.

### Main integration additions and adaptations

- **NEW** `src/lib/data/transfer.test.ts` / `requires the original validated preview and confirms frozen intent despite preview mutation` — arbitrary copied preview cannot bypass validation, and original cloned hit/source intent survives displayed data mutation.
- **NEW** `src/lib/data/transfer.test.ts` / `round-trips depth-64 original files through confirmation and export without wrapping away their depth budget` — exercises the deep codec through real ZIP validation, IDB confirmation and re-export/reimport rather than codec-only mocks.
- **NEW** `src/lib/storage/canonical-validation.test.ts` / `blocks boot and queued writes on rehashed malformed directory and entity metadata without replacing current` — real rehashed numeric directory/extensions/import-index versions, recovery-kind/unsupported-auth/bad-descriptor manifests and future index revisions block boot/append without replacing the pointer.
- **NEW** `src/lib/storage/selective.test.ts` / `does not decode retained import sources during boot statistics or ordinary append` — real ZIP-confirmed source blob read spy proves source payloads remain outside ordinary hydration/view/append.
- **ADAPTED** `src/test/storage.test.ts` / `loads existing user data` — explicitly version the persisted positive hit, retaining exact load/full-hit equality and obsolete-key checks.
- **ADAPTED** `src/test/storage.test.ts` / `updates existing user data` — explicitly version initial and new hit, retaining exact order/profile/registration assertions.
- **ADAPTED** `src/test/storage.test.ts` / `adds hit to existing user` — explicitly version seeded positive hit, retaining totals/length behavior.
- **ADAPTED (three locale instances)** `src/test/i18n-surfaces.test.tsx` / `Settings opens the loaded current-month calendar, never the Settings print surface` — explicitly version the persisted current-month hit, retaining timezone/month/print surface assertions in en_us/zh_cn/zh_tw.
- Existing Settings/header confirmation tests listed in the contracts ledger additionally use the new `import_dialog.replace_records` checkbox label, preserving all confirmation assertions while frozen legacy copy remains unchanged.
- Existing export rescue tests `registers UUID binary evidence with hashes and explicit diagnostics/multi-account warning`, `reports inaccessible or oversized rescue rather than truncating evidence`, and `counts real streaming ZIP bytes and refuses the final compressed limit before producing an archive` share a helper now explicitly supplying `readableTree: null`; all raw-byte/cap assertions remain unchanged.

The five segment ledgers below are preserved verbatim as authorship/evidence appendices, with these authoritative integration corrections: canonical-validation has **12** cases (the 11 listed there plus main's new case above); transfer has **22** cases (13 adapted +7 segment +2 main); selective has **2** (one adapted +one new). Main owns final compiled cross-realm guards, directory/manifest validations, selective source reads, full current auditing, generic decode narrowing and frozen-locale compatibility. Agent runtime copies are not the tested candidate. Segment ledger counts are historical local delivery counts, not contradictory final claims.

### Segment appendix: ZIP decoder and export fixtures

# ZIP agent round B evidence

Workspace: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.claude/worktrees/agent-aa5eb9c66a9a18adc` (tool-created isolated internal segment; coordinator corrected initial main-only instruction after isolation write gate refused main-path write). No commits. No package/spec/config/network/server/browser changes. No full gates.

## Commands and actual exits

1. Attempted initial `pwd; git -C /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a status --short; ls -ld /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.git; date -u '+%Y-%m-%dT%H:%M:%SZ'` — tool permission denied before execution; **no process exit available**. Not retried or delegated. Dedicated Read/Glob tools used normally. Main-scope Write also blocked by isolation tool; coordinator then directed assigned edits in existing isolated worktree.
2. `npx vitest run src/lib/data/archive-import.test.ts` — **exit 1**, 1 file, 34 tests, 31 passed / 3 failed. New-test fixture mistakes only: total-cap central size patch did not update local headers; NUL path was rejected by fixture canonical encoder before decoder; local-name disagreement patch created unregistered name and therefore returned `path`, not `zip`. Corrected patches/fixtures to exercise intended decoder boundaries without weakening rejection.
3. `npx vitest run src/lib/data/archive-import.test.ts` — **exit 0**, 1 file, 35 tests passed. Added explicit missing-DEFLATE-final-bit and compressed-trailing-junk regression after coordinator request.
4. `npx eslint src/lib/data/archive-import.ts src/lib/data/zip-preflight.ts src/lib/data/archive-import.test.ts src/lib/data/archive.export.test.ts` — **exit 0**; baseline-browser-mapping age warning only.
5. `npx vitest run src/lib/data/archive-import.test.ts src/lib/data/archive.export.test.ts` — **exit 0**, 2 files, 61 tests passed (35 importer + 26 existing export cases). Export runs against isolated base archive.ts, not coordinator's integrated canonical-preflight archive.ts.
6. `npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution bundler --skipLibCheck --strict --lib ES2023,DOM --jsx react-jsx src/lib/data/archive-import.ts src/lib/data/zip-preflight.ts src/lib/data/archive-import.test.ts src/lib/data/archive.export.test.ts` — **exit 0**, no output.
7. `npx vitest run src/lib/data/archive-import.test.ts` — **exit 1**, new exact-cap equality test triggered V8 heap OOM inside Vitest deep equality enumerating 16 MiB Uint8Array; 32 tests reported passed before worker exited, 36 total, 1 unhandled worker error. Changed only that newly added assertion to exact length + real SHA-256 equality, preserving exact-byte equivalence without multi-gigabyte matcher enumeration. No runtime cap reduction or skipped test.
8. `npx vitest run src/lib/data/archive-import.test.ts` — **exit 0**, 1 file, **36 tests passed**, 883 ms tests / 1.12 s total.
9. `wc -l src/lib/data/archive-import.ts src/lib/data/zip-preflight.ts src/lib/data/archive-import.test.ts src/lib/data/archive.export.test.ts src/lib/data/archive.ts src/lib/data/validation.ts; git status --short; git diff --stat; git diff --numstat` — **exit 0**. File counts below. Only assigned four paths changed/untracked.

## Implementation and scope choices

- `readArchive(bytes: Uint8Array): Promise<{ manifest: Manifest; files: Map<string, Uint8Array> }>`; returned map includes `manifest.json` for canonical full-tree membership checks.
- Freeze bounded input before first await; input <=64 MiB; raw central/local gate <=10000 entries; manifest <=4 MiB; payload <=16 MiB; total <=256 MiB including manifest; raw printable ASCII names <=4096 bytes; JSON depth <=64.
- Narrow central/local header preflight resolves contiguous nonoverlapping payload spans, verifies manifest-first/ASCII-lexicographic unique payload order, whitelist raw names, central/local method/flags/name/time/CRC/sizes and optional streaming descriptor agreement; refuses encryption, unsupported flags/encoding/compression, ZIP64, symlinks/nonregular files, split archives, override extra fields, unlisted bytes/entries.
- fflate `Inflate` streaming owns DEFLATE; feed fixed <=1024 compressed bytes per push to bound a single inflate step instead of allocating from claimed sizes. STORE copies bounded slices. Count actual output incrementally, CRC and exact length; reject before accumulating beyond caps.
- fflate 0.8 exposes no public consumed-byte endpoint. Small dependency-coupled guard checks existing decoder state (`s.f===1`, `!s.l`, residual `p.byteLength===ceil(s.p/8)`) to reject incomplete final block and ignored trailing compressed bytes. No hand-written DEFLATE decoder/parser. Dependency upgrade needs endpoint tests retained.
- Parse supported bounded manifest and exact membership first; verify SHA-256/length for **all** payloads including nonselected accounts/import sources **before any payload JSON**. Only then run bounded run-json-1/depth validation. No canonical tree/source selection/storage/persistence in decoder; coordinator calls canonical validator.
- Normal import rejects recovery kind. Recovery raw registered names can pass header whitelist solely to diagnose manifest kind.
- Explicit narrow ZIP profile rejects **all extra fields**, including otherwise ignorable extended timestamps, to rule out Unicode-name/ZIP64 overrides; supports STORE/DEFLATE, standard data descriptors, compatible ASCII/UTF8 flags, comments. Existing fflate export remains supported. Rejecting extra fields is an intentional strictness choice, not general ZIP support.

## File inventory / size accounting

- NEW `src/lib/data/archive-import.ts`: 90 lines.
- NEW `src/lib/data/zip-preflight.ts`: 109 lines.
- NEW `src/lib/data/archive-import.test.ts`: 275 lines, 36 concrete cases.
- MODIFIED `src/lib/data/archive.export.test.ts`: 264 lines, +28/-11.
- No changes to `archive.ts`, `validation.ts`, `transfer.ts`.
- Isolated baseline runtime aggregate archive166 + validation114 + importer90 + preflight109 = **479 lines**, under aggregate650. Each individual runtime file <=250. Coordinator's later archive semantic-preflight additions not counted here.

## Added tests: exact names and reason

All added tests live in `src/lib/data/archive-import.test.ts`, suite `bounded format-1 ZIP decoder`.

- `decodes real STORE/DEFLATE archives with exact bytes and manifest membership (level 0)` — real STORE round trip, raw noncanonical-byte preservation, multi-account membership.
- `decodes real STORE/DEFLATE archives with exact bytes and manifest membership (level 6)` — real DEFLATE same contracts.
- `accepts signed streaming data descriptors without scanning payload signatures (STORE=false)` — fflate streaming DEFLATE exporter compatibility.
- `accepts signed streaming data descriptors without scanning payload signatures (STORE=true)` — fflate streaming STORE exporter compatibility.
- `owns returned bytes across caller mutation and respects nonzero input view offsets` — no caller mutation across awaited SHA / exact typed-array view support.
- `rejects legacy JSON, wrong signatures, truncated archives and compressed cap before decoding` — ZIP-only input and first cap.
- `bounds entry count and advertised manifest, payload and aggregate bytes before expansion` — raw numeric header caps/order.
- Parameterized `rejects the original unsafe/unregistered raw path %j` for `../manifest.json`, `/manifest.json`, `C:/manifest.json`, `shared//extensions.json`, `shared/./extensions.json`, `shared/../extensions.json`, `shared\\extensions.json`, `shared/%2e%2e/extensions.json`, `shared/%2Fextensions.json`, `shared/\u0000extensions.json`, `shared/汉字.json`, `accounts/11111111-1111-4111-8111-111111111111/plugins/unregistered.json`, `accounts/11111111-1111-4111-8111-111111111111/run/y2026-m11-000000.json`, `shared/extensions.json/` — 14 cases validate raw names before normalization/manifest interpretation.
- `bounds raw path bytes and rejects local/central name disagreement before manifest parsing` — 4096-byte name bound and authoritative raw name parity.
- `rejects duplicate, unsorted, directory and manifest-not-first entries without normalizing` — physical/central order and exact unique names.
- Parameterized `rejects %s in raw central/local headers` for `encryption`, `strong encryption`, `unsupported encoding`, `unsupported method`, `ZIP64 version` — 5 unsupported-header cases.
- `rejects symlinks, extra/Unicode override fields, ZIP64 sentinels and multi-disk ambiguity` — dangerous attribute/header variants.
- `rejects missing/unlisted payload membership, unsupported manifests and recovery kind` — supported envelope and exact archive membership.
- `checks every exact payload hash before any payload JSON, including nonselected account` — malformed first payload must not hide later peer hash failure; malformed nonselected peer rejects whole archive.
- `enforces actual streamed manifest and payload caps despite false bounded advertised sizes` — real compressed bombs produce cap+1 while headers falsely claim cap.
- `accepts actual manifest/payload caps at exact equality without trusting an allocation hint` — real 4 MiB manifest and 16 MiB payload equality are supported.
- `rejects false sizes, corrupt compressed bytes and inconsistent streaming descriptors` — CRC, DEFLATE corruption and descriptor parity.
- `refuses missing DEFLATE final blocks and trailing compressed bytes rather than trusting decoded SHA alone` — fflate permissive endpoint behavior guarded.
- `allows depth 64 and rejects deeper, duplicate-key, NUL and invalid UTF-8 payloads after integrity` — bounded canonical JSON and supported unknown values.

## Adapted existing tests: exact names and reason

All live in `src/lib/data/archive.export.test.ts`; no test deleted/skipped or existing assertion weakened. Common fixture now supplies true canonical profile/games/imports/preferences/hit metadata and exact chunk index/hash projection. Preserved hit ids and at42/100; corrected positive chunk path from y2026-m11 to **y1970-m01** rather than altering facts. Empty fixtures also explicitly reset zero index. These existing tests use the corrected common fixture:

1. `uses real SHA-256 and emits canonical manifest first, sorted isolated paths and exact committed bytes` — canonical source needed for round-trip semantic preflight; positive chunk path expectation corrected to real UTC partition.
2. `has deterministic ZIP bytes, fixed DOS timestamp and regular-file permissions without ZIP64` — same canonical fixture prerequisite, all metadata assertions retained.
3. `rejects stale or corrupted manifest digests and generation membership` — same canonical fixture prerequisite; all failure assertions retained.
4. `rejects mutated bytes, missing payloads and duplicated iterator results without returning a partial archive` — same prerequisite; intentional post-commit corrupt/missing bytes remain.
5. `rechecks exact bytes during ZIP pass and refuses a source changing after preflight` — same prerequisite; iterator mutation remains.
6. `requires selected identity agreement and does not silently use a UI fallback` — same prerequisite; all identity failures retained.
7. `supports an empty account with zero chunks and excludes unregistered credential paths` — removal now resets exact empty index instead of leaving stale chunk references.
8. `refuses too-deep or oversized actual selected payloads before encoding a ZIP` — same canonical fixture prerequisite; deliberate malformed/oversized payload mutations unchanged.

Other existing preflight/raw-rescue cases unchanged.


### Segment appendix: Transfer/UI contract fixtures and source codec

# Contracts agent notes — increment B

## Scope and integration

- Assigned source files only: `src/lib/data/transfer.test.ts`, `src/test/settings-data.test.tsx`, `src/test/settings-header-import.test.tsx`, `src/test/i18n-structure.test.ts`, new `src/test/archive-fixtures.ts`.
- Source worktree: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.claude/worktrees/agent-a6c8f20c887758804`.
- A first Write to the main-workspace new helper was blocked by the isolation tool; no file was changed. Main then corrected the working-directory instruction and authorized use of this existing tool-created isolated worktree. No additional/nested worktree was created, no escalation attempted, and no runtime/package/spec file was edited.
- Main must copy only these five owned source files to its primary workspace. No commit created by this agent.
- Fixture helper uses genuine fflate ZIP bytes, physical manifest first, remaining ASCII paths sorted, fixed regular-file ZIP metadata, encodeCanonical, exact byte lengths and real SHA-256. Account files, profile/settings/extensions/plugins/imports envelopes, full chunk/index projection, shared directory and device preferences are real canonical FORMAT-1 content. Source fixtures are not written to application persistence. Explicit schemaVersion 1 / recordVersion '1' is in every positive hit fixture; no importer-time legacy normalization.
- Positive JSON imports were replaced with real ZIP inputs. Negative legacy JSON inputs remain rejected, plus an otherwise valid legacy JSON rejection case was added. Pure legacy migration remains exercised explicitly, with test-owned canonical metadata allocation before persistence.
- Confirmation tests require an existing target UUID resolved from readRecord, never source handle authority. Source selection uses source UUID. Incoming source provenance is asserted through importBackups canonical files/shared content.
- Existing hit/identity/profile/settings/games/cards/registration/device-preference preservation, latest-state confirmation, failure atomicity, current-wins/first-new deduplication and no-write preview/cancel assertions are retained.

## Exact adapted and added test ledger

### src/lib/data/transfer.test.ts — 13 existing cases adapted, 7 added

- ADAPTED `exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication` — Explicitly version purely converted fixture hits and confirm by target UUID; retain real export/import roundtrip, exact hit/card preservation, peer isolation, obsolete bytes untouched and descriptor checks.
- ADAPTED `exports the latest typed record rather than a stale UI snapshot, including identity recovery bytes` — Existing current/latest appended hits now explicitly carry canonical hit metadata; latest-authoritative-state and ignored old-browser-byte assertions unchanged.
- ADAPTED `merge retains current identity/profile/games/cards and preserves imported unknown data` — Replace positive legacy JSON with a real canonical source ZIP and canonical shared/export metadata; retain pure merge result, incoming unknown/profile/cards provenance and add exact target UUID and device-preference preservation after confirmation.
- ADAPTED `replace retains current identity/profile/games/cards and preserves imported unknown data` — Replace positive legacy JSON with a real canonical source ZIP and canonical shared/export metadata; retain pure replace result, incoming unknown/profile/cards provenance and add exact target UUID and device-preference preservation after confirmation.
- ADAPTED `rejects unsafe imports without touching existing bytes: null` — Shared persisted current-hit fixture now has explicit canonical metadata; original negative input, rejection and entire-record/revision preservation assertions unchanged.
- ADAPTED `rejects unsafe imports without touching existing bytes: undefined` (table row `[]`, Vitest's original `%j` array-row expansion) — Shared persisted current-hit fixture now has explicit canonical metadata; original negative input, rejection and entire-record/revision preservation assertions unchanged.
- ADAPTED `rejects unsafe imports without touching existing bytes: {"username":"x","hits":[null]}` — Shared persisted current-hit fixture now has explicit canonical metadata; original negative input, rejection and entire-record/revision preservation assertions unchanged.
- ADAPTED `rejects unsafe imports without touching existing bytes: {"schemaVersion":2,"users":{}}` — Shared persisted current-hit fixture now has explicit canonical metadata; original negative input, rejection and entire-record/revision preservation assertions unchanged.
- ADAPTED `rejects unsafe imports without touching existing bytes: {"username":"x","hits":[{"date":"2024-02-30"}]}` — Shared persisted current-hit fixture now has explicit canonical metadata; original negative input, rejection and entire-record/revision preservation assertions unchanged.
- ADAPTED `preserves arbitrary existing unknown values across a confirmed import` — Replace positive JSON preview with a real empty-account ZIP and UUID confirmation, retaining exact opaque-array preservation in return value and persisted target.
- ADAPTED `confirmed merge reads current storage rather than losing hits added after the dialog opened` — Replace positive JSON preview with a real ZIP and explicit canonical concurrent hit/target UUID, retaining exact old/concurrent/import ordering and persisted equality.
- ADAPTED `confirmed import propagates a storage failure without changing current bytes` — Replace positive JSON preview with a real empty-account ZIP and target UUID, retaining real fake-IDB quota rejection plus complete old-record/revision preservation.
- ADAPTED/RENAMED `accepts FORMAT-1 account archives and refuses ambiguous multi-account replacement without source UUID` (previous `accepts legacy maps through the same migration and refuses ambiguous multi-user replacement`) — Accepted ZIP-only format intentionally replaces unsupported legacy acceptance while preserving sole-source success, multi-account ambiguity rejection and explicit source selection; add both UUID choices, reject handle source selector and missing source UUID.
- ADDED `rejects otherwise valid legacy JSON rather than migrating it through the ZIP importer` — Prove a well-shaped legacy record is rejected as non-ZIP with exact current-record/revision preservation.
- ADDED `merges current-wins ids and first-new duplicates in stable ascending timestamp order` — Prove current wins conflicting source content, first identical new duplicate wins, equal-time current/incoming order stays stable, and pure/persisted results match.
- ADDED `rejects conflicting duplicate incoming ids without selecting one or writing any target data` — Prove conflicting source duplicates are whole-import errors, not first-wins salvage, with unchanged current record/revision.
- ADDED `deduplicates logical provenance across ZIP export times and repeated export/import without recursive wrappers` — Distinct ZIP timestamps must not duplicate logical provenance; repeated transfer/export/import cannot grow recursive import wrappers or duplicate hits.
- ADDED `preserves canonical unknown scalar, null, array and presence values in immutable source provenance` — Prove opaque supported values and envelope/payload presence metadata survive confirmation and ZIP re-export without replacing target unknown values.
- ADDED `validates semantic corruption in nonselected accounts before returning a source preview` — Mutate peer account ownership and recompute valid hashes, proving semantic validation covers the whole archive before explicit source selection and writes nothing.
- ADDED `requires an existing explicit target UUID and never adopts the incoming account identity` — Reject handle and missing UUID targets without mutation; successful replace retains target UUID/handle/registration and never creates the source identity.

### src/test/settings-data.test.tsx — 7 existing cases adapted

- ADAPTED `never writes on file selection or cancel; replace requires explicit destructive confirmation` — Shared picker helper now supplies genuine canonical ZIP and checks .zip-only accept; explicit hit metadata retains no-write preview, checkbox gate, identity/profile/game/registration and device-preference preservation.
- ADAPTED `merge deduplicates existing and incoming ids without changing identity or other user data` — Shared ZIP helper intentionally retains identical incoming duplicate IDs, with unchanged old/new dedup and current profile assertions; explicit canonical hit metadata is test-owned.
- ADAPTED `cancel preserves bytes and language switching keeps the open import without losing hits` — Shared source fixture is real canonical ZIP; no-write cancel and language-reactive open dialog/revision assertions unchanged.
- ADAPTED `round-trips exported timestamps and ids while retaining game settings` — Existing real ZIP export/import assertions now compare hits with explicit canonical schema/version metadata, preserving exact IDs/timestamps/game settings.
- ADAPTED `rejects malformed imports before any write: null` — Shared current record uses explicit canonical metadata; original malformed JSON rejection and exact persisted hit/full-record/revision preservation assertions unchanged.
- ADAPTED `rejects malformed imports before any write: {"username":"x","hits":[null]}` — Shared current record uses explicit canonical metadata; original malformed JSON rejection and exact persisted hit/full-record/revision preservation assertions unchanged.
- ADAPTED `rejects malformed imports before any write: {"username":"x","hits":[{"id":"a","timestamp":"bad","date":"2025-01-01"}]}` — Shared current record uses explicit canonical metadata; original malformed JSON rejection and exact persisted hit/full-record/revision preservation assertions unchanged.

### src/test/settings-header-import.test.tsx — 1 existing case adapted

- ADAPTED `header import obeys confirmation and preserves profile, games, identity, and device preferences` — Replace positive legacy JSON file with a real canonical ZIP, explicitly version fixture hits and require .zip-only picker; retain no-alert preview, destructive confirmation and metadata/device-preference preservation assertions.

### src/test/i18n-structure.test.ts — exactly 1 existing case adapted

- ADAPTED `one module CARDS retains all eight records, order and Chinese card strings; sentinels stay empty keys` — Replace ONLY brittle literal `CARDS.slice(startIndex, endIndex)` and `CARDS.forEach` assertions with explicit eight-record count and baseline ID-order assertions. Existing complete-record/order/Chinese-name/description/key equality, module-level single CARDS/type/array checks, cardsPerPage, sentinel empty keys, translation calls, rarity strings and no-uppercase assertions all remain byte-for-byte unchanged. The other two i18n tests are wholly unchanged.

## Targeted checks and actual exits

No whole test suite, final gate sequence, browser, server, network, package install or commit was run by this agent.

1. `npx --no-install eslint src/lib/data/transfer.test.ts src/test/archive-fixtures.ts src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx src/test/i18n-structure.test.ts` — exit **0**. Raw stdout/stderr `contracts-targeted-lint-1.log`; only pre-existing stale baseline-browser-mapping advisory.
2. `npx --no-install vitest run src/test/i18n-structure.test.ts` — exit **0**, **1 file / 3 tests passed**. Raw stdout/stderr `contracts-targeted-i18n-1.log`.
3. `npx --no-install tsc -p tsconfig.app.json --noEmit --incremental false` — exit **0** against isolated baseline runtime plus assigned changes. Raw stdout/stderr `contracts-targeted-types-1.log`. This verifies test/helper types, not the later integrated importer/runtime.

Raw logs and `contracts-commands.jsonl` are under this worktree's ignored `node_modules/.cache/impl-evidence-b/`. Runtime-dependent transfer/settings tests were not run against the deliberately deferred isolated baseline; main will run targeted checks after integrating its importer/canonical/UI changes. Those future results are not claimed here.

## Additional bounded task — import source codec

Main subsequently assigned ONLY new `src/lib/storage/source-codec.ts` and `src/lib/storage/source-codec.test.ts`. This is STORAGE runtime responsibility and must count in the ADR storage budget, not pure model accounting. No existing source file was edited for this additional task. Both files are in the same worktree listed above.

- APIs: async `encodeImportSource`, async `decodeImportSources`, synchronous `validateLogicalSource`, synchronous `sourceKey`; type-only ImportSource re-export from main-owned `./imports`.
- Direct logical sources stay unchanged when canonical source <=12 MiB AND a representative full import envelope stays depth<=64. Deep or large sources use deterministic shallow wire `{accountId,codec:'run-json-1/file-strings',files:{relativePath:canonicalJSONstring},shared:{path:canonicalJSONstring}}`, preserving original file depth budgets independently.
- Wire bytes split into <=8 MiB binary pieces. Six-field marker is exactly `{accountId,codec:'run-json-1/base64-parts',sourceDigest,part,totalParts,data}`; digest is real SHA-256 of the entire canonical shallow wire. Max parts32 and transport source256 MiB; each ordinary persisted marker payload stays under16 MiB.
- Decoder requires complete adjacent ordered unique groups and owner/digest/count agreement, canonical base64 grammar/padding bits and binary byte caps before decoded allocation, exact full SHA, strict JSON, per-original-file depth64 and flat logical shape/registered relative/shared paths. Missing or conflicting pieces never salvage. Original deep sources are opaque provenance, not adopted active semantics. `sourceKey` uses shallow wire for depth-safe logical dedup.
- Remaining envelope limitation: shallow file-string wire escapes original JSON and can exceed256 MiB even if original archive was below256 MiB; base64 adds ~4/3 on later export. The codec refuses over-cap transport rather than truncate. Normal export must still enforce total256 MiB and refuse if not reimportable. This is a measured-format headroom/representation limitation, not a promise to roundtrip every maximally sized archive.
- Main integrated these two files, then reported integrated `npx tsc -b` exit2 for const-fail control-flow narrowing (unknown value at shape check lines26/27/29) and sourceKey's then-too-specific argument. Main owns correcting its copy with `return fail(...)` and `sourceKey(value:unknown)` assertion. This agent did not claim a codec isolated compiler pass because main's new `./imports` module is not in this isolated baseline.
- A read-only `git -C <worktree> diff --stat` command was tool-denied, not executed, with no process exit; no bypass/retry. It is not necessary for functionality.

### Exact new source-codec tests — 51 cases

All tests are new in `src/lib/storage/source-codec.test.ts`; none adapted/deleted/skipped.

- `keeps ordinary logical sources unchanged and preserves scalar/null/array/presence values and source order` — Preserve identity for ordinary sources, supported opaque values and stable multiple-source ordering.
- `keeps exact 12 MiB canonical equality inline and fragments the next byte into <=8 MiB binary parts` — Exercise real boundary bytes, emitted marker lengths, real SHA and reconstruction.
- `joins binary parts before UTF-8 decoding so a split multibyte character remains exact` — Verify UTF-8 is decoded only after byte reassembly.
- `preserves adjacent source ordering without merging distinct owners or flattening opaque payload arrays` — Keep source isolation and source-order semantics across inline/fragmented inputs.
- `rejects missing, duplicate, reordered, interleaved and repeated fragment groups instead of salvaging them` — Reject all incomplete/ambiguous grouping variants, without partial success.
- `rejects conflicting digest, owner, totalParts or out-of-range fragment metadata` — Reject mismatched fragment agreement and owner/source disagreement.
- `rejects malformed fragment marker %j` (15 rows: codec other-codec; codec undefined; digest bad; uppercase digest; invalid account UUID; part -1; part0.5; part string0; totalParts0; totalParts33; totalPartsMAX_SAFE_INTEGER; totalParts string2; data42; data empty; extra unknownMarkerField) — Strict marker shape/version/count/data metadata with bounded part count.
- `rejects invalid or noncanonical base64 %j before source parsing` (7 rows: `*AAA`, `A===`, `AA=A`, `A`, `AAAA\\n`, `AB==`, `AAB=`) — Reject alphabet/padding/length/trailing-whitespace/nonzero-pad-bit aliases.
- `rejects corrupted part bytes even when the base64 grammar is valid` — Real digest prevents accepting altered but decodable transport.
- `rejects encoded and decoded part caps before allocating an oversized binary source` — Check encoded-length cap and decoded8MiB+1 case whose base64 encoded length equals8MiB.
- `rejects oversized inline provenance instead of silently storing an unexportable ordinary payload` — Ordinary source cannot bypass16MiB via inline form.
- `rejects nonflat or unregistered logical source %j` (13 rows: null; array; extra importBackups wrapper; invalid account UUID; array files; array shared; imports source path; imports index path; dotdot relative path; zero run sequence; unknown plugin path; shared accounts directory path; shared dotdot path) — Logical shape and flat registered-path whitelist enforced for both inline and correctly hashed fragments.
- `rejects unsupported JSON values and depth over 64 for inline and fragmented source documents` — No undefined/invalid deeply nested data acceptance.
- `rejects reassembled invalid UTF-8, duplicate keys and invalid source shapes despite matching SHA-256` — Integrity never substitutes for JSON/schema validation.
- `rejects invalid original file strings inside a correctly hashed shallow wire document` — Independently reject original-file depth65, duplicate keys, nonfinite numbers, NUL and nonstring file-string values.
- `preserves exact depth-64 original files through one-part wire encoding without spending wrapper depth` — Accepted maximal-depth original data preserves exactly and too-deep originals reject.
- `fragments a source whose own depth fits but the required import envelope would exceed depth 64` — Guard the extra persisted-envelope nesting level.
- `creates deterministic source keys independent of object-key order and retains array order` — Stable depth-safe logical dedup key, without changing array semantics.
- `validates a canonical source after binary reassembly without accepting nested transport wrappers` — Reconstructed source remains flat and canonical JSON-compatible.

### Additional targeted commands/exits

4. `npx --no-install eslint src/lib/storage/source-codec.ts src/lib/storage/source-codec.test.ts` — actual exit **0**; raw `source-codec-targeted-lint-1.log` (before final single added file-string rejection test).
5. `npx --no-install vitest run src/lib/storage/source-codec.test.ts` — actual exit **0**, **1 file/50 tests passed**; raw `source-codec-targeted-tests-1.log`.
6. Same targeted Vitest command after the final added correctly-hashed file-string rejection test — actual exit **0**, **1 file/51 tests passed**; raw `source-codec-targeted-tests-2.log`.

No codec whole-suite/full-gate/compiler run by this agent. Main owns integrated compiler/runtime evidence and fixes in its copy. Source edits stopped on main's request; the final additional test must be recopied if main integrated before this last test arrived.



### Segment appendix: Canonical boundaries and ownership

# Canonical agent round-B evidence notes

## Ownership and integration

Agent source delivery path: /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.claude/worktrees/agent-a5b806237b57eed4d.
Runtime delivered: src/lib/storage/chunks.ts, snapshot.ts, envelope-validation.ts (new), tree-validation.ts (new).
Tests delivered: src/lib/storage/canonical-validation.test.ts (new), ownership.test.ts, core.test.ts, integrity-commands.test.ts, byte-boundary.test.ts, selective.test.ts, platform-failure.test.ts, publication.test.ts, consumers.test.ts.
No recovery.ts, transfer/import tests, package, lock, spec, configuration or commit changes made by this agent. No shared pure files changed or storage runtime hidden there. Main integrated runtime early and owns subsequent cross-realm byte handling, command corruption/queue boundaries, public exports and other integration changes. Do not overwrite main runtime from agent copies.

## Canonical implementation

Storage validateHit requires schemaVersion === 1 and typeof recordVersion === 'string' matching /^[1-9][0-9]*$/, plus supported run-json-1 values, valid id/time. Incoming malformed metadata is rejected, never allocated, normalized or rewritten. Shared pure run selectors remain independent and legacy-shape compatible.
Strict reusable envelope helper verifies account UUID/ownership/schema/version/times and canonical supported values. Hydration validates canonical identity/profile/settings/games while leaving history selective.
Tree verifier exports validateCanonicalTree(manifest, complete manifest-included map, options?) and lazy validateCanonicalFiles(manifest, async reader, options?). All exact payload length/SHA checks precede payload semantic parsing, including nonselected accounts. Lazy semantic reads recheck hash/length to prevent changed bytes between passes. Whole audit verifies manifest/directory/file membership, schema/modules/versions, UUID/account/registration, chunk ownership/partition/sequence/caps/ordinals/hit metadata, complete exact index projection and descriptors, immutable import index/source ownership/id/digest/membership/dedup, supported unknown values/presence. Only import mode allows canonical-identical repeated hit ids; conflicting copies reject. Imported hit recordVersions remain authority scoped, not limited to local manifest revision.
Import sources outer envelope capped at 16 MiB; main chose source-codec segmentation from contracts agent to preserve supported large original provenance and JSON depth. Both tree verifier and readFullFrom call decodeImportSources; readFullFrom exposes reconstructed importBackups without recursive wrappers. Ordinary append/statistics/log paths do not call the full tree verifier.

## Exact adapted tests and reasons

All adaptations below add explicit schemaVersion:1/recordVersion:'1' to positive runtime hit literals (and exact expected hits where asserted), not runtime normalization; original behavioral assertions remain unchanged. Pure migration/legacy ignored-browser fixtures deliberately remain unchanged.

### src/lib/storage/core.test.ts
- 'reuses unrelated blobs and changes only one chunk, own index and manifest on Run' — positive append fixtures and exact hit equality now carry required canonical metadata; blob-sharing assertions unchanged.
- 'preserves identity, registration and device provenance across rename and reload' — positive append fixture now canonical; identity/registration/device checks unchanged.
- 'projects exact timestamps and recent fifty without statistics fetching history chunks' — loop fixtures now canonical; projection/selective statistics assertions unchanged.
- 'rejects oversized and unsupported values with unchanged pointer and permits safe retries' — oversized and valid-retry hits now canonical so oversized failure still exercises byte limit, not missing metadata.
- 'keeps plugin patches atomic and monotonic file versions while sharing history' — seed append now canonical; plugin/history/fileVersion checks unchanged.
- 'exports the latest pinned selected account without another account or credentials' — both account append fixtures now canonical; selected latest export/isolation assertions unchanged.
- 'allows count equality, rolls next hit, and appends backdated months without touching completed chunks' — all 4,999 tail hits plus equality/rollover append hits now explicitly canonical; count/rollover/reuse assertions unchanged.

### src/lib/storage/integrity-commands.test.ts
- 'rejects duplicate ids across changed timestamps and UTC partitions without changing current' — append and duplicate-attempt literals canonical, preserving duplicate-id diagnostic/unchanged-pointer/safe-retry assertions.
- 'rejects historical ids outside recent fifty using the index without fetching old chunks' — seed/recent/duplicate/new-partition literals canonical; historical chunk-read spy assertions unchanged.
- 'quarantines correctly rehashed false timestamp, bounds and recent projections before publication' — seed hit canonical; all forged projections/quarantine/old-pointer assertions unchanged.

### src/lib/storage/byte-boundary.test.ts
- 'allows exactly one million UTF-8 envelope bytes and rolls the next byte without rewriting the completed tail' — initial and next hit explicitly canonical; measured padding still produces exact 1,000,000-byte equality and next-byte rejection; all assertions retained.

### src/lib/storage/selective.test.ts
- 'hydrates no history on reload and fetches only recent-reference chunks for the log view' — monthly append literals canonical; all zero-history hydration/selective recent-read assertions unchanged.

### src/lib/storage/platform-failure.test.ts
- 'blocks a verified write without SubtleCrypto and preserves current for a safe retry' — unverified and retry hits canonical so failure still specifically exercises missing WebCrypto.
- 'restarts an expired pinned read after GC and reports missing generations as restartable' — competing append literals canonical; real GC/lease restart assertions unchanged.

### src/lib/storage/publication.test.ts
- 'rejects a command if the pointer transaction aborts after put success, without publishing a snapshot' — attempted and retry hits canonical so real pointer-abort path remains exercised; all snapshot/reference/notification assertions unchanged.
- 'preserves an accepted __proto__ handle, its UUID and hits across reload' — append and exact expected hit canonical; prototype-safe identity/UUID/reload assertions unchanged.
- 'refuses to roll a newer immutable snapshot back when older hydration finishes later' — newer append literal canonical; snapshot referential equality/revision fence assertions unchanged.

### src/lib/storage/consumers.test.ts
- '%s migrates on load and preserves extras and peers on save/delete' (both LocalStorageAdapter and CloudStorageAdapter parameter cases) — seedRecord hit and exact expected stored hit canonical; ignored obsolete browser fixture remains unchanged.
- 'auth data writes still reject while adapter saves still report failures without changing bytes' — seedRecord hit canonical; quota/auth/adapter/old-pointer preservation assertions unchanged.
- 'preserves credential checking, passwordless demo entry, and refuses registration over an existing record' — seedRecord hit canonical; identity/credentials/demo/registration assertions unchanged.

No preservation.test.ts or shared pure test adaptation was necessary. Existing ownership test assertions were retained; import of dirname supports added dependency checks.

## Exact added tests and reasons

### src/lib/storage/canonical-validation.test.ts
- 'rejects missing or malformed hit metadata in validators and public append without publishing or normalizing' — exercises missing/wrong schema and absent/numeric/zero/negative/leading-zero/fraction/whitespace versions at all public canonical boundaries, unchanged pointer/input and valid retry.
- 'preserves canonical hit versions and supported scalar array null and presence values exactly' — proves high authority-scoped decimal version and unknown values survive append/read/full-tree audit without normalization.
- 'rejects unsupported unknown hit values and invalid id or timestamp facts without changing current' — proves strict JSON/Unicode/NUL/Date-range/integer-time/opaque-value rejection without publication.
- 'rejects malformed chunk entity metadata even when its hits and descriptor are valid' — closes chunk envelope schema/version/time/ownership and persisted-hit metadata gaps.
- 'verifies all payload hashes before semantic parsing including nonselected accounts' — combines rehashed bad JSON with corrupted nonselected history and asserts raw integrity rejection occurs first.
- 'rejects rehashed malformed account metadata registration profile plugin and settings ownership' — ensures valid hashes cannot authorize malformed entity metadata/registration/profile/plugin or device settings in account settings.
- 'rejects exact map membership descriptor schema and unlisted account disagreements' — covers missing/extra files, malformed descriptor metadata and orphan account UUID paths.
- 'rejects rehashed index projections ordinal gaps partitions and malformed canonical hit metadata' — checks authoritative chunk/index exact projection agreement after valid rehashing.
- 'permits identical incoming duplicate ids only in import mode and rejects conflicting copies' — preserves ADR first-new import dedup contract while keeping local/recovery unique and refusing conflicting source duplicates.
- 'validates source index membership digest ownership dedup and nonrecursive logical provenance' — covers supported source unknown/presence values and source-envelope/id/digest/owner/orphan/duplicate/wrapper rejection.
- 'checks lazy file bytes again before semantics and never retains or requests unrelated history' — verifies integrity recheck between lazy passes and reader requests exactly listed file paths. The test observes requested membership; bounded history retention is an implementation property, not an instrumented heap claim.

### src/lib/storage/ownership.test.ts
- 'keeps transfer and features on the public storage facade and forbids cross-feature deep imports' — extends architecture ownership to relative static/dynamic imports through public storage/feature facades.
- 'keeps shared canonical models codecs and selectors independent of persistence and application runtime' — prevents storage/runtime implementation migration into pure shared files.

Added: 11 canonical cases + 2 ownership cases. Adapted: 20 exact test titles (21 instantiated cases because adapter parameter test runs twice). No assertions deleted/skipped/weakened.

## Commands and actual exits

- Initial attempted Bash command: pwd; git -C /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a status --short; ls /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.git — tool permission denied before shell execution; no process exit code exists. No permission bypass/retry.
- No test/compiler/lint/build process executed by this agent. Main performs targeted checks and records raw command output/exits. Main messages reported canonical 11 tests pass; this is coordinator-reported, not independently run here.
- Read/Edit/Write/Grep tools performed source delivery and line accounting; these are not shell processes and have no numeric process exits.
- Final full gates and commits are main-owned; none run here.

## Authored size accounting (Grep line counts before later main integration edits)

Runtime: chunks.ts 139 lines (baseline 109, +30); snapshot.ts 147 (baseline 134, +13); envelope-validation.ts 24 new; tree-validation.ts 149 new. Authored total 459 lines across these four files, +216 net against baseline. Each responsibility file remains below ADR 200–250 line ceiling. Main must report aggregate storage runtime and any final integrated count changes; no aggregate-budget compliance claim made here.
Tests: canonical-validation.test.ts 217 new; ownership.test.ts 48 (baseline 26, +22); other seven fixture files retain baseline line counts (core169, integrity67, byte26, selective36, platform42, publication166, consumers107). Tests are not compressed or excluded to meet runtime budgets.

## Remaining coordination notes

Main integrated runtime before fixture tests and fixed cross-realm Uint8Array identification (real TextEncoder/fake-IDB bytes) in main only. Main command base verification distinguishes persisted canonical corruption from caller validation and does not publish fresh snapshots before failed writes, preserving existing referential snapshot assertions. Source codec segmentation implementation/tests belong to contracts agent. Recovery verifier/restore belongs to recovery agent. No claim of independent acceptance or complete final gates.


### Segment appendix: Independent tab and GC faults

# Tab/GC test agent evidence — round B

## Scope and integration paths

Coordinator corrected the initial main-only instruction after tooling isolation clarification: edits belong in the already-created internal worktree, with main integration performed by the coordinator. No new/nested worktree was created. Main workspace packet, ADR0006/0007, REPORT.md and publication/recovery/runtime/IDB/queue tests were read only. No runtime, package, lock, spec, configuration, baseline test, browser, network, server or commit changes were made.

New source (only two assigned test files):
- `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.claude/worktrees/agent-aa99046165bc978ce/src/lib/storage/cross-tab.test.ts`
- `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.claude/worktrees/agent-aa99046165bc978ce/src/lib/storage/gc-fault.test.ts`

Intended integrated destinations are the same relative paths under `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a`.

## Exact new tests and one-line reasons

`src/lib/storage/cross-tab.test.ts` — 5 test cases:
1. `rebases a queued append after a real CAS conflict, preserving its frozen id, time and canonical extras` — independent module command queues and DB connections force a real revision conflict; original intent survives mutation/rebase and both readers converge without advisory messages.
2. `reuses the winning UUID, registration, profile and device identity when same-handle first-account commands race` — exercises actual absent-pointer creation retry, not only low-level candidate CAS; losing UUID/profile cannot replace the winner.
3. `rebases different-handle first-account commands into two isolated UUID trees without replacing the winning device` — actual first-account retry retains the preallocated losing UUID as a distinct second account and keeps winning installation identity.
4. `keeps a paused append bound to its UUID when another tab renames the handle and creates a replacement` — handle reuse during a queued retry cannot retarget a hit to the new account.
5. `rejects the losing duplicate-id intent after rebase and leaves both independent queues usable` — a conflicting duplicate discovered on retry leaves the winner untouched and does not poison either tab's later safe commands.

`src/lib/storage/gc-fault.test.ts` — 6 expanded cases (one three-row parameterization + three individual tests):
1. `rolls back every store when GC aborts after a successful generations delete, preserving roots, leases and exact quarantine bytes` — real queued healthy roots, actual delete success then transaction abort must roll back every store, including aged raw/quarantine evidence.
2. `rolls back every store when GC aborts after a successful blobs delete, preserving roots, leases and exact quarantine bytes` — same atomic fault boundary after actual blob deletion, not a synthetic rejected Map operation.
3. `rolls back every store when GC aborts after a successful pins delete, preserving roots, leases and exact quarantine bytes` — expired-pin deletion failure cannot partially collect otherwise reachable data/evidence.
4. `does not turn successful queued publication into a failure when its maintenance GC aborts` — saved receipt/current/history remain authoritative even when the command-triggered maintenance transaction aborts.
5. `keeps an in-progress reader generation and all referenced bytes live while another connection collects newer committed history` — a real active operation/pin across separate IDB connections protects an old complete tree beyond the normal predecessor window; release then permits collection.
6. `does not extend a local reader lease when renewal put succeeds but its transaction aborts` — renewal cannot advance in-memory or stored expiry before completion, and later expired-reader collection is itself transaction-atomic.

Total planned additions: **2 files / 11 test cases**. Baseline low-level first-candidate CAS, expired-read restart and metadata-only GC reachability cases are not copied. New races exercise actual `createAccount`/`appendHit`/`renameAccount` queued commands with isolated import graphs from `vi.resetModules()`.

## Integrity/fault methodology

All tests use a fresh real `fake-indexeddb` `IDBFactory`, real transactions and Node `webcrypto`. Race rendezvous wraps `SubtleCrypto.digest` call-through, starts the real digest before pausing its completion and never substitutes hash values. Each tab owns its own queue/snapshot/initialization/IDB handle. BroadcastChannel is unavailable intentionally, showing notification-independent CAS/reconciliation safety. Every hit fixture explicitly contains `schemaVersion: 1` and `recordVersion: '1'`; unknown null/array/non-ASCII JSON values are asserted. GC evidence includes exact deliberately invalid byte sequences, and faults are injected only after real request success. Recovery/raw-byte assertions do not parse damaged evidence.

## Targeted command attempts, outcomes and limits

1. Read-only `cd /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a && date -u '+%Y-%m-%dT%H:%M:%SZ'` — executed, exit **0**, output `2026-11-16T04:02:19Z`.
2. From existing isolated worktree, attempted `mkdir -p node_modules/.cache/impl-evidence-b && npm test -- --run src/lib/storage/cross-tab.test.ts > node_modules/.cache/impl-evidence-b/tab-cross-01.log 2>&1; result=$?; printf '%s\\n' "$result" > node_modules/.cache/impl-evidence-b/tab-cross-01.exit; printf 'Targeted cross-tab test exit %s\\n' "$result"; exit "$result"` — **Bash permission denied before execution; no process exit, no test stdout and no passing result exist**. The requested log/exit files were not created by that denied command. Coordinator notified immediately; no retry, escalation or routing of the blocked command was requested.

No other Bash, targeted test, compiler, lint, whole-suite/full-gate, browser or commit command was attempted. Source has static review only and is explicitly **unexecuted**. Coordinator owns any separately authorized integration/final validation, not an agent claim of acceptance. No independent browser durability/power-loss guarantee is implied by these source additions.

## Coordination

- Canonical agent `a5b806237b57eed4d` informed of explicit hit metadata and queued-append fixture requirements.
- Recovery agent `a5a3a4051e3cdbe7c` informed of test ownership and GC fault coverage; no edits overlap recovery.test.ts or runtime files. Agent reports restore adds a new verified generation and quarantine-parent retention. These tests avoid coupling to restore-specific API names.
- Main handles import/restore fullValidation runtime changes and all integration/commit/report work.


### Segment appendix: Recovery, restore and UI

# Recovery agent implementation evidence (round B)

## Scope and integration

Authored only assigned recovery/runtime/UI/locales/Settings files and own recovery tests. No package/lock/spec/version/network/browser/server/full-gate/commit operations. Parent owns final integration and validation; this is not independent acceptance.

Original parent assignment said main workspace only. Read operations succeeded there, but direct Edit was rejected by isolation. Parent clarified its assignment error: packet permits internal segments under this clone and the tool-created isolated directory is authorized. All actual edits were made under `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.claude/worktrees/agent-a5a3a4051e3cdbe7c`; parent integrated them into main. No nested worktree was created and no isolation or permission setting was changed.

Runtime/UI files frozen and parent notified before final integration. Parent subsequently owns its compile/locale-compatibility fixes; do not overwrite main files from the frozen isolated versions.

## Implemented behavior

- `recovery.ts` delegates full canonical audit to the shared `validateCanonicalTree` after verifying exact immutable blob hashes/lengths/descriptor metadata, complete map and generation/manifest pointer agreement. Verification remains explicit recovery/transfer work, not normal render-time all-history hydration.
- `RecoverySnapshot.readableTree` exposes labeled read-only generation/revision and account/count summary, never publishes an older writable snapshot.
- `readRecoveryRecord(generationId, accountId)` pins and fully verifies before returning exact older account data for explicit read-only details.
- `restoreRecoveryGeneration(generationId, confirmed, expectedCurrent)` requires explicit consent, rejects stale pointer consent, rechecks older committed source, serializes through the normal per-tab command queue, builds a completely new candidate and uses existing prepare/readback verification/CAS publication primitives.
- Restore advances generation/file/envelope versions above all retained known generation/blob counters; hit authority-scoped versions and all hit values remain exact, including versions much larger than local counters. `control/device-id` is preserved and the new manifest uses that installation identity.
- Restore preserves all newer committed generation evidence as quarantine companion roots, leaves original committed generation records/maps/blobs untouched and makes GC retain the companion's original parent. No silent promotion or evidence deletion.
- Runtime blocks later writes after discovered committed read corruption. Failed initialization can retry following explicit restore; boot failure mounts recovery instead of writable routes. GC failure is maintenance only, not a false corrupt-data startup failure.
- Recovery UI shows blocked status, labeled older summary and on-demand exact read-only JSON details, explicit restore checkbox and awaited restore, original-byte rescue even when no healthy generation exists, and inaccessible-byte diagnosis when IndexedDB cannot open. Busy ref fences duplicate recovery actions. No broad redesign.
- Settings importer uses ZIP selection, source preview without target-as-source confusion, explicit hydrated target UUID and awaited confirmation before alerts/reload. Settings warning renders safe text instead of interpolating archive handles through HTML. Actual header pickers/handlers live in Dashboard (parent-owned), not SettingsMenu; parent notified.
- Added three-locale recovery/ZIP/error/dialog strings. Parent reported strict baseline locale parity contracts and will retain baseline strings under existing keys while adding format-1-specific keys for new behavior; do not weaken baseline parity tests.

## Exact adapted tests and reasons

`src/lib/storage/recovery.test.ts` retains all 14 original cases and assertions. Shared `fixture` explicitly constructs canonical test hit metadata (`schemaVersion: 1`, `recordVersion: '1'`) before append; this is fixture construction, not runtime normalization. It affects these exact cases because they use the helper:

1. `verifies hashes, ownership, unsorted timestamp ties, all chunks and exact index projection` — explicit canonical fixture metadata required by accepted strict hit boundary.
2. `labels the previous verified tree without promoting it and rescues corrupt original bytes` — same canonical fixture construction; original byte/pointer checks retained.
3. `rejects a correctly rehashed but semantically false timestamp projection` — same canonical fixture construction; exact authoritative-projection rejection retained.
4. `rejects cross-chunk duplicate hit ids even when every digest and projection agrees` — same canonical fixture construction; exact rejection message updated to centralized strict index validator (`Duplicate hit identity or invalid run index hit ids in ordinal order.`), with all forged-index/digest/duplicate assertions retained.
5. `rejects self-consistent rehashed metadata corrupted after publication with the wrong ownership` — same canonical fixture construction; exact rejection message updated to shared envelope validator (`Invalid canonical account envelope or ownership.`), ownership failure still mandatory.
6. `remains read-only with no healthy generation and preserves staged/quarantined raw evidence` — shared canonical zero-hit fixture; original raw/pointer assertions retained.
7. `diagnoses missing references while returning other accessible exact bytes` — shared canonical zero-hit fixture; original exact inaccessible-reference and remaining-byte assertions retained.
8. `rescues accessible blobs despite a damaged generation map entry` — shared canonical zero-hit fixture; GC rejection/evidence-count assertions retained.
9. `preserves both original paths when a generation aliases immutable raw bytes` — shared canonical zero-hit fixture; original alias-byte assertions retained.
10. `keeps generation zero without inventing predecessors` — shared canonical zero-hit fixture; exact generation/blob equality assertions retained.

The other four original cases use their own low-level metadata fixtures or unavailable-IDB setup and are textually unchanged apart from file-wide imports/line shifts:
- `visibly rejects when IndexedDB cannot open instead of fabricating an empty rescue`
- `retains current/two predecessors, live readers/base pins, young staging and quarantine; deletes only unreachable evidence`
- `serializes GC behind an already-running writer and sees its new current/pin roots`
- `does not collect on absent or inconsistent current and atomically rolls back failed GC`

## Exact new storage tests (7)

`src/lib/storage/restore.test.ts`

1. `exposes verified older full data read-only while damaged current blocks login and mutation` — real fake-IDB/WebCrypto proves older data accessor does not promote, writes reject while blocked, pointer remains damaged current.
2. `confirmed recovery commits a new verified generation without version/device rewind or evidence deletion` — new verified generation, monotonic file versions, exact unknown/presence/hits/profile/registration, huge hit version, device identity, original damaged bytes and survival after four healthy successors plus GC.
3. `requires explicit confirmation and rejects stale preview consent without publishing` — false confirmation and current movement cannot authorize recovery; concurrent committed hits remain.
4. `failed recovery staging never changes current or deletes the damaged original bytes` — real fake-IDB staging quota fault leaves current and damaged generation bytes exact.
5. `no healthy generation remains blocked but produces a recovery-kind ZIP of accessible exact originals` — actual fflate ZIP rescue preserves damaged originals and labels non-importable recovery kind without clearing blocked state.
6. `corrupt newly requested history blocks subsequent writes without publishing an empty replacement` — latent history corruption discovered on explicit read blocks later account creation, pointer unchanged.
7. `rechecks the older tree and refuses a now-corrupted source at confirmation` — a healthy preview is not trusted after source bytes become corrupt.

## Exact new UI tests (8 expanded cases)

`src/ui/RecoveryPanel.test.tsx`

1. `labels older recovery read-only and requires explicit consent in en_us`
2. `labels older recovery read-only and requires explicit consent in zh_cn`
3. `labels older recovery read-only and requires explicit consent in zh_tw`
   - Shared table reason: real IDB damage plus actual WebCrypto verification, localized read-only label/account count, checkbox gates publication, awaited new-generation restore and ready state only after commit.
4. `read-only account inspection exposes exact older hit details without promotion or save controls` — exact older hit is visible in noneditable details, newer hit absent, pointer remains damaged and storage blocked.
5. `Login renders recovery rather than allowing an empty account over damaged current` — blocked login has recovery controls, no create/login form and no session entry.
6. `App boot failure exposes recovery and raw rescue without mounting writable routes` — actual corrupt startup goes to recovery, rescue available, no Run route mount.
7. `no healthy generation still offers actual rescue download without a restore action` — actual bounded rescue ZIP download MIME, no checkbox/restore, blocked pointer retained.
8. `IndexedDB unavailable explicitly says original bytes are inaccessible and disables rescue` — actual unavailable platform path has explicit localized inaccessible-byte diagnosis and no false download/restore.

All new storage/UI cases use the existing global fresh fake-indexeddb factory and real Node WebCrypto setup; no Map persistence or stub hashes. DOM download and unrelated animejs rendering are mocked only for UI effects, not persistence/integrity.

## Commands and actual outcomes

1. Attempted Bash `pwd; git -C /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a status --short; ls /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/.git` — permission denied by tool, NOT executed, no process exit.
2. Attempted direct main-workspace Edit to `src/lib/storage/state-model.ts` — isolation rejected; no file change. Parent clarified internal isolated segment scope before any actual edit.
3. Attempted Bash `./node_modules/.bin/vitest run src/lib/storage/recovery.test.ts` from the assigned isolated directory — permission denied by tool, NOT executed, no process exit. No escalation or alternate executor attempted; parent informed.
4. Invoked `vercel:react-best-practices` checklist after multi-TSX edits — loaded; manually reviewed stable subscriptions, async effect cancellation, safe text rendering, imperative busy fencing and no writable state promotion.

No process command ran successfully in this agent. Parent's independently assigned targeted checks and final gates must be recorded with their own exact commands/exits/raw evidence, not inferred from my source review. Parent reported an intermediate integrated recovery targeted run with 42 passing tests and a TypeScript exit 2 caused by direct decode casts; parent applied generic decoded helpers in main. Parent later reported RecoveryPanel 8 passed and locale parity 6 failed; parent owns preserving baseline string contracts under old keys and adding new format-1 keys. These are parent-reported observations, not agent-executed evidence.

## Budget/limitations

Recovery responsibility shrank by replacing duplicate tree validation with reusable shared validation. New restore stays below the per-responsibility 200–250 line budget; RecoveryPanel below 150. Existing Settings components retain their pre-existing target overrun. Parent computes authoritative integrated line/aggregate inventory.

At exact 1,000,000-byte chunk equality, increasing a local envelope-version digit could make a restore candidate exceed the canonical chunk cap; full candidate validation must refuse safely rather than truncate or bypass the cap. Original evidence remains. Explicit full-record recovery viewing is a user-requested transfer/recovery path, not selective render hydration. No browser durability, eviction, power-loss or independent acceptance claim.


## 6. Actual command and verification history

Main implementation checks were focused file groups/compiler checks only; the whole test suite, whole ESLint and build occurred **only once**, in the final sequence. Main commands below are copied from the actual evidence ledger with exits, including failed attempts. The wrapper captures raw stdout+stderr into uniquely created files and records actual child exit; its outer final orchestration intentionally continues all four commands even after failure and is **not** itself proof of gate success. `FINAL-STARTED` prevents an accidental second sequence.

- **targeted-01-typescript** — exit **2**, start `2026-11-16T04:18:08.525Z`, raw `targeted-01-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-02-typescript** — exit **2**, start `2026-11-16T04:18:48.359Z`, raw `targeted-02-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-03-import-export-tests** — exit **1**, start `2026-11-16T04:18:50.140Z`, raw `targeted-03-import-export-tests.log`:
  ```text
  npx vitest run src/lib/data/transfer.test.ts src/lib/data/archive.export.test.ts src/lib/data/archive-import.test.ts src/lib/storage/source-codec.test.ts
  ```

- **targeted-04-typescript** — exit **0**, start `2026-11-16T04:19:27.787Z`, raw `targeted-04-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-05-transfer-tests** — exit **0**, start `2026-11-16T04:19:29.561Z`, raw `targeted-05-transfer-tests.log`:
  ```text
  npx vitest run src/lib/data/transfer.test.ts src/lib/data/archive.export.test.ts
  ```

- **targeted-06-storage-tests** — exit **1**, start `2026-11-16T04:20:02.916Z`, raw `targeted-06-storage-tests.log`:
  ```text
  npx vitest run src/lib/storage/canonical-validation.test.ts src/lib/storage/ownership.test.ts src/lib/storage/core.test.ts src/lib/storage/integrity-commands.test.ts src/lib/storage/byte-boundary.test.ts src/lib/storage/selective.test.ts src/lib/storage/platform-failure.test.ts src/lib/storage/publication.test.ts src/lib/storage/consumers.test.ts src/lib/storage/cross-tab.test.ts src/lib/storage/gc-fault.test.ts
  ```

- **targeted-07-typescript** — exit **2**, start `2026-11-16T04:21:46.887Z`, raw `targeted-07-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-08-recovery-ui-tests** — exit **0**, start `2026-11-16T04:21:48.707Z`, raw `targeted-08-recovery-ui-tests.log`:
  ```text
  npx vitest run src/lib/storage/recovery.test.ts src/lib/storage/restore.test.ts src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx src/ui/Login.storage.test.tsx src/lib/storage/publication.test.ts src/lib/storage/platform-failure.test.ts src/lib/storage/ownership.test.ts
  ```

- **targeted-09-typescript** — exit **0**, start `2026-11-16T04:22:52.753Z`, raw `targeted-09-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-10-recovery-panel** — exit **1**, start `2026-11-16T04:22:54.559Z`, raw `targeted-10-recovery-panel.log`:
  ```text
  npx vitest run src/ui/RecoveryPanel.test.tsx src/test/i18n-structure.test.ts src/lib/i18n/parity.test.ts src/lib/i18n/extension.test.tsx
  ```

- **targeted-11-locale-import-ui** — exit **0**, start `2026-11-16T04:29:36.856Z`, raw `targeted-11-locale-import-ui.log`:
  ```text
  npx vitest run src/lib/i18n/parity.test.ts src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx src/ui/RecoveryPanel.test.tsx
  ```

- **targeted-12-runtime-import-audit** — exit **0**, start `2026-11-16T04:34:02.498Z`, raw `targeted-12-runtime-import-audit.log`:
  ```text
  npx vitest run src/lib/data/transfer.test.ts src/lib/storage/canonical-validation.test.ts src/lib/storage/selective.test.ts src/lib/storage/publication.test.ts src/lib/storage/cross-tab.test.ts src/lib/storage/gc-fault.test.ts src/lib/storage/platform-failure.test.ts
  ```

- **targeted-13-typescript** — exit **0**, start `2026-11-16T04:34:04.614Z`, raw `targeted-13-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-14-changed-lint** — exit **0**, start `2026-11-16T04:34:30.668Z`, raw `targeted-14-changed-lint.log`:
  ```text
  npx eslint src/lib/data/archive-import.test.ts src/lib/data/archive-import.ts src/lib/data/zip-preflight.ts src/lib/storage/canonical-validation.test.ts src/lib/storage/cross-tab.test.ts src/lib/storage/envelope-validation.ts src/lib/storage/gc-fault.test.ts src/lib/storage/imports.ts src/lib/storage/restore.test.ts src/lib/storage/restore.ts src/lib/storage/source-codec.test.ts src/lib/storage/source-codec.ts src/lib/storage/tree-validation.ts src/test/archive-fixtures.ts src/ui/RecoveryPanel.test.tsx src/ui/RecoveryPanel.tsx src/app/App.tsx src/features/about/About.tsx src/features/about/Releases.tsx src/features/games/CardGame.tsx src/features/games/GamesHub.tsx src/features/profile/Profile.tsx src/features/run/Dashboard.tsx src/features/settings/Settings.tsx src/features/settings/SettingsMenu.tsx src/features/settings/ThemeSelector.tsx src/lib/data/archive.export.test.ts src/lib/data/archive.ts src/lib/data/transfer.test.ts src/lib/data/transfer.ts src/lib/i18n/locales/en_us.ts src/lib/i18n/locales/zh_cn.ts src/lib/i18n/locales/zh_tw.ts src/lib/storage/byte-boundary.test.ts src/lib/storage/chunks.ts src/lib/storage/commands.ts src/lib/storage/commit.ts src/lib/storage/consumers.test.ts src/lib/storage/core.test.ts src/lib/storage/index.ts src/lib/storage/integrity-commands.test.ts src/lib/storage/ownership.test.ts src/lib/storage/platform-failure.test.ts src/lib/storage/publication.test.ts src/lib/storage/recovery.test.ts src/lib/storage/recovery.ts src/lib/storage/runtime.ts src/lib/storage/selective.test.ts src/lib/storage/snapshot.ts src/lib/storage/state-model.ts src/test/i18n-structure.test.ts src/test/i18n-surfaces.test.tsx src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx src/test/storage.test.ts src/ui/Login.tsx
  ```

- **targeted-15-storage-consumers-export** — exit **0**, start `2026-11-16T04:34:50.398Z`, raw `targeted-15-storage-consumers-export.log`:
  ```text
  npx vitest run src/lib/storage/core.test.ts src/lib/storage/integrity-commands.test.ts src/lib/storage/byte-boundary.test.ts src/lib/storage/consumers.test.ts src/lib/storage/recovery.test.ts src/lib/storage/restore.test.ts src/lib/storage/ownership.test.ts src/lib/data/archive.export.test.ts src/lib/data/archive-import.test.ts src/lib/storage/source-codec.test.ts src/test/storage.test.ts src/test/i18n-surfaces.test.tsx
  ```

- **targeted-16-runtime-manifest** — exit **0**, start `2026-11-16T04:37:01.689Z`, raw `targeted-16-runtime-manifest.log`:
  ```text
  npx vitest run src/lib/storage/canonical-validation.test.ts src/lib/storage/core.test.ts src/lib/storage/publication.test.ts src/lib/storage/selective.test.ts src/lib/storage/restore.test.ts src/lib/storage/recovery.test.ts src/lib/storage/cross-tab.test.ts src/lib/storage/gc-fault.test.ts
  ```

- **targeted-17-typescript** — exit **0**, start `2026-11-16T04:37:03.697Z`, raw `targeted-17-typescript.log`:
  ```text
  npx tsc -b
  ```

- **targeted-18-final-changed-lint** — exit **0**, start `2026-11-16T04:39:05.792Z`, raw `targeted-18-final-changed-lint.log`:
  ```text
  npx eslint src/lib/data/archive-import.test.ts src/lib/data/archive-import.ts src/lib/data/zip-preflight.ts src/lib/storage/canonical-validation.test.ts src/lib/storage/cross-tab.test.ts src/lib/storage/envelope-validation.ts src/lib/storage/gc-fault.test.ts src/lib/storage/imports.ts src/lib/storage/restore.test.ts src/lib/storage/restore.ts src/lib/storage/source-codec.test.ts src/lib/storage/source-codec.ts src/lib/storage/tree-validation.ts src/test/archive-fixtures.ts src/ui/RecoveryPanel.test.tsx src/ui/RecoveryPanel.tsx src/app/App.tsx src/features/about/About.tsx src/features/about/Releases.tsx src/features/games/CardGame.tsx src/features/games/GamesHub.tsx src/features/profile/Profile.tsx src/features/run/Dashboard.tsx src/features/settings/Settings.tsx src/features/settings/SettingsMenu.tsx src/features/settings/ThemeSelector.tsx src/lib/data/archive.export.test.ts src/lib/data/archive.ts src/lib/data/transfer.test.ts src/lib/data/transfer.ts src/lib/i18n/locales/en_us.ts src/lib/i18n/locales/zh_cn.ts src/lib/i18n/locales/zh_tw.ts src/lib/storage/byte-boundary.test.ts src/lib/storage/chunks.ts src/lib/storage/commands.ts src/lib/storage/commit.ts src/lib/storage/consumers.test.ts src/lib/storage/core.test.ts src/lib/storage/files.ts src/lib/storage/index.ts src/lib/storage/integrity-commands.test.ts src/lib/storage/ownership.test.ts src/lib/storage/platform-failure.test.ts src/lib/storage/publication.test.ts src/lib/storage/recovery.test.ts src/lib/storage/recovery.ts src/lib/storage/runtime.ts src/lib/storage/selective.test.ts src/lib/storage/snapshot.ts src/lib/storage/state-model.ts src/test/i18n-structure.test.ts src/test/i18n-surfaces.test.tsx src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx src/test/storage.test.ts src/ui/Login.tsx
  ```

- **targeted-19-provenance-selectivity** — exit **0**, start `2026-11-16T04:40:08.904Z`, raw `targeted-19-provenance-selectivity.log`:
  ```text
  npx vitest run src/lib/storage/selective.test.ts src/lib/data/transfer.test.ts src/test/settings-data.test.tsx src/test/settings-header-import.test.tsx src/lib/storage/canonical-validation.test.ts
  ```

- **targeted-20-selective-lint** — exit **0**, start `2026-11-16T04:40:11.087Z`, raw `targeted-20-selective-lint.log`:
  ```text
  npx eslint src/lib/storage/selective.test.ts src/lib/storage/snapshot.ts src/lib/storage/commands.ts src/features/settings/Settings.tsx src/lib/storage/files.ts src/lib/storage/tree-validation.ts src/lib/storage/canonical-validation.test.ts
  ```

- **final-01-eslint** — exit **0**, start `2026-11-16T04:40:29.156Z`, raw `final-01-eslint.log`:
  ```text
  npx eslint .
  ```

- **final-02-typescript** — exit **0**, start `2026-11-16T04:40:31.541Z`, raw `final-02-typescript.log`:
  ```text
  npx tsc -b
  ```

- **final-03-tests** — exit **1**, start `2026-11-16T04:40:33.348Z`, raw `final-03-tests.log`:
  ```text
  npm test -- --run
  ```

- **final-04-build** — exit **0**, start `2026-11-16T04:40:47.101Z`, raw `final-04-build.log`:
  ```text
  npm run build
  ```

Interpretation of failed pre-freeze checks:

- Targeted01/02 TypeScript exit2: source codec unknown narrowing/signature and decoded cross-tab identity narrowing; corrected before freeze.
- Targeted03 exit1: 132 cases, 121 passed/11 failed; cross-realm Uint8Array identification rejected ten transfer paths and new lazy export validation initially changed one expected integrity diagnostic. Replaced realm-sensitive instance check and retained export raw-integrity check; focused rerun passed.
- Targeted06 exit1: 55 cases, 52 passed/3 failed; pre-intent snapshot republish violated failed-write referential stability, missing SubtleCrypto poisoned safe retry, new ownership check found feature deep preference imports. Corrected actual behavior/import ownership rather than weakening assertions; focused checks passed.
- Targeted07 TypeScript exit2: recovery generic decode assertions required an explicit typed helper; corrected before freeze;09 passed.
- Targeted10 exit1: 28 cases,22 passed/6 failed; all frozen warning byte/markup parity in three locales. Restored every existing frozen string/markup and added new safe plain-text keys, leaving parity assertions untouched;11 passed (29 cases).
- Segment ZIP initial decoder test exit1 and new matcher OOM exit1 are recorded in its exact ledger. Only newly authored fixture/matcher issues were corrected pre-freeze; caps were not reduced, no test skipped. Segment tool denials have **no process exit**, never fabricated as numeric failures/successes.

No process test/compiler/lint/build command was run after final sequence. Read-only status/diff/hash/line inspection and local commits/report generation are not regates. Source compilation invoked internally by `npm run build` is part of the prescribed fourth command, not a second independent final sequence.

### Final gate summary

| Order | Exact command | Start UTC | End UTC | Actual exit |
|---|---|---|---|---:|
|1|`npx eslint .`|04:40:29.156|04:40:31.540|0|
|2|`npx tsc -b`|04:40:31.541|04:40:33.348|0|
|3|`npm test -- --run`|04:40:33.348|04:40:47.100|**1**|
|4|`npm run build`|04:40:47.101|04:40:50.485|0|

All dates are 2026-11-16. Raw evidence directory: `node_modules/.cache/impl-evidence-b/` (ignored local evidence); complete raw four outputs follow, so they survive the report commit rather than depend on ignored files being copied. There is no fabricated/truncated/filtered gate success output.

### final-01-eslint.log — complete raw stdout + stderr and recorded exit

```text
$ npx eslint .
START 2026-11-16T04:40:29.156Z
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`

EXIT 0
END 2026-11-16T04:40:31.540Z
```

### final-02-typescript.log — complete raw stdout + stderr and recorded exit

```text
$ npx tsc -b
START 2026-11-16T04:40:31.541Z

EXIT 0
END 2026-11-16T04:40:33.348Z
```

### final-03-tests.log — complete raw stdout + stderr and recorded exit

```text
$ npm test -- --run
START 2026-11-16T04:40:33.348Z

> runawaylog@1.2.0 test
> vitest --run


 RUN  v4.0.15 /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a

 ✓ src/app/routes.test.tsx (3 tests) 499ms
 ✓ src/test/settings-preferences.test.tsx (1 test) 666ms
   ✓ settings changes persist across remount; cloud is inert and local writes never fetch  665ms
 ❯ src/features/print/PrintCalendar.test.tsx (7 tests | 1 failed) 627ms
     × Settings opens the current month from the persisted record without invoking window.print 112ms
     ✓ follows the existing calendar previous/next month owner across a year boundary without accumulating sheets  305ms
     ✓ rebuckets stored at instants when the timezone or controlled month changes 20ms
     ✓ retains localized dialog controls, dates and calendar-only sheet in en_us 81ms
     ✓ retains localized dialog controls, dates and calendar-only sheet in zh_cn 59ms
     ✓ retains localized dialog controls, dates and calendar-only sheet in zh_tw 43ms
   ✓ declares A4, excludes application/dialog chrome and prevents splitting the single month sheet 5ms
stderr | src/features/run/Run.test.tsx > run-owned invariants > records once under double press and claims the scene once across route remounts, rearming only for a new page tree
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
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ src/features/games/Games.test.tsx (2 tests) 765ms
   ✓ persists keyboard-accessible game toggles per user and leaves coming-soon controls inert  676ms
 ✓ src/features/profile/Profile.test.tsx (3 tests) 893ms
   ✓ localizes member duration and persists email and the original registration date in en_us  448ms
stderr | src/features/run/Run.test.tsx > run-owned invariants > records once under double press and claims the scene once across route remounts, rearming only for a new page tree
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
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

stderr | src/features/run/Run.test.tsx > run-owned invariants > wrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus
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
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ src/ui/SurfaceBoundary.test.tsx (3 tests) 201ms
 ✓ src/features/about/About.test.tsx (3 tests) 241ms
stderr | src/features/run/Run.test.tsx > run-owned invariants > renders an independently registered two-control game and respects count, scene and wrong animation outcomes
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
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

stderr | src/features/run/Run.test.tsx > run-owned invariants > renders an independently registered two-control game and respects count, scene and wrong animation outcomes
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

stderr | src/features/run/Run.test.tsx > run-owned invariants > renders an independently registered two-control game and respects count, scene and wrong animation outcomes
An update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ src/features/run/Run.test.tsx (11 tests) 1892ms
     ✓ records once under double press and claims the scene once across route remounts, rearming only for a new page tree  933ms
     ✓ wrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus  373ms
     ✓ renders an independently registered two-control game and respects count, scene and wrong animation outcomes  414ms
stdout | src/test/i18n.test.ts > i18n shipped fixture parity > every literal i18n.t call in every source file resolves to a string in every locale
Checked 287 literal calls (181 unique paths) across 129 source files in all 3 locales.

 ✓ src/test/i18n.test.ts (4 tests) 202ms
 ✓ src/lib/data/archive-import.test.ts (36 tests) 1369ms
     ✓ enforces actual streamed manifest and payload caps despite false bounded advertised sizes  517ms
     ✓ accepts actual manifest/payload caps at exact equality without trusting an allocation hint  736ms
 ✓ src/lib/storage/migrate.test.ts (18 tests) 206ms
 ✓ src/lib/storage/source-codec.test.ts (51 tests) 3230ms
     ✓ keeps exact 12 MiB canonical equality inline and fragments the next byte into <=8 MiB binary parts  2920ms
 ✓ src/lib/storage/integrity-commands.test.ts (3 tests) 1206ms
     ✓ rejects historical ids outside recent fifty using the index without fetching old chunks  1046ms
stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > en_us: identical full locale key paths and placeholders, with every frozen baseline string byte preserved
en_us: 203 keys; changed-value diff: []

stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > en_us: markup remains a string with exactly the shipped tags
en_us dashboard.hit_count: <span>Runaway Count: <strong>42</strong></span>

stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > zh_cn: identical full locale key paths and placeholders, with every frozen baseline string byte preserved
zh_cn: 203 keys; changed-value diff: []

stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > zh_cn: markup remains a string with exactly the shipped tags
zh_cn dashboard.hit_count: <span>跑路次数：<strong>42</strong></span>

stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > zh_tw: identical full locale key paths and placeholders, with every frozen baseline string byte preserved
zh_tw: 203 keys; changed-value diff: []

stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > zh_tw: markup remains a string with exactly the shipped tags
zh_tw dashboard.hit_count: <span>跑路次數：<strong>42</strong></span>

 ✓ src/features/run/Run.failure.test.tsx (1 test) 3316ms
     ✓ shows a rejected real IDB write, preserves history and the scene claim, then unlocks for one safe retry  3315ms
 ✓ src/lib/storage/consumers.test.ts (5 tests) 562ms
stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > compiler rejects missing and extra keys at top level and nested levels
Compiler rejected missing: Type '{ title: string; }' is missing the following properties from type '{ title: string; run_button: string; hit_count: string; logout: string; settings: string; brand_title: string; }': "run_button", "hit_count", "logout", "settings", "brand_title"
Compiler rejected extra: Object literal may only specify known properties, and 'unexpected' does not exist in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 15 more ...; run_scene: { ...; }; }'.
Compiler rejected nested extra: Object literal may only specify known properties, and 'unexpected' does not exist in type '{ title: string; run_button: string; hit_count: string; logout: string; settings: string; brand_title: string; }'.
Compiler rejected top missing: Type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }' does not satisfy the expected type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 15 more ...; run_scene: { ...; }; }'.
  Property '"dashboard"' is missing in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }' but required in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 15 more ...; run_scene: { ...; }; }'.

 ✓ src/lib/storage/gc-fault.test.ts (6 tests) 819ms
stdout | src/lib/i18n/parity.test.ts > typed locale parity against committed shipped XML output > retains the existing hardcoded-copy AST rule and applies it to features/ui
Unchanged hardcoded-copy AST rule: 39 sources; 0 findings; directories: src/features, src/ui

 ✓ src/test/storage.test.ts (13 tests) 450ms
 ✓ src/lib/i18n/parity.test.ts (13 tests) 1087ms
     ✓ compiler rejects missing and extra keys at top level and nested levels  904ms
 ✓ src/lib/data/transfer.test.ts (22 tests) 3075ms
     ✓ exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication  619ms
     ✓ deduplicates logical provenance across ZIP export times and repeated export/import without recursive wrappers  407ms
 ✓ src/lib/storage/core.test.ts (11 tests) 1769ms
     ✓ projects exact timestamps and recent fifty without statistics fetching history chunks  1085ms
 ✓ src/test/i18n-surfaces.test.tsx (33 tests) 3556ms
     ✓ Settings opens the loaded current-month calendar, never the Settings print surface  324ms
 ✓ src/lib/storage/selective.test.ts (2 tests) 1997ms
   ✓ hydrates no history on reload and fetches only recent-reference chunks for the log view  1889ms
 ✓ src/lib/data/archive.export.test.ts (26 tests) 520ms
Not implemented: navigation to another Document
 ✓ src/lib/storage/preferences.test.ts (6 tests) 87ms
 ✓ src/lib/storage/preservation.test.ts (5 tests) 125ms
Not implemented: navigation to another Document
stderr | src/test/settings-data.test.tsx > settings data-management invariants > merge deduplicates existing and incoming ids without changing identity or other user data
An update to Settings inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

 ✓ src/lib/storage/restore.test.ts (7 tests) 853ms
 ✓ src/lib/storage/canonical-validation.test.ts (12 tests) 909ms
 ✓ src/lib/storage/byte-boundary.test.ts (1 test) 346ms
   ✓ allows exactly one million UTF-8 envelope bytes and rolls the next byte without rewriting the completed tail  345ms
 ✓ src/ui/RecoveryPanel.test.tsx (8 tests) 1092ms
   ✓ labels older recovery read-only and requires explicit consent in en_us  389ms
 ✓ src/lib/storage/cross-tab.test.ts (5 tests) 694ms
 ✓ src/test/settings-data.test.tsx (7 tests) 1333ms
     ✓ never writes on file selection or cancel; replace requires explicit destructive confirmation  541ms
 ✓ shared/codec.test.ts (70 tests) 87ms
 ✓ src/lib/storage/publication.test.ts (6 tests) 395ms
Not implemented: navigation to another Document
 ✓ src/test/settings-header-import.test.tsx (1 test) 642ms
   ✓ header import obeys confirmation and preserves profile, games, identity, and device preferences  641ms
 ✓ shared/integrity.test.ts (6 tests) 35ms
 ✓ src/test/timezone.test.ts (21 tests) 100ms
 ✓ src/ui/Login.storage.test.tsx (1 test) 302ms
   ✓ offers a downloadable original-byte rescue when a malformed store blocks login  301ms
 ✓ src/lib/storage/recovery.test.ts (14 tests) 425ms
 ✓ src/lib/storage/platform-failure.test.ts (2 tests) 326ms
 ✓ src/lib/storage/registration.test.ts (3 tests) 45ms
 ✓ src/lib/i18n/extension.test.tsx (4 tests) 98ms
 ✓ src/lib/storage/ownership.test.ts (4 tests) 21ms
 ✓ src/test/quotes.test.ts (4 tests) 6ms
 ✓ src/test/i18n-structure.test.ts (3 tests) 20ms
stdout | src/test/i18n-hardcoded.test.ts > i18n hardcoded copy — compiler API inventory > walks all component/page TSX files and excludes comments by construction
AST scanned 30 TSX files; 0 findings (comments excluded, empty alt allowed, placeholder unchecked).

 ✓ src/test/i18n-hardcoded.test.ts (2 tests) 5ms
 ✓ src/test/runScene.test.tsx (23 tests) 12521ms
     ✓ T7: the scene opens after the first successful Run and not again in the same session  3867ms
     ✓ T7: a fresh component tree (as a reload) re-arms the scene  3201ms
     ✓ T6: a full Run → choose → Close cycle writes nothing scene-related  1622ms
     ✓ restores focus to the Run control after Skip and Escape (AC-A21)  3177ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/features/print/PrintCalendar.test.tsx > print feature regression contract > Settings opens the current month from the persisted record without invoking window.print
StorageError: Hit requires schemaVersion 1 and a positive decimal-string recordVersion.
 ❯ validateHit src/lib/storage/chunks.ts:14:89
     12| export const validateHit = (hit: Hit): void => {
     13|   canonicalStringify(hit);
     14|   if (!isObject(hit) || hit.schemaVersion !== 1 || !isVersion(hit.reco…
       |                                                                                         ^
     15|   validateRunHit(hit);
     16| };
 ❯ src/lib/storage/commands.ts:108:5
 ❯ execute src/lib/storage/commands.ts:45:32
 ❯ withPinnedGeneration src/lib/storage/commit.ts:144:22
 ❯ src/lib/storage/commands.ts:51:52

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed | 45 passed (46)
      Tests  1 failed | 491 passed (492)
   Start at  12:40:33
   Duration  13.51s (transform 2.57s, setup 7.93s, import 3.29s, tests 49.62s, environment 11.76s)


EXIT 1
END 2026-11-16T04:40:47.100Z
```

### final-04-build.log — complete raw stdout + stderr and recorded exit

```text
$ npm run build
START 2026-11-16T04:40:47.101Z

> runawaylog@1.2.0 build
> tsc -b && vite build

vite v7.2.6 building client environment for production...
transforming...
✓ 190 modules transformed.
[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/files.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/chunks.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/envelope-validation.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/restore.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/tree-validation.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/chunks.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/tree-validation.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/snapshot.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/restore.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/tree-validation.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commit.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/files.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts, dynamic import will not move module into another chunk.

[plugin vite:reporter] 
(!) /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/recovery.ts is dynamically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/commands.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/imports.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/runtime.ts but also statically imported by /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/index.ts, /Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a/src/lib/storage/restore.ts, dynamic import will not move module into another chunk.

rendering chunks...
computing gzip size...
dist/registerSW.js                0.13 kB
dist/manifest.webmanifest         0.40 kB
dist/index.html                   1.04 kB │ gzip:   0.50 kB
dist/assets/index-g06rwGX2.css   48.85 kB │ gzip:   8.46 kB
dist/assets/index-HKXYWTuG.js   468.15 kB │ gzip: 153.11 kB
✓ built in 643ms
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
Browserslist: browsers data (caniuse-lite) is 12 months old. Please run:
  npx update-browserslist-db@latest
  Why you should do it regularly: https://github.com/browserslist/update-db#readme

PWA v1.2.0
mode      generateSW
precache  7 entries (506.34 KiB)
files generated
  dist/sw.js
  dist/workbox-1d305bb8.js

EXIT 0
END 2026-11-16T04:40:50.485Z
```

## 7. Final handoff procedure

Implementation source is frozen and committed at the exact candidate above. This report records the **blocked** result and remaining acceptance work, not a new authorization to fix/regate. The next operation is the separate report commit, followed only by read-only final branch/HEAD/status/remotes/source-hash checks and the terminal handoff. `REPORT.md` remains preserved. No post-report source edits, gate rerun, browser, push, deploy or network operation belongs to this round.

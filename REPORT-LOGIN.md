# Local password identity — executor report

## 1. Disposition and immutable candidate

Soren's bounded execution, assisted by Claude Code; **not owner or independent acceptance**. ADR0008 is **proposed**, not accepted. Username-first local password identity is implemented and tested. All four final gates passed once, sequentially, with no post-gate source fixes or regates. **Storage budget remains unresolved: 1771 lines, 21 above the unchanged 1750 ceiling**; no budget increase is claimed.

- Workspace: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a`.
- Branch: `password-login`; start clean at `ecdd536f30b34284f31ea3a853256567a326cad6`.
- **Tested implementation/ADR candidate:** `4e016ad285a18659d99b035fb251d5dff79a8386`.
- Candidate author and committer verified: Emmett `<emmett@initialize.in>`; required Claude Code attribution included.
- Source frozen at **2026-11-16T07:45:58.102Z**. Four gates ended **07:49:26.443Z**. Post-gate readback **07:51:44.119Z** matched the frozen inventory digest exactly. Candidate committed **07:53:08Z**.
- Freeze source SHA-256: `f697d939fabf9e8a268d426e004de6e17ad2eeef76ea0d07d52fbcf67c227980` (file-inventory integrity evidence, not a credential).
- Implementation commit: 30 files, 1239 insertions / 275 deletions. This report is a separate commit; its own SHA is deliberately not self-recorded. Final report HEAD, branch/status/remotes are read back afterward and supplied in the terminal handoff.
- No dependencies/package/lock, version, spec/versions, catalog/releases, shared/server/cloud code, network/cloud calls, push/deploy, owner tree or global configurations changed. Existing build reports version1.2.0 because changing versions was prohibited. No browser/server run requested or performed.

## 2. Implemented state machine and security choices

`src/ui/Login.tsx` initially renders **username only**. Exact handle lookup reads the latest local directory, not the repository's UUID-or-handle alias. It returns missing/credentialless → setup or credentialed → password. Malformed credentials reject, never become setup. New password+confirmation publishes a new account and credential together; prior credentialless setup guards accountId/handle and absent key without replacing data. Existing password verification, including empty-input refusal, awaits guarded commit and view hydration before identity/callback. Public `login` cannot create an account or use empty-password entry; public `register` enforces setup policy. Low-level repository account creation remains available for credentialless predecessor fixtures, not product entry.

- WebCrypto PBKDF2-HMAC-SHA-256, random16-byte salt/account, **210000 iterations**, 256-bit output, no dependency/fallback.
- Bare unsalted SHA-256 rejected as fast/cheaply guessable and equal-password-equality revealing, **not reversible**. Future PBKDF2 iteration1 parameter decision is described, not implemented for new credentials, and distinguished from bare unsalted SHA.
- Policy: min12 Unicode code points, max1024 UTF-8 bytes inclusive, reject unpaired surrogates, no normalization/trimming/truncation/composition. Distinct reasons `password_invalid_unicode`, `password_too_long`, `password_too_short`, `confirmation_mismatch`; all three locales. Early UTF-16 length>1024 bounds allocation and gives too-long; otherwise Unicode→UTF8 maximum→code-point minimum→confirmation equality. Existing login minimum is not reapplied to historical credentials. Oversized/malformed verification input fails generically without KDF/counter increment.
- Fixed-length XOR output comparison is constant-time-ish only, not a JS/JIT/WebCrypto guarantee.
- All UI error codes whitelist localized text; unknown errors never render exception messages. Wrong-password feedback stays generic and visible on password step for safe retry.
- Keyed child owns transient passwords; success/back explicitly clears fields, account change/back/recovery/unmount discard child, pending completion after unmount does not invoke callback. No secure memory-erasure claim.
- Local passwords are unrecoverable through the product. UI/ADR explain no reset/recovery and export **before** loss. No encryption/device-profile/XSS security boundary claim. Offline attacks remain. Credentialless predecessor setup does not establish historical ownership; first successful setter can claim it. Cloud ADR0007 server Argon2id stays separate and unchanged.

## 3. IDB upgrade, atomic credential publication and concurrency

Schema1→2 conditionally adds `credentials` with out-of-line accountId key. Value exactly `{algorithm,iterations,saltB64,hashB64,createdAt,updatedAt}`; no accountId field or plaintext/length. Algorithm identifier `PBKDF2-HMAC-SHA-256`. Validate six fields, integer iterations1..210000, canonical standard padded base6416/32 decoded bytes with bounded24/44-character checks and reencoding, integer nonnegative valid Date bounds, updatedAt>=createdAt. Even an existing key whose value is undefined/null is invalid, not absence. Supported weaker records upgrade; unsupported/malformed records block before PBKDF2 and never overwrite as setup.

`credentials.ts` owns queued domain intents; `credential-commit.ts` owns IDB record/transaction primitives, avoiding a runtime dependency cycle with commands/commit. Derive outside IDB. Existing prepare/readback/integrity protocol is unchanged. Credential intent stays in transient Candidate memory, not Generation/map/blob/manifest. Final current-pointer transaction rechecks revision/staged candidate, transactionally guards expected credential key/value, writes credential plus current/account publication together, and resolves only on transaction completion. Old setup identity is checked against immutable base and fenced by the same current CAS. Abort after credential/pointer request success preserves old current/no partial identity/credential. Deletion removes that account's credential in final publication; other credentials unaffected. GC does not traverse credentials as tree blobs.

Same-handle competing missing/setup calls have one winner; loser `identity_changed`, no overwrite or winner-session adoption. Real independent import graphs/queues/connections test both absent-firstboot and credentialless races with advisory broadcasts disabled. Different handles rebase and retain both accounts. UI submits observed LocalIdentity so deletion/replacement between username and password cannot silently authorize another same-handle account even with a matching password.

Blocked upgrade gives close-obsolete-tabs diagnostic and closes late orphan connection. Actual versionchange closes handle and rejects further access with reload diagnostic. Real schema1 committed tree/current bytes preserved in upgrade test. This is fake-IDB coverage, not browser durability proof.

Successful older-iteration verification rederives with **same salt**, createdAt preserved, updatedAt strictly advanced, full-record expected-value guard; concurrent credential mutation rejects without session or overwrite. Current-parameter verification guards without credential put. It intentionally uses existing COW path with empty domain changes, so successful login advances manifest/generation/revision and incurs metadata validation/hydration/GC cost rather than pretending to be read-only.

## 4. Cooldown, sessions and export/import evidence

Peraccount/perpage auth Map, same-account serial verification queue: mismatches1–4 generic; fifth starts30000ms and returns localized cooldown. Blocked attempts, even correct, do not derive/increment/extend. Exact Date.now()>=deadline resets; success after guarded commit clears. Back/remount/logout/lookup/account switching do not clear; other accounts independent. Invalid records/input/setup/crypto/storage failures are not counted as actual mismatches. Timer is wall-clock UX and can move with device clock; new page/offline guesses bypass it. **Not brute-force protection**, no persisted lockout.

SessionStorage now contains only existing identity keys `username` and `{username}` currentUser. Historical v2 credential/token caches are removed without reading/migrating; unrelated obsolete localStorage keys preserved. No password/hash/salt/mock token in sessions. Existing-tab reload restoration remains; fresh session asks again while account data/credentials remain. Fresh-tab test models a new session by clearing sessionStorage; no browser-tab clone/opener guarantee.

Actual `createExportDocument` ZIP bytes are decoded with fflate. Every entry/payload, manifest and generation map is checked for dynamically derived salt/hash/password and credential/session field material. Credentials never enter tree/ordinary or recovery export sources. Import format/code unchanged: missing target rejected, target created via password registration then receives archive hits; existing target credential unchanged. Existing archive hostile-path tests retained. No credential/hash literals were added; real derived records/salts generated dynamically; assertions involving sensitive values use booleans to avoid printing values. No sensitive values were logged/reported.

## 5. File inventory and sizes

Physical line counts at freeze (new **N**, modified **M**):

| State | File | Lines |
|---|---|---:|
| N | spec/decisions/0008-local-password-identity.md | 103 |
| M | src/app/session.ts | 22 |
| M | src/auth.ts | 89 |
| M | src/lib/i18n/locales/en_us.ts | 336 |
| M | src/lib/i18n/locales/zh_cn.ts | 335 |
| M | src/lib/i18n/locales/zh_tw.ts | 335 |
| M | src/lib/i18n/parity.test.ts | 178 |
| N | src/lib/identity/password.ts | 66 |
| M | src/lib/storage/commands.ts | 204 |
| M | src/lib/storage/commit.ts | 177 |
| M | src/lib/storage/consumers.test.ts | 113 |
| N | src/lib/storage/credential-commit.ts | 29 |
| N | src/lib/storage/credential-publication.test.ts | 116 |
| N | src/lib/storage/credential-race.test.ts | 68 |
| N | src/lib/storage/credential-schema.test.ts | 78 |
| N | src/lib/storage/credentials.test.ts | 252 |
| N | src/lib/storage/credentials.ts | 19 |
| M | src/lib/storage/idb.ts | 115 |
| M | src/lib/storage/index.ts | 16 |
| M | src/lib/storage/ownership.test.ts | 48 |
| M | src/lib/storage/preferences.test.ts | 88 |
| M | src/lib/storage/preferences.ts | 56 |
| M | src/test/i18n.test.ts | 87 |
| N | src/test/login-copy.ts | 6 |
| M | src/ui/Login.css | 210 |
| N | src/ui/Login.password.test.tsx | 140 |
| M | src/ui/Login.storage.test.tsx | 34 |
| M | src/ui/Login.tsx | 75 |
| N | src/ui/LoginPassword.tsx | 75 |
| M | src/ui/RecoveryPanel.test.tsx | 123 |

Storage runtime aggregate excludes test/model/state-model/migrate exactly as baseline: **1696→1771 (+75)**, **21 over1750**. New persistence responsibilities split into29+19-line modules. KDF/policy adds66 runtime lines outside storage; **storage+new KDF=1837**, transparently reported rather than relabeling runtime as model. Storage facade16<=120, commands204 within200–250 target, all other storage responsibilities<=177. Both Login components75<=150. No budget document increase. Transfer/archive runtime unchanged. Build JS483.99kB/gzip157.58kB, CSS49.02kB/gzip8.48kB; no baseline bundle comparison or hardware KDF benchmark claimed.

## 6. Every added test and reason

New test files add **48 executed cases**, taking492→540 while retaining the492 prior cases (authorized behavior adaptations below), no skip/delete/weaken unrelated assertions.

### src/lib/storage/credentials.test.ts —20 cases

- `looks up exact handles as missing, credentialless and credentialed without UUID aliases` — state classification and no alias adoption.
- `verifies correct passwords, rejects wrong and empty, and exposes no public passwordless creation bypass` — real verification/API gate and exact stored shape.
- `rejects policy reason %s without any partial creation` —5 cases: too-short, too-long, invalid password Unicode, invalid confirmation Unicode, confirmation mismatch; no current/account/credential.
- `counts Unicode code points and exact UTF-8 byte limits without normalization, truncation or composition` — inclusive bounds, Unicode/whitespace exactness.
- `preserves predecessor identity, registration and data through absent-record password setup` — legacy trust path retains facts.
- `enforces five failures and the exact 30-second boundary, preserving cooldown across logout and lookup` — fake time29999/30000 and success reset.
- `expires cooldown into a fresh failure counter without deriving during blocked attempts` — actual derive spy delegates normally, no work when blocked, expiry mismatch starts at1.
- `isolates cooldown by account and serializes concurrent verification attempts` — six concurrent calls and unaffected other account.
- `upgrades a real weaker PBKDF2 record with the same salt and preserved creation time before entering` — dynamically derived weaker record and guarded upgrade fields.
- `guards a concurrent credential rewrite and never overwrites the newer record` — expected-record CAS.
- `rejects malformed records before PBKDF2 and never offers setup or overwrites them` — key existence/shape/algorithm/base64/iterations/times bounds.
- `aborts new identity and credential together after pointer put success and permits a safe retry` — real final transaction rollback/no partial state.
- `rejects competing same-handle setup without overwriting or entering as the winning account` — one winner and loser password rejected.
- `stores identity only per tab and asks again in a fresh tab session while retaining device credentials` — no sensitive session values/public bypass.
- `does not count rejected oversized or malformed verification inputs as failed derivations` — bounded public input/counter behavior.
- `decodes actual exported ZIP entries proving no credential/password/session data in tree or manifest and imports only into a password-created target` — real ZIP/import target credential isolation.

### src/lib/storage/credential-schema.test.ts —4 cases

- `upgrades a real schema-1 committed tree without changing its current pointer or existing records` — copied real v1 stores preserve current/full record.
- `rejects a blocked upgrade with actionable diagnostics and closes the late successful connection` — open lifecycle.
- `closes an obsolete connection on versionchange and requires a reload instead of continuing writes` — actual higher-version open dispatches driver event.
- `fails closed when real WebCrypto cannot derive a new credential` — injected platform failure, no current publication.

### src/lib/storage/credential-race.test.ts —4 cases

- `one same-handle password setter wins without adopting or overwriting the winner (predecessor=%s)` —2 independent-queue/connection cases, missing vs credentialless.
- `rebases different-handle first boots while retaining both distinct credential records` — both identities/salts retained.
- `refuses stale username-step identity after account replacement even if both passwords match` — UI observed identity fence.

### src/lib/storage/credential-publication.test.ts —4 cases

- `waits for the final transaction completion callback before session entry or setup resolution` — put/complete distinction.
- `aborts predecessor setup without a credential or changed identity and then retries safely` — setup failure atomicity.
- `rejects an actual upgrade race after derivation without overwriting the concurrent credential or entering a session` — pauses real delegated WebCrypto completion, mutates through real IDB.
- `does not rewrite a current-parameter credential and deletes credentials only with account deletion publication` — no unnecessary credential put and isolated lifecycle.

### src/ui/Login.password.test.tsx —16 cases

- `shows only username before lookup and validates an empty username locally` — first step.
- `sets up a missing local account and authenticates only after committed setup` — commit-before-callback.
- `sets up a credentialless predecessor without replacing retained data` — UI old-account setup.
- `requires the existing credential and keeps a generic visible error on a safe retry` — wrong/correct real verify.
- `shows localized policy reason %s without creating the account` —4 actual UI cases for each policy/mismatch code.
- `back and account change discard both password fields while preserving the username` — lifecycle clearing.
- `unmounting discards sensitive state and suppresses the login callback after a pending submit` — async unmount fence.
- `five failed verifications remain in cooldown after back and another lookup` — no UI bypass.
- `localizes every error, setup rule and irreversible-loss notice in %s` —3 locales, all error codes/no raw exception/key leak.
- `renders a generic localized fallback instead of unknown exception messages` — error hygiene.
- `does not normalize whitespace or decomposed Unicode before actual password authentication` — exact bytes from UI.

## 7. Every adapted existing test and reason

- `consumers.test.ts`: `login recognizes migrated existing users and new login/register preserve all other users` → `password setup recognizes current local accounts and new setup/register preserve all other users`: explicit setup replaces authorized old auto-create/bypass; all peer/extras/legacy-byte assertions retained.
- `consumers.test.ts`: `auth data writes still reject while adapter saves still report failures without changing bytes`: setup/register now valid policy inputs so quota path is still exercised; unchanged preservation assertions.
- `consumers.test.ts`: `preserves credential checking, passwordless demo entry, and refuses registration over an existing record` → `requires credential verification even for empty passwords and refuses registration over an existing record`: intentionally reverses forbidden bypass, uses IDB credential not session cache, retains old data/duplicate registration protection.
- `preferences.test.ts`: `preserves opaque demo-identity cache bytes without changing keys or semantics` → `retains only tab identity and removes historical credential/token caches without reading obsolete local keys`: identity keys retained; secret/token cache semantics deliberately removed under packet; old local keys preservation unchanged.
- `ownership.test.ts`: `keeps IndexedDB and browser persistence outside components and transfer code`: strengthened existing forbidden persistence regex to include sessionStorage, no weakening.
- `Login.storage.test.tsx`: `offers a downloadable original-byte rescue when a malformed store blocks login` → `ignores malformed obsolete browser bytes while password setup opens the authoritative local account`: accurate old assertion meaning, drives username/setup; all obsolete bytes/no-rescue assertions retained.
- `RecoveryPanel.test.tsx`: `Login renders recovery rather than allowing an empty account over damaged current`: additionally asserts new Next/setup controls absent, old password action absence retained.
- `i18n.test.ts`: three locale `frozen baseline subset matches exactly` names → `frozen baseline matches with exact authorized local-password copy changes` (English still rejects mutated string). Exact3-path per-locale replacement map for `login.register_subtitle`, `login.passwordless_login`, `login.error.password_too_short`; every other frozen string and unrelated mutation rejection retained.
- `lib/i18n/parity.test.ts`: three locale `identical full locale key paths and placeholders, with every frozen baseline string byte preserved` → `identical full locale key paths and placeholders, preserving frozen strings except exact authorized login copy`: same exact3-path map, all key/placeholder/interpolation/markup/type-probe assertions retained; truthful console copy. Versioned baseline fixtures unchanged.

All other old tests unchanged. New tests mock animation only in UI; storage tests inject/observe failure/timing around real fake-IDB/WebCrypto, not substitute crypto/storage results. No full-suite preliminary run; only bounded targeted checks/compiler/lint before freeze.

## 8. Raw commands, exits, counts and failures

All evidence in ignored `node_modules/.cache/login-evidence/`, not committed; no credential-bearing output. Final wrapper invokes exact command directly without shell filtering, records exit/start/end and separate byte-for-byte stdout/stderr (`<stem>.stdout.log`, `<stem>.stderr.log`), plus combined `<stem>.log` with metadata. One final sequence only:

| Order | Exact command | UTC start→end | Exit | Raw stem |
|---:|---|---|---:|---|
| 1 | `npx eslint .` | 07:47:03.920→07:47:34.229 | 0 | final-1-eslint |
| 2 | `npx tsc -b` | 07:47:56.147→07:48:04.403 | 0 | final-2-tsc |
| 3 | `npm test -- --run` | 07:48:31.953→07:49:00.134 | 0 | final-3-tests |
| 4 | `npm run build` | 07:49:21.592→07:49:26.443 | 0 | final-4-build |

Exact test summary: **51 passed files (51), 540 passed tests (540)**, duration27.85s. Three stderr notices `Not implemented: navigation to another Document`; no failed/skipped cases. Build194 modules, JS483.99kB/gzip157.58kB; existing mixed static/dynamic import warnings retained in raw stderr. Build invokes existing tsc internally as specified, not an extra final gate.

Pre-freeze captured commands (every stem `.log` stores complete command/output/actual exit; earlier wrapper used combined stdout then stderr and one completion timestamp):

| Evidence stem | Actual command scope | Exit/result |
|---|---|---|
| targeted-compiler-1 | `npx tsc -b` | 2: erasable parameter property and obsolete credential/token cache tests; fixed before freeze |
| targeted-storage-1 | vitest consumers/preferences/publication | 0:3 files17 tests |
| targeted-password-1 | vitest credentials/Login.storage/i18n | 0:3 files23 tests |
| targeted-compiler-2 | `npx tsc -b` | 0 |
| targeted-ui-schema-1 | vitest Login.password/RecoveryPanel/credential-schema/credentials | 1:2 failed44 passed; schema fixtures incorrectly used preopened v2 and synthetic event; fixed to fresh factory/real versionchange |
| targeted-schema-2 | vitest credential-schema | 0:1 file4 tests |
| targeted-lint-1 | changed identity/UI/storage files | 0 |
| targeted-race-1 | vitest credential-race/credentials/cross-tab | 0:3 files28 tests |
| targeted-compiler-3 | `npx tsc -b` | 0 |
| targeted-publication-1 | vitest credential-publication/Login.password/ownership/parity/extension/hardcoded/structure | 1:6 failed41 passed; exact authorized locale replacement not yet applied in second baseline test, UI test CJK data literal flagged by retained scanner; fixed explicit replacement map and generated codepoint data |
| targeted-locale-2 | vitest parity/i18n/hardcoded/Login.password/credential-publication | 0:5 files39 tests |
| targeted-password-final | 11 login/schema/race/publication/consumer/preferences/ownership/UI/i18n surface files | 0:11 files105 tests |
| targeted-lint-2 | changed identity/storage/UI/locales/tests | 0 |

Initial compound compiler/evidence shell command was blocked by command checker and did not run; then dedicated capture wrapper used. Read-only git-config compound and explicit per-command git -c identity commit attempt required unavailable approval, so neither ran; ordinary authorized local commit succeeded and author/committer were verified by log. No settings changed. Two isolated UI/docs agents could not edit original workspace and were stopped; one proposed ADR draft existed only in an ignored nested worktree before stop, not used as an implementation commit. All final source edits/tests/commits occurred in the authorized workspace. Agent Bash denials were not retried by those agents. This orchestration overhead is not acceptance evidence.

`freeze.json` records full30-file inventory/linecounts/digest/baseline/runtime measurement. `post-gates-readback.log` records exact unchanged digest and Git scope; prohibited package/lock/version/shared path diff empty. Final report-commit readback is the terminal handoff; no report self-SHA.

## 9. Remaining gaps and handoff

- **21-line storage aggregate overrun requires owner disposition; no increase authorized.** Including separately reported new KDF runtime gives1837 lines, not hidden compliance.
- No independent/owner acceptance. ADR0008 remains proposed; accepted PD-1 historical document not rewritten. This is Soren's executor artifact only.
- No real browser reload/newtab/upgrade/quota/power-loss acceptance; fake IDB/jsdom cannot prove browser durability or session cloning behavior. No hardware KDF performance benchmark or security boundary claim.
- Current-parameter login still incurs a verified metadata COW commit/manifest revision and scans existing metadata/index validation paths; intentional simplicity/cost documented, not a read-only login claim.
- Cooldown uses wall clock, demo-only, perpage, easily bypassed outside app/offline. Historical credentialless first-setter trust limitation explicit.
- Session identity-only reload semantics remain handle-based as existing app; this round does not introduce server authorization, device encryption, recovery, or browser-profile resistance.
- No post-gate fix/regate, network, push or deployment. After this report commit, read HEAD/branch/status/remotes then stop before **08:00:50Z**.

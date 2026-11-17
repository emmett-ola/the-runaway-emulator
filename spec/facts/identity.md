# Device-local password identity

Current truth for local sign-in: username first, password set on first use, PBKDF2-HMAC-SHA-256
credentials kept outside the account tree. Shipped in 2.0.0; copy tightened in 2.0.1.

Companions: [storage.md](storage.md), [cloud.md](cloud.md), [PD-1](product.md).

## 1. Authorized local policy change

This separate owner-authorized round supersedes PD-1's empty-password behavior and S0 L1/L2's unconditional local entry: an unknown handle requires explicit password setup and confirmation before creation/entry; a credentialed local account requires verification, including refusal of empty passwords. This is a product change, not a reinterpretation of the old bypass as a defect. Accepted ADRs and product.md remain unchanged historical authorities except for this proposed, explicitly directed delta.

PD-2 device-local data, PD-3 tab/session identity, account UUID/registration, COW integrity, selective reads and archive format remain. Cloud remains disabled. `cloud.md`'s **server Argon2id**, bearer sessions, principal mapping, recovery and future API remain separate and unchanged. Local credentials do not become cloud credentials. No dependencies, network/server/cloud work, version/catalog/release changes or deployment are authorized.

## 2. KDF and alternatives

Use WebCrypto `crypto.subtle` PBKDF2-HMAC-SHA-256, fresh random **16-byte salt per account** from `crypto.getRandomValues`, **210000 iterations**, **256 output bits**. Import exact UTF-8 bytes; no fallback hash/dependency. Missing WebCrypto or derivation failure fails closed before publication/session.

Bare unsalted SHA-256 was considered and rejected: it is fast and therefore cheaply guessable offline, and equal passwords yield equal hashes without salt. SHA-256 is not described as reversible. PBKDF2 increases guessing work and random salts prevent direct same-password equality/precomputation reuse across accounts; offline attacks remain possible. A future owner decision could change the single PBKDF2 iteration parameter, including to 1; **this implementation does not create that weak mode**. Supported older low-iteration records are verified and upgraded. PBKDF2-HMAC-SHA-256 iteration 1 is still salted PBKDF2/HMAC construction, not bare unsalted SHA-256.

Compare derived/stored decoded 32-byte outputs using a fixed-length XOR accumulation loop. This is constant-time-ish source behavior only, not a JavaScript/JIT/WebCrypto timing guarantee. Never log plaintext, salt, hash, credential objects or password lengths.

## 3. Explicit password policy

Setup/registration minimum **6 Unicode code points**, maximum **1024 code points and 1024 UTF-8 bytes**, boundaries inclusive. Valid surrogate pairs count once; combining marks count separately, not as graphemes. No normalization, truncation, composition rules or paste restriction. Whitespace and case remain significant for derivation and exact confirmation; raw password bytes are preserved. For policy comparisons only, trim both password and handle and compare with JavaScript `toLowerCase()`; reject equality. The small blocklist `123456`, `password`, `qwerty`, `111111`, `123123` also compares the trimmed, lowercased password. No Unicode normalization or locale-specific case folding is applied. Unpaired UTF-16 surrogates are invalid rather than silently replaced by TextEncoder. Password length is never persisted.

Validation order: early UTF-16 length >1024 rejects `password_too_long` without allocation (every valid such string exceeds the UTF-8 bound); otherwise check unpaired surrogates in both password/confirmation fields, encoded password byte maximum, code-point minimum, trimmed case-insensitive handle equality, trimmed case-insensitive blocklist, then exact confirmation equality. The UTF-8 bound also enforces the code-point maximum. The creation validator requires the handle as its second argument, with optional confirmation third (defaulting to the password); auth registration/setup supply that handle, while UI delegates to setup. Storage accepts validated credential records, not plaintext policy inputs. Verification and iteration upgrades do not take a handle or apply creation policy. Separate codes, translated in all three locales:

| Rule | Code |
| --- | --- |
| Unpaired surrogate in either field | `password_invalid_unicode` |
| More than 1024 UTF-8 bytes | `password_too_long` |
| Fewer than 6 code points | `password_too_short` |
| Trimmed case-insensitive equality with handle | `password_same_as_handle` |
| Trimmed case-insensitive small blocklist match | `password_too_common` |
| Valid password and unequal confirmation | `confirmation_mismatch` |

Login does not apply the new minimum to historical passwords: bounded, well-formed input, including empty, undergoes verification. Oversized/malformed input fails generically before PBKDF2 and does not count as an actual verification failure. Wrong passwords remain on the password step with one generic localized `invalid_credentials` error and safe retry, not a field-specific hint. Unknown exceptions use localized generic failure, never raw messages. Setup notices explain device-local loss, no recovery, exports before loss and the credentialless predecessor trust limit.

## 4. Storage shape and schema upgrade

Upgrade `runawaylog-vfiles` **IDB schema 1 → 2**, not app/domain/archive versions. Conditionally create missing stores, preserving control/generations/blobs/pins and current. Add objectStore **credentials**, out-of-line key `accountId`, value **only**:

```text
{ algorithm, iterations, saltB64, hashB64, createdAt, updatedAt }
```

`algorithm` is exactly `PBKDF2-HMAC-SHA-256`; WebCrypto uses `PBKDF2`/`SHA-256`. Require exactly six own fields; reject arrays/null/missing/extra fields. `iterations` integer 1..210000 inclusive; new/upgrade always 210000. Standard canonical padded base64 encodes salt16/hash32 (24/44 characters), length/alphabet checked before decode, decoded length/re-encode checked to reject invalid padding/pad bits/whitespace/URL-safe aliases. Times are safe integer nonnegative epoch milliseconds, updatedAt >= createdAt, updatedAt <=8640000000000000. Validate before expensive derivation. A stored key with undefined/null/invalid value is **not absence** and blocks lookup/login/setup, never overwrite-as-legacy.

`lib/storage` alone owns all persistence APIs, including sessionStorage. Credentials never enter virtual files, generation maps, blobs, account trees, manifest, export metadata, imports, ZIPs (ordinary or recovery), localStorage or logs. No password/hash/session credential caching. Credential lifetime is independent of tree GC; GC cannot collect credential records as blobs. Account deletion removes only that credential in the same final deletion transaction; unrelated credentials survive.

Blocked schema upgrades reject with actionable close-obsolete-tabs diagnostics and close any late successful orphan connection. `versionchange` closes/invalidates the handle and further driver access gives a reload diagnostic. A fresh obsolete client cannot silently continue writes. No destructive reset or alternate-backend fallback.

## 5. Actual state machine and sessions

1. Username only → exact handle lookup in the latest healthy local directory (not a UUID alias; local handle semantics, not cloud grammar).
2. Existing valid credential → password → verify bound account/record → await guarded publication and hydration → session.
3. Existing account, genuinely absent credential → new password + confirmation → atomic absent-key/current-identity guard → session.
4. Missing handle → setup → account and credential published together → session.
5. Malformed/unsupported credential or unreadable store → localized failure/recovery, never setup or empty replacement. Identity-changing races return `identity_changed`, requiring back/fresh lookup.

All public auth login/register/setup paths enforce this; no hidden empty-password bypass. Internal low-level repository fixtures may deliberately create credentialless predecessors, not a product login path. Credentialless setup proves only access to this installation, **not historical ownership**; the first setter can claim that old account. Explicitly communicate this trust limitation.

Password-step state lives in a keyed child: clear fields on success/back; back/account change/recovery/unmount discard the child. Async completion after unmount cannot invoke navigation callback. This is lifecycle disposal, not secure JavaScript memory zeroization. Failed verification keeps an error visible on the same password step; back does not reset service cooldown.

Session semantics remain memory + sessionStorage identity only: `username` and `{username}` currentUser, no bearer/mock token, hashes, salts or credential maps. Remove historical v2 session token/credential caches without reading/migrating their values; unrelated obsolete localStorage keys are ignored and preserved. Reload in an existing tab may restore identity; a new independent session asks again while device data/credentials remain. No stronger browser-tab isolation than browser sessionStorage semantics is claimed. Existing tabs do not reverify on every data operation; this is not a device/profile security boundary.

## 6. Exact atomic publication boundary

Credential derivation occurs outside IDB transactions. Reuse `storage.md` prepare → staged readback/integrity verification → final current-pointer commit. Candidates carry the credential intent only in transient memory, never the stored generation. No credential write during prepare or verify.

The final readwrite transaction spans credentials and existing stores. Recheck current/base revision and exact verified staged candidate, then transactionally read credential value **and key existence**. Absent expected value means key must be absent; rewrite expected value means all six old fields must still match. Account/handle predicates were checked against the immutable base directory and are protected by the same current CAS. Only then write credential if changed, mark committed, update current and first device metadata/release pins together. Session/memory publication awaits transaction.oncomplete, not put success. Failed staged/final candidates cannot half-create a published identity or stray credential.

Existing setup binds accountId/handle and absent credential; it preserves UUID, registration and all data. Competing tabs/first boot use current CAS. Revision-only conflicts rebase only while original identity predicates still hold. Same-handle creation/setup loser fails `identity_changed`: it does not overwrite or silently enter the winner, superseding ADR0006's prior same-handle reuse behavior for password creation. Different-handle first boots can rebase and retain both accounts/credentials. UI password submission also compares the username-step account identity to refuse deletion/replacement races. Successful verification rechecks exact credential and current account binding even without an upgrade.

For simplicity, verification at current parameters uses the existing verified COW publication path with empty domain changes: it creates a new manifest/generation/revision but performs **no credential put**. This retains the exact publication/session fence and has additional metadata/hydration/GC cost; it is not a claim of a read-only login. GC remains postcommit maintenance and cannot turn committed work into a replay. Existing strict-durability request/old-or-new guarantees remain, not browser-eviction/power-loss guarantees.

## 7. Upgrade-on-login

After correct verification where stored iterations <210000, derive current parameters using the **same salt**, outside the transaction. Preserve createdAt, set updatedAt=max(Date.now(), old.updatedAt+1), validate bounds. Guard against the **entire previously read record** and current account identity in final publication. Concurrent changes/deletion fail `identity_changed`, never overwrite or enter after a lost upgrade race. Await transaction completion before session. Current-parameter records are checked but not rewritten. Derivation/guard/commit failure leaves the old record and session untouched.

## 8. Demo cooldown

Auth owns per-page in-memory Map keyed accountId, outside component lifecycle; no persistent or cross-tab lockout. Serialize same-account verification attempts so parallel calls cannot race check/counter.

Count only completed actual validated-record password mismatches. Failures1–4 return generic `invalid_credentials`; failure5 starts **30000 ms** at completion and returns localized `cooldown`. While Date.now() < deadline, correct/wrong attempts are blocked before PBKDF2 without increment/extension. At exact >= boundary, reset before verification; successful verification plus required publication clears the entry. Expiry resets it; back/remount/logout/account switching do not clear it. Other accounts are independent. Malformed record/input, policy, crypto/storage or identity-change failures do not count.

This wall-clock per-page UX timer can be affected by device clock changes and disappears on page replacement. It is **not brute-force protection**: new page, edited app or offline guesses bypass it. No server rate-limit/security claim.

## 9. Loss and archive limits

Local passwords are unrecoverable: no reset, email/code recovery, escrow or server. Losing the password means product login cannot open that local account. Prevention is a verified export **before** loss; inaccessible accounts have no promised export-after-loss. Browser data/device loss is not recoverable without an existing export.

Archive format remains unchanged. Export ZIP payloads, account tree and manifest contain no credentials; importer never installs credentials or treats source identity/auth as ownership. Fresh target first goes through password creation, then explicit import into that target; target UUID/handle/registration/password remain local. Existing-target imports preserve their credential. Ordinary importer still rejects missing targets and forbidden credential paths.

This is an application local entry check, **not encryption or a security boundary against browser profile/device access, developer tools or XSS**. An operator/script can modify storage or bypass app checks. PBKDF2 does not authenticate integrity SHA-256, sign data or protect the device operator from access. Offline hash attacks remain. Never conflate this check/cooldown with cloud Argon2id/auth/recovery.

## 10. Ownership, budgets and verification

New pure KDF/policy responsibility is `lib/identity/password.ts`; IDB record/transaction primitives are `lib/storage/credential-commit.ts`, and queued domain intents are `lib/storage/credentials.ts` (split to keep commit dependencies acyclic); auth owns orchestration/cooldown and UI owns transient fields/localization. No lib→app/features or feature deep imports. Storage still owns browser persistence. No dependency, package/lock or version/spec/versions/catalog/release changes.

Owner-authorized size-budget rebase on 2026-11-16: total **non-test runtime `src/lib/storage/` + `src/lib/identity/` ≤1900 physical lines**; the **identity + credential-handling subset ≤300 physical lines**, including auth orchestration and inline persistence integration. Exclude only genuinely type-only model/state-model modules and unused legacy conversion, with exact exclusions and inclusive all-non-test totals reported. Count active executable validators/codecs/adapters. Report whole-file and attributable-inline subset costs explicitly; ambiguity or overrun needs owner disposition, not invented acceptance. No further increase is approved without splitting a responsibility into its own module; no relocation or formatting compression to meet ceilings.

Tests use real fake-indexeddb transactions and actual WebCrypto, dynamically generated salts/derived records and obviously synthetic passwords, never realistic credential literals/output. Required coverage: exact handle lookup; correct/wrong/empty/policy/mismatch; credentialless setup; cooldown exact boundary/back/account independence/concurrent calls; malformed/unsupported values; v1 upgrade preservation/blocked/versionchange; final-commit abort/completion; same/different-handle tab-like races; same-salt upgrade/concurrent rewrite; identity-only/fresh-session behavior; actual ZIP decode/credential absence/import target preservation; ownership and unchanged unrelated behavior. Fake IDB/jsdom are not real browser durability/quota/tab acceptance.

The executor report must name every added/adapted test and reason, actual file/line costs, raw outputs/exits/counts and remaining gaps. Freeze source then one sequential final `npx eslint .`, `npx tsc -b`, `npm test -- --run`, `npm run build`; a failed gate is blocked, not permission to fix/regate. Implementation+ADR and report commit separately, final Git state read back, no push. Owner/independent acceptance remains later; no acceptance claim here.

# Round B2 closeout report — narrow executor changes complete

## 1. Disposition and candidate

This is Soren's executor report, **not independent acceptance**. The two changes authorized by `.git/implementation-packet-b2.md` are complete. All four final gates returned **0**, once each, in the required sequential order. Tests passed **46 files / 492 cases**, with no skipped or deleted tests. The previously failing test, **`Settings opens the current month from the persisted record without invoking window.print`**, passed.

- Workspace: `/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a`.
- Branch: `storage-v2`.
- Verified clean starting revision: `be4815f67f58e4f4afe3300f83f8617e3b0a9b1e`.
- **Tested implementation candidate:** `17fc300893f84ff2e9824e0f4b94e05a67d51d8f`.
- Implementation commit: `test: version print fixtures and record approved storage ceiling`.
- Implementation commit inventory: **2 files, 4 insertions / 4 deletions**.
- Source was frozen before the four gates. There were no preliminary whole-suite runs, post-final source fixes, regates, browser checks, server launches, network operations, dependency changes, pushes, or deployments.
- All gates and the post-gate scope check finished before **2026-11-16T04:54:40Z**, ahead of the packet deadline **2026-11-16T05:09:40Z**.
- This report is committed separately so that the implementation candidate SHA is not self-referential. Final report-commit HEAD, branch, status and remotes are checked read-only after that commit and supplied in the terminal handoff.

## 2. Exact authorized changes and assertion preservation

### Print fixtures

Only `src/features/print/PrintCalendar.test.tsx:20–22` changed in the test file:

```diff
-  { id: 'boundary', at: Date.UTC(2026, 11, 1, 1) },
-  { id: 'same-day', at: Date.UTC(2026, 11, 1, 2) },
-  { id: 'december', at: Date.UTC(2026, 11, 15, 12) },
+  { id: 'boundary', at: Date.UTC(2026, 11, 1, 1), schemaVersion: 1, recordVersion: '1' },
+  { id: 'same-day', at: Date.UTC(2026, 11, 1, 2), schemaVersion: 1, recordVersion: '1' },
+  { id: 'december', at: Date.UTC(2026, 11, 15, 12), schemaVersion: 1, recordVersion: '1' },
```

The displayed Git diff contains exactly those three literal replacements and no other test-file edits. **Every existing test assertion remains byte-for-byte unchanged.** IDs, timestamps, test names, test bodies and assertions were not edited. These shared fixtures are also used by the other print/calendar tests; their assertions are unchanged too. The shared `seedRecord` helper was not modified, and no defaults were introduced to mask malformed callers. No tests were added, removed or skipped; all seven print-file cases passed within the full 492-case run.

### Product-generated hit path — read-only verification

The actual application path was inspected read-only:

- `src/features/run/Dashboard.tsx:4` imports `addHit` from the root storage facade.
- `src/features/run/Dashboard.tsx:289–291` counts a successful outcome by awaiting `addHit(userData.accountId)`, then awaiting the matching Run view.
- `src/storage.ts:50` delegates exported `addHit` to the storage adapter; the adapter factory at lines 43–46 returns `LocalStorageAdapter`.
- `src/storage.ts:22–28` allocates the hit once and awaits persistence:

```ts
async addHit(idOrHandle: string): Promise<Hit> {
  // Allocate once before the repository queues/rebases this intent.
  const hit: Hit = { id: crypto.randomUUID(), at: getCurrentTimestamp(), schemaVersion: 1, recordVersion: '1' };
  const account = await readRecord(idOrHandle);
  if (!account) throw new Error('Account not found');
  await appendHit(account.accountId, hit);
  return hit;
}
```

Thus the product-generated hit already explicitly emits **`schemaVersion: 1` / `recordVersion: '1'`**. The versionless-product STOP condition does not apply. No product file was edited.

### ADR0006 §10

Only `spec/decisions/0006-multi-file-store.md:194`, the §10 size-budget paragraph, changed. Its exact new wording is:

> Approved design alignment exception to [architecture.md](spec/architecture.md): storage facade ≤120 lines, responsibility files ≤200–250, storage runtime aggregate ≤1,750 excluding pure model/migration/test code; transfer facade ≤150, archive/validation each ≤250 and aggregate ≤650. Components target ≤150 lines, feature directory ≤6 files. Tests are not compressed to meet runtime budgets. Review justified overruns, do not hide feature-specific logic in storage. architecture.md alignment update belongs to implementation scope. The storage runtime aggregate ceiling is a one-time increase approved by Maia on 2026-11-16 after the measured 1,696 lines; no further increase is approved without splitting a responsibility into its own module.

The source paragraph's existing Markdown link remains `[architecture.md](../architecture.md)`; the quotation above adjusts only its destination for this report's location. The runtime aggregate ceiling is now **≤1,750**, excluding **pure model/migration/test code**, with the explicitly approved one-time exception after the previously measured **1,696**. B2 did not remeasure runtime or conduct a new architectural review. The rest of the paragraph's original wording and every other budget clause remain unchanged. Every other ADR section/reference is unchanged, including the existing architecture-alignment sentence. `architecture.md` was not edited.

### Complete file inventory

The implementation commit changes exactly:

1. `src/features/print/PrintCalendar.test.tsx` — three explicit versioned hit fixtures.
2. `spec/decisions/0006-multi-file-store.md` — §10 approved ceiling paragraph only.

The separate report commit adds only **`REPORT-B2.md`**. Prior `REPORT.md` / `REPORT-B.md`, architecture, all other spec files, package/lock/version/catalog files, shared helpers and product code remain unchanged.

Ignored execution artifacts are confined to `node_modules/.cache`: `impl-evidence-b2-run.py` is an unexecuted capture-wrapper script, and the unique `impl-evidence-b2/` directory contains `freeze.txt` plus the four raw gate logs listed below. Tool permission refusals prevented wrapper execution; they did not run any gate. The four gates were then invoked directly once each, with stdout and stderr redirected together to the unique evidence directory. No assertion of an automated hash freeze check is made: the frozen two-file scope was verified by Git diff/status, not by the unexecuted wrapper.

## 3. Commands, exits, counts and repository evidence

The four final commands were invoked **once each, sequentially**, in exactly this order. Redirection captured complete stdout and stderr without filtering or suppression. Successful Bash tool completion recorded actual exit **0** for each invocation. The build script itself includes its existing `tsc -b && vite build`; that is part of the requested build gate, not a separately repeated final TypeScript command.

| Order | Exact gate | Actual exit | Raw combined stdout/stderr |
|---:|---|---:|---|
| 1 | `npx eslint .` | 0 | `node_modules/.cache/impl-evidence-b2/01-eslint.log` |
| 2 | `npx tsc -b` | 0 | `node_modules/.cache/impl-evidence-b2/02-tsc.log` |
| 3 | `npm test -- --run` | 0 | `node_modules/.cache/impl-evidence-b2/03-test.log` |
| 4 | `npm run build` | 0 | `node_modules/.cache/impl-evidence-b2/04-build.log` |

Tests: **46 passed files / 46 total; 492 passed cases / 492 total; zero failed, skipped or deleted**. Existing React `act(...)` warnings, jsdom navigation notices, stale browser-data advisories and Vite mixed-import notices remain visible in the raw evidence. They were not fixed or suppressed.

Other executed relevant commands:

- `git diff -- src/features/print/PrintCalendar.test.tsx spec/decisions/0006-multi-file-store.md` — exit **0**; exact two-file diff, no assertion changes.
- `git status --porcelain; git diff --stat; git diff --check; git remote -v; date -u '+%Y-%m-%dT%H:%M:%SZ'` — completed exit **0**; output below. `git diff --check` emitted no errors. This was a scope/status check, not another final gate.
- `git add -- src/features/print/PrintCalendar.test.tsx spec/decisions/0006-multi-file-store.md` — exit **0**.
- `git commit -m "test: version print fixtures and record approved storage ceiling" -m "Co-Authored-By: Claude Code <noreply@anthropic.com>"` — exit **0**, two files only.
- `git rev-parse HEAD; git branch --show-current; git status --porcelain; git remote -v; git show --format=fuller --stat --oneline HEAD` — completed exit **0**; clean implementation-commit state and no remotes, output below.

Post-gate scope/status output:

```text
 M spec/decisions/0006-multi-file-store.md
 M src/features/print/PrintCalendar.test.tsx
 spec/decisions/0006-multi-file-store.md   | 2 +-
 src/features/print/PrintCalendar.test.tsx | 6 +++---
 2 files changed, 4 insertions(+), 4 deletions(-)
2026-11-16T04:54:40Z
```

Implementation commit output:

```text
[storage-v2 17fc300] test: version print fixtures and record approved storage ceiling
 2 files changed, 4 insertions(+), 4 deletions(-)
```

Pre-report verification output:

```text
17fc300893f84ff2e9824e0f4b94e05a67d51d8f
storage-v2
17fc300 test: version print fixtures and record approved storage ceiling
 spec/decisions/0006-multi-file-store.md   | 2 +-
 src/features/print/PrintCalendar.test.tsx | 6 +++---
 2 files changed, 4 insertions(+), 4 deletions(-)
```

At that verified implementation HEAD, **`git status --porcelain` produced zero bytes** and **`git remote -v` produced zero bytes**: clean worktree, no configured remotes. This report did not yet exist at that checkpoint. Its separate commit and final read-only repository verification follow report creation; the final HEAD is intentionally not predicted here.

## 4. Remaining gaps and non-acceptance

B2 closes only the missed explicit print fixture versions and records Maia's approved one-time aggregate ceiling. **Previous B gaps were not reopened.** `REPORT-B.md` remains the unmodified historical record; its original failed-gate and overrun statements describe that earlier candidate, while this report records B2's new gate results and authorized ADR exception.

The earlier provenance-envelope headroom, restore exact-byte/version-growth equality, selective boot/dormant corruption and GC predecessor-health limits, explicit full-recovery/full-read memory costs, fflate private endpoint coupling/strict ZIP profile, existing large-component overruns, multi-account dialog selection limits, and browser durability/reload/tab/quota/eviction/power-loss/print acceptance gaps remain unreviewed and unresolved by B2. Architecture alignment, delivery/version/catalog/release work and cloud/auth gates are outside this closeout. SHA-256 integrity is not operator authenticity. The supplied 1,696-line measurement was not independently revalidated here.

Passing these four local gates is **not broader implementation acceptance, browser acceptance, release approval or independent review**. No additional fixes or review pass were performed.

## 5. Complete raw gate outputs

The following blocks reproduce the complete captured combined stdout/stderr, including ANSI terminal sequences where emitted. Exit values are recorded separately from output so no synthetic exit line is mistaken for tool output.

### 1. `npx eslint .` — actual exit 0

```text
[baseline-browser-mapping] The data in this module is over two months old.  To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
```

### 2. `npx tsc -b` — actual exit 0

Raw output is empty (zero bytes):

```text
```

### 3. `npm test -- --run` — actual exit 0

```text

> runawaylog@1.2.0 test
> vitest --run


[1m[46m RUN [49m[22m [36mv4.0.15 [39m[90m/Users/emmett/workspace/macacloud/.aside-work/soren/storage-impl-a[39m

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

 [32m✓[39m src/features/print/PrintCalendar.test.tsx [2m([22m[2m7 tests[22m[2m)[22m[33m 633[2mms[22m[39m
     [33m[2m✓[22m[39m Settings opens the current month from the persisted record without invoking window.print [33m 348[2mms[22m[39m
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

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mwrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus
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

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mwrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus
[22m[39mAn update to Dashboard inside a test was not wrapped in act(...).

When testing, code that causes React state updates should be wrapped into act(...):

act(() => {
  /* fire events that update state */
});
/* assert on the output */

This ensures that you're testing the behavior the user would see in the browser. Learn more at https://react.dev/link/wrap-tests-with-act

[90mstderr[2m | src/features/run/Run.test.tsx[2m > [22m[2mrun-owned invariants[2m > [22m[2mwrong fork and boom neither count nor consume the scene; all fork controls are reachable and the successful trigger regains focus
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

 [32m✓[39m src/features/run/Run.test.tsx [2m([22m[2m11 tests[22m[2m)[22m[33m 1326[2mms[22m[39m
     [33m[2m✓[22m[39m records once under double press and claims the scene once across route remounts, rearming only for a new page tree [33m 729[2mms[22m[39m
 [32m✓[39m src/lib/storage/core.test.ts [2m([22m[2m11 tests[22m[2m)[22m[33m 1689[2mms[22m[39m
     [33m[2m✓[22m[39m projects exact timestamps and recent fifty without statistics fetching history chunks [33m 1192[2mms[22m[39m
 [32m✓[39m src/lib/storage/selective.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 1912[2mms[22m[39m
   [33m[2m✓[22m[39m hydrates no history on reload and fetches only recent-reference chunks for the log view [33m 1799[2mms[22m[39m
 [32m✓[39m src/lib/data/archive-import.test.ts [2m([22m[2m36 tests[22m[2m)[22m[33m 1068[2mms[22m[39m
     [33m[2m✓[22m[39m enforces actual streamed manifest and payload caps despite false bounded advertised sizes [33m 325[2mms[22m[39m
     [33m[2m✓[22m[39m accepts actual manifest/payload caps at exact equality without trusting an allocation hint [33m 642[2mms[22m[39m
Not implemented: navigation to another Document
Not implemented: navigation to another Document
 [32m✓[39m src/lib/storage/source-codec.test.ts [2m([22m[2m51 tests[22m[2m)[22m[33m 2852[2mms[22m[39m
     [33m[2m✓[22m[39m keeps exact 12 MiB canonical equality inline and fragments the next byte into <=8 MiB binary parts [33m 2523[2mms[22m[39m
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

 [32m✓[39m src/test/settings-data.test.tsx [2m([22m[2m7 tests[22m[2m)[22m[33m 1004[2mms[22m[39m
     [33m[2m✓[22m[39m never writes on file selection or cancel; replace requires explicit destructive confirmation [33m 385[2mms[22m[39m
 [32m✓[39m src/lib/data/transfer.test.ts [2m([22m[2m22 tests[22m[2m)[22m[33m 3151[2mms[22m[39m
     [33m[2m✓[22m[39m exports a single v2 user, metadata, and global unknown rescue; migrates a legacy roundtrip with zero loss/duplication [33m 663[2mms[22m[39m
     [33m[2m✓[22m[39m deduplicates logical provenance across ZIP export times and repeated export/import without recursive wrappers [33m 404[2mms[22m[39m
 [32m✓[39m src/test/i18n-surfaces.test.tsx [2m([22m[2m33 tests[22m[2m)[22m[33m 3160[2mms[22m[39m
 [32m✓[39m src/features/run/Run.failure.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 3196[2mms[22m[39m
     [33m[2m✓[22m[39m shows a rejected real IDB write, preserves history and the scene claim, then unlocks for one safe retry [33m 3195[2mms[22m[39m
 [32m✓[39m src/ui/RecoveryPanel.test.tsx [2m([22m[2m8 tests[22m[2m)[22m[33m 830[2mms[22m[39m
 [32m✓[39m src/lib/storage/integrity-commands.test.ts [2m([22m[2m3 tests[22m[2m)[22m[33m 1399[2mms[22m[39m
     [33m[2m✓[22m[39m rejects historical ids outside recent fifty using the index without fetching old chunks [33m 1177[2mms[22m[39m
[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mcompiler rejects missing and extra keys at top level and nested levels
[22m[39mCompiler rejected missing: Type '{ title: string; }' is missing the following properties from type '{ title: string; run_button: string; hit_count: string; logout: string; settings: string; brand_title: string; }': "run_button", "hit_count", "logout", "settings", "brand_title"
Compiler rejected extra: Object literal may only specify known properties, and 'unexpected' does not exist in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 15 more ...; run_scene: { ...; }; }'.
Compiler rejected nested extra: Object literal may only specify known properties, and 'unexpected' does not exist in type '{ title: string; run_button: string; hit_count: string; logout: string; settings: string; brand_title: string; }'.
Compiler rejected top missing: Type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }' does not satisfy the expected type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 15 more ...; run_scene: { ...; }; }'.
  Property '"dashboard"' is missing in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 14 more ...; run_scene: { ...; }; }' but required in type '{ quotes: string[]; calendar: { day_one: string; day_many: string; }; surface_error: { title: string; retry: string; }; releases: { title: string; subtitle: string; v110_title: string; v110_1: string; v110_2: string; ... 14 more ...; version: string; }; ... 15 more ...; run_scene: { ...; }; }'.

[90mstdout[2m | src/lib/i18n/parity.test.ts[2m > [22m[2mtyped locale parity against committed shipped XML output[2m > [22m[2mretains the existing hardcoded-copy AST rule and applies it to features/ui
[22m[39mUnchanged hardcoded-copy AST rule: 39 sources; 0 findings; directories: src/features, src/ui

 [32m✓[39m src/lib/i18n/parity.test.ts [2m([22m[2m13 tests[22m[2m)[22m[33m 986[2mms[22m[39m
     [33m[2m✓[22m[39m compiler rejects missing and extra keys at top level and nested levels [33m 811[2mms[22m[39m
 [32m✓[39m src/lib/storage/canonical-validation.test.ts [2m([22m[2m12 tests[22m[2m)[22m[33m 1015[2mms[22m[39m
 [32m✓[39m src/features/profile/Profile.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 747[2mms[22m[39m
   [33m[2m✓[22m[39m localizes member duration and persists email and the original registration date in en_us [33m 401[2mms[22m[39m
 [32m✓[39m src/test/settings-preferences.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 486[2mms[22m[39m
   [33m[2m✓[22m[39m settings changes persist across remount; cloud is inert and local writes never fetch [33m 486[2mms[22m[39m
 [32m✓[39m src/lib/storage/restore.test.ts [2m([22m[2m7 tests[22m[2m)[22m[33m 841[2mms[22m[39m
 [32m✓[39m src/features/games/Games.test.tsx [2m([22m[2m2 tests[22m[2m)[22m[33m 655[2mms[22m[39m
   [33m[2m✓[22m[39m persists keyboard-accessible game toggles per user and leaves coming-soon controls inert [33m 523[2mms[22m[39m
 [32m✓[39m src/lib/storage/cross-tab.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 655[2mms[22m[39m
Not implemented: navigation to another Document
 [32m✓[39m src/test/settings-header-import.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 518[2mms[22m[39m
   [33m[2m✓[22m[39m header import obeys confirmation and preserves profile, games, identity, and device preferences [33m 517[2mms[22m[39m
 [32m✓[39m src/lib/data/archive.export.test.ts [2m([22m[2m26 tests[22m[2m)[22m[33m 506[2mms[22m[39m
 [32m✓[39m src/lib/storage/gc-fault.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 1194[2mms[22m[39m
 [32m✓[39m src/lib/storage/consumers.test.ts [2m([22m[2m5 tests[22m[2m)[22m[33m 882[2mms[22m[39m
     [33m[2m✓[22m[39m class LocalStorageAdapter {
  loadUserData(idOrHandle) {
    return (0,__vite_ssr_import_1__.readRecord)(idOrHandle);
  }
  async addHit(idOrHandle) {
    const hit = { id: crypto.randomUUID(), at: (0,__vite_ssr_import_2__.getCurrentTimestamp)(), schemaVersion: 1, recordVersion: "1" };
    const account = await (0,__vite_ssr_import_1__.readRecord)(idOrHandle);
    if (!account) throw new Error("Account not found");
    await (0,__vite_ssr_import_1__.appendHit)(account.accountId, hit);
    return hit;
  }
  syncData() {
    return (0,__vite_ssr_import_1__.flushWrites)();
  }
  async deleteUserData(idOrHandle) {
    const account = await (0,__vite_ssr_import_1__.readRecord)(idOrHandle);
    if (!account) throw new Error("Account not found");
    await (0,__vite_ssr_import_1__.deleteRecord)(account.accountId);
  }
} migrates on load and preserves extras and peers on save/delete [33m 359[2mms[22m[39m
 [32m✓[39m src/lib/storage/recovery.test.ts [2m([22m[2m14 tests[22m[2m)[22m[32m 275[2mms[22m[39m
 [32m✓[39m src/app/routes.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[33m 324[2mms[22m[39m
 [32m✓[39m src/lib/storage/publication.test.ts [2m([22m[2m6 tests[22m[2m)[22m[33m 337[2mms[22m[39m
 [32m✓[39m src/lib/storage/platform-failure.test.ts [2m([22m[2m2 tests[22m[2m)[22m[33m 414[2mms[22m[39m
   [33m[2m✓[22m[39m restarts an expired pinned read after GC and reports missing generations as restartable [33m 333[2mms[22m[39m
 [32m✓[39m src/lib/storage/byte-boundary.test.ts [2m([22m[2m1 test[22m[2m)[22m[33m 612[2mms[22m[39m
   [33m[2m✓[22m[39m allows exactly one million UTF-8 envelope bytes and rolls the next byte without rewriting the completed tail [33m 611[2mms[22m[39m
 [32m✓[39m src/ui/Login.storage.test.tsx [2m([22m[2m1 test[22m[2m)[22m[33m 419[2mms[22m[39m
   [33m[2m✓[22m[39m offers a downloadable original-byte rescue when a malformed store blocks login [33m 418[2mms[22m[39m
 [32m✓[39m src/test/storage.test.ts [2m([22m[2m13 tests[22m[2m)[22m[33m 936[2mms[22m[39m
 [32m✓[39m shared/codec.test.ts [2m([22m[2m70 tests[22m[2m)[22m[32m 69[2mms[22m[39m
 [32m✓[39m src/test/timezone.test.ts [2m([22m[2m21 tests[22m[2m)[22m[32m 60[2mms[22m[39m
 [32m✓[39m src/features/about/About.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[32m 283[2mms[22m[39m
 [32m✓[39m src/lib/storage/migrate.test.ts [2m([22m[2m18 tests[22m[2m)[22m[33m 387[2mms[22m[39m
 [32m✓[39m src/lib/storage/preservation.test.ts [2m([22m[2m5 tests[22m[2m)[22m[32m 226[2mms[22m[39m
 [32m✓[39m src/ui/SurfaceBoundary.test.tsx [2m([22m[2m3 tests[22m[2m)[22m[32m 266[2mms[22m[39m
 [32m✓[39m src/lib/i18n/extension.test.tsx [2m([22m[2m4 tests[22m[2m)[22m[32m 228[2mms[22m[39m
 [32m✓[39m shared/integrity.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 27[2mms[22m[39m
[90mstdout[2m | src/test/i18n.test.ts[2m > [22m[2mi18n shipped fixture parity[2m > [22m[2mevery literal i18n.t call in every source file resolves to a string in every locale
[22m[39mChecked 287 literal calls (181 unique paths) across 129 source files in all 3 locales.

 [32m✓[39m src/test/i18n.test.ts [2m([22m[2m4 tests[22m[2m)[22m[33m 416[2mms[22m[39m
     [33m[2m✓[22m[39m every literal i18n.t call in every source file resolves to a string in every locale [33m 363[2mms[22m[39m
 [32m✓[39m src/lib/storage/preferences.test.ts [2m([22m[2m6 tests[22m[2m)[22m[32m 102[2mms[22m[39m
 [32m✓[39m src/lib/storage/ownership.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 20[2mms[22m[39m
 [32m✓[39m src/test/quotes.test.ts [2m([22m[2m4 tests[22m[2m)[22m[32m 7[2mms[22m[39m
 [32m✓[39m src/lib/storage/registration.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 31[2mms[22m[39m
 [32m✓[39m src/test/i18n-structure.test.ts [2m([22m[2m3 tests[22m[2m)[22m[32m 19[2mms[22m[39m
[90mstdout[2m | src/test/i18n-hardcoded.test.ts[2m > [22m[2mi18n hardcoded copy — compiler API inventory[2m > [22m[2mwalks all component/page TSX files and excludes comments by construction
[22m[39mAST scanned 30 TSX files; 0 findings (comments excluded, empty alt allowed, placeholder unchecked).

 [32m✓[39m src/test/i18n-hardcoded.test.ts [2m([22m[2m2 tests[22m[2m)[22m[32m 5[2mms[22m[39m
 [32m✓[39m src/test/runScene.test.tsx [2m([22m[2m23 tests[22m[2m)[22m[33m 12365[2mms[22m[39m
     [33m[2m✓[22m[39m T7: the scene opens after the first successful Run and not again in the same session [33m 3838[2mms[22m[39m
     [33m[2m✓[22m[39m T7: a fresh component tree (as a reload) re-arms the scene [33m 3165[2mms[22m[39m
     [33m[2m✓[22m[39m T6: a full Run → choose → Close cycle writes nothing scene-related [33m 1622[2mms[22m[39m
     [33m[2m✓[22m[39m restores focus to the Run control after Skip and Escape (AC-A21) [33m 3175[2mms[22m[39m

[2m Test Files [22m [1m[32m46 passed[39m[22m[90m (46)[39m
[2m      Tests [22m [1m[32m492 passed[39m[22m[90m (492)[39m
[2m   Start at [22m 12:54:07
[2m   Duration [22m 13.34s[2m (transform 2.65s, setup 8.22s, import 3.31s, tests 48.53s, environment 12.83s)[22m

```

### 4. `npm run build` — actual exit 0

```text

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
✓ built in 692ms
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
```

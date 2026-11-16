# Bounded local quality baseline

These tools do not install Playwright, modify the application bundle, or seed browser storage behind the UI. Use the existing host module. Every execution must be permitted by the local harness; a blocked command is **not** a failed test or a passing zero-test run.

## Built-artifact browser smoke and axe

Build the candidate first (`npm run build`). Install only the authorized `axe-core` dev dependency (`npm install -D axe-core`); no Playwright project dependency is needed. Example with the existing host module on this executor:

```sh
QUALITY_PLAYWRIGHT_MODULE=/Users/emmett/.hermes/hermes-agent/node_modules/.pnpm/playwright@1.64.0/node_modules/playwright \
QUALITY_CHROMIUM_EXECUTABLE='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=mac15-arm64 \
node tools/quality/browser-smoke.mjs
```

The mac15 override is explicit because the native mac26 WebKit mirror archive returned 404. It installed WebKit 27.2 revision 2370 using the compatibility archive. Do not describe that as a native-platform installation. Other hosts can omit the override and Chromium executable override.

`QUALITY_EVIDENCE_DIR` optionally selects a different evidence folder. `QUALITY_ENGINES` can select engines during development; acceptance requires the unmodified three-engine default, not a Chromium substitute. Missing axe is recorded as an error, not ignored. The default runner scans login, home after one Run, settings, and the print dialog in Chromium only. The print scan uses `.print-dialog` scope, not the obscured background or a full-page claim. Every reported violation retains rule ID, severity, all nodes, and raw axe details; incomplete rules are retained separately. No axe rule is disabled.

The runner probes an ephemeral loopback port, then Vite preview binds `127.0.0.1` with `strictPort`; it never uses or terminates port 4188. It closes its own contexts/browser/server in `finally` and attempts to rebind the owned port to verify release. Non-loopback network requests are aborted; service workers are blocked to avoid cached/PWA artifacts. Fonts may therefore differ from an online session. A fresh privacy context creates the source through the username/password UI, performs one committed Run, reloads and checks one, downloads actual ZIP bytes, opens print, creates a fresh target password in a second context, invokes the native file chooser, explicitly checks replacement confirmation, and verifies one after import/reload. The production boom easter egg can legitimately produce no hit: the runner retries only while the real displayed count remains zero (at most three attempts), recording actual attempts, without replacing randomness or store commands.

Screenshots/ZIPs are produced only when the corresponding real steps execute. ZIP files contain synthetic test data only. The runner logs no credential records or password hashes. Never commit exports from real user sessions.

## Command-backed index measurements

```sh
RUN_INDEX_BENCHMARK=1 npm test -- --run \
  --config tools/quality/index-benchmark.vitest.ts --reporter=verbose
```

The explicit tools-only config selects `index-benchmark.bench.ts`; the ordinary test glob does not run this expensive benchmark. An additional environment guard prevents accidental execution. It uses existing Vitest/jsdom/fake-indexeddb and production `createAccount`, `importHits` (batch), `appendHit`, `buildRunView`, and `Statistics` rendering. It does **not** claim ZIP-seeded benchmark data: `importHits` is the existing validated batch repository command with empty source provenance. Browser smoke separately validates real ZIP/UI import when permitted.

For each exact baseline 1,000/10,000/50,000, it reads committed `run/index.json` byte length before five real append samples. It measures five fresh production RunView projections and five fresh production Statistics component server renders at the exact baseline after one warmup each, then five sequential append receipts at N through N+4, with readback outside the measured interval and final N+5 disclosed. Statistics timing includes React/i18n/markup overhead; it is not a pure selector microbenchmark. Data has unique hourly timestamps/UUIDs. This is Node + jsdom + fake-IDB wall time, **not browser, SSD, real power-loss, or multi-tab performance**. Exact raw samples and environment are written only after actual execution. The owned fake database and storage connection/channel/listeners are cleaned up; there is no direct IDB seeding or app debug global.

## Durability and final gates

`src/lib/storage/publication.test.ts` adds the missing verified-stage, pre-pointer interruption followed by close/reopen/readback case. Existing recovery, GC-fault, and cross-tab cases are named in `evidence/durability-summary.json`. Source inspection is not execution evidence. See `REPORT-QUALITY.md` for actual executed counts and permission blockers.

Run final gates once, in this order, after all executable changes are frozen:

```sh
npx eslint .
npx tsc -b
npm test -- --run
npm run build
```

Capture complete stdout/stderr and actual exits. Do not repeat failed final gates or claim independent acceptance. No CI browser E2E, PWA upgrade round, cloud work, version changes, push, or deployment is part of this packet.

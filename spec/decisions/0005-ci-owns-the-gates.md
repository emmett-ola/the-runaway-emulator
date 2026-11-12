# 0005 — CI owns the gates; `verify-build.sh` is retired

- Date: 2026-11-12. Decider: Maia (operating decision, framework delegation).
- Status: accepted.

## Context

The repository has no CI. Whether lint, types, tests and build pass depends on
which colleague happened to run them, and the one script that looks like a gate —
`verify-build.sh` — reports "All checks passed" whenever a `dist/` exists, even if
that `dist/` was built from a different commit (D-1, open since 2026-11-11). Two
rounds in 2026-11 have already been spent working around gate claims instead of
building on them.

## Decision

A GitHub Actions workflow runs on every push and pull request: `npm ci`,
`npm run lint`, `npx tsc -b`, `npm run test -- --run`, `npm run build`. Lint fails
only when the error count **rises above the recorded baseline** (currently five),
so debt is capped rather than pretended away.

On pushes to `main`, a second job verifies the deployment: resolve the production
alias to a deployment id, compare the sha256 of served shell/JS/CSS with the build
from the same commit, and require the `-git-main-` alias to be present.
`gitSource.sha` is asserted when an API token is available.

`verify-build.sh` is deleted. If a local convenience script is wanted later it must
be derived from the CI steps, not written separately.

## Consequences

- A green claim becomes a readable artifact with a commit attached.
- The lint baseline is a number in the workflow; improving it is a small commit
  that also lowers the cap.
- Identity of a release no longer depends on a colleague's report.

## Evidence

`spec/delivery.md`; defect D-1 in the framework repository; the 2026-11-12 release
record's token-free identity procedure (served-byte comparison plus alias list),
which is what the CI job automates.

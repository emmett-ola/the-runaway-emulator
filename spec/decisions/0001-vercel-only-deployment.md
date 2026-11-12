# 0001 — Vercel is the only deployment path

- Date: 2026-11-12. Decider: Maia (operating decision, framework delegation).
- Status: accepted.

## Context

The repository carries two deployment stories: `vercel.json` plus a Git
integration that produces `runaway.macacloud.com`, and a self-hosting set
(`Dockerfile`, `compose.yml`, `nginx.conf`, `.dockerignore`). Every release of
2026-11-11/12 shipped through Vercel. Nothing has ever been built or run from the
Docker set, so its correctness is unknown — and an unknown alternative is not a
fallback, it is a second thing to maintain and to get wrong.

## Decision

Vercel is the only supported deployment. The self-host files move to
`archived/selfhost/` with a README stating they were never the release path and
what would be required to revive them. `verify-build.sh` is retired (see 0005).

## Consequences

- One place to verify identity, one place to roll back (alias change).
- The `nginx.conf` and Docker files stop implying a supported route to run this.
- Reviving self-hosting is a new decision with its own evidence, not a silent
  resurrection by copying the files back.

## Evidence

Framework record `spec/records/handoffs/2026-11-12-run-hard-errors.md` §5 (release
via Vercel); `spec/records/2026-11-12-run-health-check.md` (all flows exercised
against the deployed URL).

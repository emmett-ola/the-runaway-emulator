# Delivery

## One deployment path

Vercel is the only deployment. `vercel.json` and the Git integration on
`origin/main` produce `runaway.macacloud.com`. The self-hosting artifacts
(`Dockerfile`, `compose.yml`, `nginx.conf`, `.dockerignore`) are **archived, not
kept as a live alternative**: they move to `archived/selfhost/` with a dated
README saying they were never the path any release used. Reviving them is a new
decision (ADR), not a fallback nobody tested.

`verify-build.sh` is retired. It could report "All checks passed" for a `dist/`
it never built (D-1) — a gate that lies is worse than no gate, and its job is now
done by CI.

## Branches and release acts

- `main` is the only long-lived branch. RUN has one environment, so a
  `develop → testing → main` model would add ceremony without adding a check
  (framework decision 2026-11-12, §5).
- **A push to `main` is a release act.** It happens after an increment passes
  acceptance, never as a save. Work in progress stays in the contributor's clone
  or workspace.
- Feature branches inside a colleague's clone are fine and are never pushed.

## CI — the gates stop depending on who ran them

`.github/workflows/ci.yml`, on every push and pull request:

```
npm ci
npm run lint        # honest baseline, see below
npx tsc -b
npm run test -- --run
npm run build
```

Red CI does not block a push — the branch is the owner's — but a release whose CI
is red is not a release. The current lint baseline is five errors (three
`no-explicit-any`, two `no-unused-vars`); the workflow fails only if the count
**rises**, so debt is capped instead of pretending to be clean.

On pushes to `main`, a second job verifies the deployed artifact:

1. resolve `runaway.macacloud.com` → deployment id (`vercel inspect --json`);
2. fetch the served shell, JS and CSS and compare their sha256 against the build
   produced in the same run;
3. require the deployment's alias list to contain both the production alias and
   the `-git-main-` alias.

`gitSource.sha` is checked when an API token is available in CI; when it is not,
the content comparison above is the identity proof, because it is strictly
stronger than a label. Recorded limitation: the local CLI cannot read
`gitSource` without a token, so local verification relies on (2) and (3).

## Release record

Every released increment gets one record in the framework repository at
`spec/records/handoffs/YYYY-MM-DD-<slug>.md`: what changed, what is proven, what is
not, the deployment id, the hash trio, and the acceptance artifacts. The version
catalog (`versions.md`) gains a row. No second summary document.

## Environments and secrets

No environment variables are required at runtime. Should one become necessary, it
lives in the Vercel project settings and never in the repository. No credentials
are read, printed or committed by any round.

## Rollback

A bad release is corrected by a new commit, or — when it must come down fast — by
promoting the previous deployment to the production alias in Vercel, which takes
seconds and needs no code change. The previous deployment id is recorded in the
version catalog for exactly this purpose.

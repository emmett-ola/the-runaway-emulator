# Delivery

## One deployment path

Vercel is the only deployment. `vercel.json` and the Git integration on
`origin/main` produce `runaway.macacloud.com`. The self-hosting artifacts
(`Dockerfile`, `compose.yml`, `nginx.conf`, `.dockerignore`) are **archived, not
kept as a live alternative**: they move to `archived/selfhost/` with a dated
README saying they were never the path any release used. Reviving them would be its own
version with its own evidence, not a fallback nobody tested.

`verify-build.sh` is retired. It could report "All checks passed" for a `dist/`
it never built (D-1) — a gate that lies is worse than no gate, and its job is now
done by CI.

## Branches and release acts

- Three long-lived branches, in the order the collaboration contract sets:
  `develop` is the integration line, `testing` is what acceptance runs against,
  `main` is production. Promotion is fast-forward only: `develop` → `testing` →
  `main`.
- `main` is what Vercel deploys (`runaway.macacloud.com`). **A promotion to `main`
  is a release act.** It happens after an increment passes its gates and is
  accepted, never as a save.
- Large work lives on `dev/*` and merges back into `develop` first. Feature
  branches inside a colleague's clone are never pushed.
- The only standardized tag is `version/X.Y.Z`, placed on the `develop` commit the
  version record names.

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

Every released increment gets its own record at `spec/versions/X.Y.Z.md`: scope,
decisions, exact commits, the commands run and their results, status, known
limitations, the deployment id and the served-byte identity. `spec/versions/README.md`
carries the ladder that points at those records. No framework copy, no changelog, no
second summary document — records stay in this repository.

## Environments and secrets

No environment variables are required at runtime. Should one become necessary, it
lives in the Vercel project settings and never in the repository. No credentials
are read, printed or committed by any round.

## Rollback

A bad release is corrected by a new commit, or — when it must come down fast — by
promoting the previous deployment to the production alias in Vercel, which takes
seconds and needs no code change. The previous deployment id is recorded in the
version catalog for exactly this purpose.

# RUN — operating guide

Read this before doing anything in the repository. It is the authoritative guide for this
project; the framework repository (ASIDE) holds the collaboration contract, not RUN's facts.

## What this is

The Runaway Emulator (`runaway.macacloud.com`): a single-page React 19 + Vite app that
records "run away" moments and shows them as a calendar. Device-local data only; cloud
storage is designed and disabled.

## Reading order

1. this file;
2. `facts/` — current truth, one fact per module: [product](facts/product.md),
   [architecture](facts/architecture.md), [data model](facts/data-model.md),
   [storage](facts/storage.md), [identity](facts/identity.md), [i18n](facts/i18n.md),
   [delivery](facts/delivery.md), [cloud](facts/cloud.md);
3. `versions/README.md` — the ladder; then the record of the version you are touching;
4. `backlog/README.md` — deferred work and open questions, with the reason.

## Language

Repository documents under `spec/` are English. Reports to the owner are Chinese. The front
page may exist in several languages (`README.md`, `README_CN.md`) — the owner wants that; it is
the one place where the same content in two languages is allowed. User-visible copy ships in
`en_us`, `zh_cn` and `zh_tw` or it is not done.

## Commands

```
npm ci
npx eslint .
npx tsc -b
npm run test -- --run     # vitest; files run sequentially on purpose (see backlog)
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same four gates on every push and pull request, and
on `main` also verifies that the deployment serving `runaway.macacloud.com` is built from that
commit (alias resolution plus served-byte sha256). A release whose CI is red is not a release.

## Facts, versions, branches

- **One fact, one place.** A fact changes by editing its document in `facts/`. No supplement
  file, no retained copy of a superseded claim — Git holds history.
- **Every change belongs to a version.** Scope, decisions, exact commits, the commands run and
  their results, status, known limitations, deployment identity. One record per version in
  `versions/X.Y.Z.md`, one row in `versions/README.md`. No changelog, no decision ledger.
- **Acceptance is not self-acceptance.** An implementer never accepts its own candidate;
  without an independent acceptor the state is "delivered, not accepted" and the record says so.
- **Branches:** `develop` → `testing` → `main`, fast-forward only; large work on `dev/*` merged
  into `develop` first; the only standardized tag is `version/X.Y.Z` on a `develop` commit.
  Promoting to `main` is a release act.
- `package.json` carries the version the About surface displays; the build injects it, so the
  label cannot drift from the artifact.

## Boundaries

- Never commit `data/` or any real local state; sample data lives with the code and is marked.
- No secrets, tokens or credentials in the repository, in a record, or in a report.
- Deployment happens only through Vercel from `main`. Self-hosting artifacts are deleted (Git
  history keeps them); reviving them is a new version with its own evidence.
- Cloud operation stays off until the owner opens it. See [cloud](facts/cloud.md).
- Nothing here is published outside the internal host without an owner decision.

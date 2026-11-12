# Version catalog

The authority for "what is deployed, from which commit, and what came before it".
`package.json` carries the version that the About surface displays (one source: the
build injects it, so the label cannot drift from the artifact — the current
`Version 1.1.0` string against a `1.0.0` package is exactly the drift this ends).

| Version | Commit | Deployment | Status | Notes |
| --- | --- | --- | --- | --- |
| 1.0.0 | `fdcd731` | `dpl_ErTiLAB9bGR7u96HgFHjuD6bUYjZ` | superseded | print-surface repair + `zh_tw` logout, accepted with the independence caveat of that round |
| 1.0.1 | `41ad563` | `dpl_33Up86dcjbfTkTaPue45gDd2RugK` | superseded | two React correctness fixes; acceptance 5/6, D-12 deferred at the time |
| 1.0.2 | `27978af` | `dpl_8EMnAtYkcu41qMfx1CvWqA6jAVkZ` | **live** | rebuild step 1a: `lib/storage` owns the stored bytes; a missing registration date is repaired once and persisted (closes D-12). No user-visible change. Rollback target for the next release |
| 1.0.3 | `07f31d3` | `dpl_aubqqvhih…` | **CI infrastructure, not a version** | CI workflow, lint gate (baseline capped at 5) and deployed-identity check. Owner granted the GitHub `workflow` scope; first run `43196112701` passed (build 43 s, verify-production 10 s). Shipped bytes are identical to 1.0.2, so by the rule below this is not catalogued as a version |
| 1.1.0 | — | — | planned | rebuild step 1b (i18n typed locales + app shell); no intended user-visible change |
| 1.1.1 | — | — | planned | rebuild step 2 (settings + print) |
| 1.1.2 | — | — | planned | rebuild step 3 (run + scene) |
| 1.1.3 | — | — | planned | rebuild step 4 (games + album) |
| 1.1.4 | — | — | planned | rebuild step 5 (profile + about) |
| 1.2.0 | — | — | planned | cutover: legacy tree deleted, self-host files archived, deferred defects closed |

Rules:

- A row is added only when the deployment exists and its identity is verified; the
  planned rows are a schedule, not evidence.
- The **rollback target** is the previous live deployment id. Restoring it is an
  alias change in Vercel, not a code change.
- A patch bump never changes behaviour a user can see; the rebuild steps are patch
  or minor bumps for that reason, and the cutover is the only minor.
- Deleting or rewriting a row is not allowed. A wrong row is corrected by a new
  note in the same cell or by a superseding row.
- A documentation-only push may create a deployment with new identifiers; that is
  **not** a version and is not catalogued, because the built bytes are unchanged.
  The catalog tracks releases, not deployments.

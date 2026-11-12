# Version catalog

The authority for "what is deployed, from which commit, and what came before it".
`package.json` carries the version that the About surface displays (one source: the
build injects it, so the label cannot drift from the artifact — the current
`Version 1.1.0` string against a `1.0.0` package is exactly the drift this ends).

| Version | Commit | Deployment | Status | Notes |
| --- | --- | --- | --- | --- |
| 1.0.0 | `fdcd731` | `dpl_ErTiLAB9bGR7u96HgFHjuD6bUYjZ` | superseded | print-surface repair + `zh_tw` logout, accepted with the independence caveat of that round |
| 1.0.1 | `41ad563` | `dpl_33Up86dcjbfTkTaPue45gDd2RugK` | **live** | two React correctness fixes; acceptance 5/6, D-12 deferred; rollback target for the next release |
| 1.1.0 | — | — | planned | rebuild step 1 (skeleton, CI, storage + i18n libraries); no intended user-visible change |
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

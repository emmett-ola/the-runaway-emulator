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
| 1.1.0 | `9fa97b9` | `dpl_2nqrXCLCLaP6BuW2kfbUKFzFqGT9` | **live** | rebuild step 1b: typed locale modules replace the XML generator, parity test and frozen fixture in place, generator/baselines/XML deleted. Copy byte-identical across 609 values; lint improved 5→4; CI green (`43200660149`). No user-visible change; rollback target for the next release |
| 1.1.1 | `c2b91b3` | `dpl_7dHipEWZyx4WMyRTLEX6K2gnu7zD` | **live** | D-13: the eight Profile labels are localized in all three locales; the frozen fixture became a copy baseline rather than a key ceiling (negative mutation test proves it bites). No other change; rollback target for the next release |
| 1.1.2 | `757c958` | `dpl_HqyPKSif2UJ9nhu7ARtk2EkJKF8M` | **live** | rebuild step 1b-2: the app shell is extracted into `src/app/` (App, routes, session, document metadata) behind a re-export shim, so no importer changed. No behaviour change: routes, the session gate and localized metadata all verified independently. Rollback target for the next release |
| next | — | — | planned | the remaining surfaces, one accepted increment each: settings + print, run + scene, games + album, profile + about, then the cutover that deletes the legacy tree and closes D-4, D-11, D-14 |

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

# Version ladder

One row per version, in order. The record named in the last column carries scope, decisions,
commits, the commands run and their results, status and known limitations. A row is added when
the version is delivered; it is never rewritten — a correction is a new note or a superseding
version.

"Deployment" is the Vercel deployment that first served the version. `package.json` carries the
version the About surface displays; rows marked *specification only* change no artifact bytes,
so the app keeps showing the previous version number.

| Version | Commit | Deployment | Status | Scope | Record |
| --- | --- | --- | --- | --- | --- |
| 2.1.0 | `92c2529` (tag `version/2.1.0`; structure commit `419780a`) | — (specification only) | current | repository structure converted to the project standard: pointer plus `spec/AGENTS.md`, `facts/`, `versions/`, `backlog/`, `contract/`; decision ledger and duplicate roadmap retired; three-branch model adopted | [2.1.0.md](2.1.0.md) |
| 2.0.1 | `152e071f0b265a80cca74f32179c01d94db26f3e` | `dpl_CZD7VDaDo2e6VfgMF2aaxk4k1sDi` | superseded | login polish and update path: quieter setup copy, "at least 6 characters" with no technical vocabulary, new deployments adopted without a manual refresh | [2.0.1.md](2.0.1.md) |
| 2.0.0 | `c99e410521045996cceeda7bcf79a56c6523b0d3` | `dpl_rX1CoyGUgi3Fcfn272gg1KnNn16r` | superseded | multi-file IndexedDB store, ZIP v1 archive, local password identity, fresh start, dependency audit; cloud disabled | [2.0.0.md](2.0.0.md) |
| 1.2.0 | `efd6544b5dbb20f951afe6206af0664f8195affb` | `dpl_8zhRQVN6JQyCuHcuXtmpSsvRRzDV` | superseded | architecture rebuild complete and legacy tree cut over; six production smoke criteria verified | [1.2.0.md](1.2.0.md) |
| 1.1.2 | `757c958` | `dpl_HqyPKSif2UJ9nhu7ARtk2EkJKF8M` | superseded | app shell extracted into `src/app/` behind a re-export shim; no behaviour change | ladder only (pre-standard) |
| 1.1.1 | `c2b91b3` | `dpl_7dHipEWZyx4WMyRTLEX6K2gnu7zD` | superseded | the eight Profile labels localized in all three locales; copy baseline becomes a floor | ladder only (pre-standard) |
| 1.1.0 | `9fa97b9` | `dpl_2nqrXCLCLaP6BuW2kfbUKFzFqGT9` | superseded | typed locale modules replace the XML generator; generator, baselines and XML deleted | ladder only (pre-standard) |
| 1.0.3 | `07f31d3` | `dpl_aubqqvhih…` | not a version | CI workflow, lint gate and deployed-identity check; served bytes identical to 1.0.2 | — |
| 1.0.2 | `27978af` | `dpl_8EMnAtYkcu41qMfx1CvWqA6jAVkZ` | superseded | storage owns the stored bytes; a missing registration date is repaired once and persisted (closes D-12) | ladder only (pre-standard) |
| 1.0.1 | `41ad563` | `dpl_33Up86dcjbfTkTaPue45gDd2RugK` | superseded | two React correctness fixes; acceptance 5/6, D-12 deferred at the time | ladder only (pre-standard) |
| 1.0.0 | `fdcd731` | `dpl_ErTiLAB9bGR7u96HgFHjuD6bUYjZ` | superseded | print-surface repair and `zh_tw` logout | ladder only (pre-standard) |

## Rules

- The **rollback target** is the previous live deployment id; restoring it is an alias change in
  Vercel, not a code change.
- A documentation-only push may create a deployment with a new id; that is not a version and is
  not catalogued, because the built bytes are unchanged. The ladder tracks versions, not
  deployments.
- An accepted version is not a deployed one, and a deployed one is not an accepted one. Both
  facts are recorded separately.
- Versions advance in order; a later version does not start while the earlier one is still
  open.

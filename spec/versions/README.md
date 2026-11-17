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
| 2.1.0 | `5183fde53b2a63df8df8d21e8aad9b539c207171` (tag `version/2.1.0` on `316ed91922dfe29521ecd9374e0ebe41649e84b4`; commits `419780a5cfc2d723a627fb30ea3e43112a8db6a0`..`c8a958d0b3d91e02c7138b8c3712f49d06814a4b`, all listed in the record) | — (specification only) | current | repository structure converted to the project standard: pointer plus `spec/AGENTS.md`, `facts/`, `versions/`, `backlog/`, `contract/`; decision ledger and duplicate roadmap retired; three-branch model adopted | [2.1.0.md](2.1.0.md) |
| 2.0.1 | `152e071f0b265a80cca74f32179c01d94db26f3e` | `dpl_CZD7VDaDo2e6VfgMF2aaxk4k1sDi` | accepted, superseded | login polish and update path: quieter setup copy, "at least 6 characters" with no technical vocabulary, new deployments adopted without a manual refresh | [2.0.1.md](2.0.1.md) |
| 2.0.0 | `c99e410521045996cceeda7bcf79a56c6523b0d3` | `dpl_rX1CoyGUgi3Fcfn272gg1KnNn16r` | superseded | multi-file IndexedDB store, ZIP v1 archive, local password identity, fresh start, dependency audit; cloud disabled | [2.0.0.md](2.0.0.md) |
| 1.2.0 | `efd6544b5dbb20f951afe6206af0664f8195affb` | `dpl_8zhRQVN6JQyCuHcuXtmpSsvRRzDV` | superseded | architecture rebuild complete and legacy tree cut over; six production smoke criteria verified | [1.2.0.md](1.2.0.md) |
| 1.1.2 | `757c958107e9f714e53fa22ea562a674caebdc85` | `dpl_HqyPKSif2UJ9nhu7ARtk2EkJKF8M` | superseded | app shell extracted into `src/app/` behind a re-export shim; no behaviour change | ladder only (pre-standard) |
| 1.1.1 | `c2b91b36c03094f93a90f541e72e5497347fc477` | `dpl_7dHipEWZyx4WMyRTLEX6K2gnu7zD` | superseded | the eight Profile labels localized in all three locales; copy baseline becomes a floor | ladder only (pre-standard) |
| 1.1.0 | `9fa97b9207bf7fd46c426595b542bae0294d4c21` | `dpl_2nqrXCLCLaP6BuW2kfbUKFzFqGT9` | superseded | typed locale modules replace the XML generator; generator, baselines and XML deleted | ladder only (pre-standard) |
| 1.0.3 | `07f31d30245ca7d6fee2731753d68f5d7623fbe5` | `dpl_aubqqvhih…` | not a version | CI workflow, lint gate and deployed-identity check; served bytes identical to 1.0.2 | — |
| 1.0.2 | `27978affc006a6d821cef42418da89faee4bad8d` | `dpl_8EMnAtYkcu41qMfx1CvWqA6jAVkZ` | superseded | storage owns the stored bytes; a missing registration date is repaired once and persisted (closes D-12) | ladder only (pre-standard) |
| 1.0.1 | `41ad563e30675b00e429cda1e6e8bbf4b764e805` | `dpl_33Up86dcjbfTkTaPue45gDd2RugK` | superseded | two React correctness fixes; acceptance 5/6, D-12 deferred at the time | ladder only (pre-standard) |
| 1.0.0 | `fdcd731c59b32403ce10dc6e9ed524c82af22487` | `dpl_ErTiLAB9bGR7u96HgFHjuD6bUYjZ` | superseded | print-surface repair and `zh_tw` logout | ladder only (pre-standard) |

A row may point at the commit that last edited that version's record: the pointer commit belongs
to the row itself and is not a separate change needing its own listing.

Every row from 1.0.0 upward carries a `version/X.Y.Z` tag on the commit in the second column;
historic tags were back-filled on 2026-11-17 after each recorded commit was resolved and confirmed
to be an ancestor of `main`. A version whose commit could not be located would carry no tag rather
than a guessed one — none of the recorded ones needed skipping. Documentation-only follow-ups
inside a version carry no tag.

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

# Version catalog

The authority for "what is deployed, from which commit, and what came before it".
`package.json` carries the version that the About surface displays (one source: the
build injects it, so the label cannot drift from the artifact). The historical
`Version 1.1.0` label against a `1.0.0` package was resolved by this single-source
versioning; independent acceptance and the 2026-11-16 production smoke verified 1.2.0.

| Version | Commit | Deployment | Status | Notes |
| --- | --- | --- | --- | --- |
| 1.0.0 | `fdcd731` | `dpl_ErTiLAB9bGR7u96HgFHjuD6bUYjZ` | superseded | print-surface repair + `zh_tw` logout, accepted with the independence caveat of that round |
| 1.0.1 | `41ad563` | `dpl_33Up86dcjbfTkTaPue45gDd2RugK` | superseded | two React correctness fixes; acceptance 5/6, D-12 deferred at the time |
| 1.0.2 | `27978af` | `dpl_8EMnAtYkcu41qMfx1CvWqA6jAVkZ` | superseded | rebuild step 1a: `lib/storage` owns the stored bytes; a missing registration date is repaired once and persisted (closes D-12). No user-visible change. Rollback target for the next release |
| 1.0.3 | `07f31d3` | `dpl_aubqqvhih…` | **CI infrastructure, not a version** | CI workflow, lint gate (baseline capped at 5) and deployed-identity check. Owner granted the GitHub `workflow` scope; first run `43196112701` passed (build 43 s, verify-production 10 s). Shipped bytes are identical to 1.0.2, so by the rule below this is not catalogued as a version |
| 1.1.0 | `9fa97b9` | `dpl_2nqrXCLCLaP6BuW2kfbUKFzFqGT9` | superseded | rebuild step 1b: typed locale modules replace the XML generator, parity test and frozen fixture in place, generator/baselines/XML deleted. Copy byte-identical across 609 values; lint improved 5→4; CI green (`43200660149`). No user-visible change; rollback target for the next release |
| 1.1.1 | `c2b91b3` | `dpl_7dHipEWZyx4WMyRTLEX6K2gnu7zD` | superseded | D-13: the eight Profile labels are localized in all three locales; the frozen fixture became a copy baseline rather than a key ceiling (negative mutation test proves it bites). No other change; rollback target for the next release |
| 1.1.2 | `757c958` | `dpl_HqyPKSif2UJ9nhu7ARtk2EkJKF8M` | superseded | rebuild step 1b-2: the app shell is extracted into `src/app/` (App, routes, session, document metadata) behind a re-export shim, so no importer changed. No behaviour change: routes, the session gate and localized metadata all verified independently. Rollback target for the next release |
| 1.2.0 | `efd6544b5dbb20f951afe6206af0664f8195affb` | `dpl_8zhRQVN6JQyCuHcuXtmpSsvRRzDV` ([deployment](https://the-runaway-emulator-43mgp049r-macarwx.vercel.app)) | superseded | architecture rebuild and legacy-tree cutover completed; independent acceptance by Rowan of Soren's implementation. Production smoke verified on 2026-11-16: normal synthetic UI login; exactly one Run persisted across reload; Settings navigation and timezone/language controls usable; in-app Print Calendar dialog contained the synthetic username with window.print calls still zero; About rendered 1.2.0; every observed HTML/JS/CSS whole body matched accepted SHA256 and byte counts. Browser egress used local proxy 127.0.0.1:7896. Rollback target: `dpl_GnixShTFVuJ3LcuRa5aX2g3attEf` (1.1.2, `7c7edec`) |
| 2.0.0 | `c99e410521045996cceeda7bcf79a56c6523b0d3` | `dpl_rX1CoyGUgi3Fcfn272gg1KnNn16r` ([deployment](https://the-runaway-emulator-f5bvr4az3-macarwx.vercel.app)) | **live** | multi-file IndexedDB storage rebuild with monthly run chunks, per-plugin files, generation-atomic commits and a derived index; runawaylog-files ZIP v1 import/export excludes 1.2.0 exports; fresh start (1.2.0 on-device data is ignored, not migrated or deleted); local username/password identity with PBKDF2-HMAC-SHA-256 and no password recovery; cloud disabled, local-only; dependency security updates (accepted audit: no high or critical advisories); recorded accessibility limitation: serious color-contrast findings on four surfaces deferred; Firefox build-host verification deferred because Playwright/browser revisions mismatch. Release verification 2026-11-16 (CST): CI `43896063200` success; Git-integrated production READY on this full SHA; custom-domain and git-main aliases verified; all six local-build HTML/JS/CSS files byte-identical to production. Release verification is not independent acceptance. Rollback: `dpl_ADcj8iC8ogXgQ8Gz5qTWDkHWBwvd` (1.2.0) |
| next | — | — | completed in 1.2.0 | historical rebuild plan fulfilled: settings + print, run + scene, games + album, profile + about, and the legacy-tree cutover closing D-4, D-11, D-14; no further cutover is pending |

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

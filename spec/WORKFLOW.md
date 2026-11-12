# RUN delivery workflow

RUN is a small, single-environment application. This workflow is deliberately
lighter than CashLenX's: same ideas — work levels, invariants, decision records,
version catalog — sized for a 7k-line app with one deployment target. The
framework's `spec/working-principles.md` still governs how a round is bounded and
closed; this file only says what is specific to RUN.

## Work levels

| Level | What it covers in RUN | Who decides |
| --- | --- | --- |
| Lightweight | a defect fix with no behaviour change, a copy fix, a port of one surface already specified, documentation | Maia: scope, criteria, dispatch, accept, deploy, record |
| Standard | a surface's behaviour changing, a new surface, the skeleton work in this rebuild | Maia prepares the contract; the owner answers one question; Maia runs it |
| High-impact | deleting the legacy tree, changing the storage model's meaning, publishing outside the internal hosts | owner confirms; Maia executes and records |

## The rebuild runs as a sequence of accepted surfaces

Order matters only in that each step must leave the deployed app working:

1. **Skeleton** — `app/`, `lib/storage`, `lib/i18n`, `lib/time`, CI. No visible
   change; the existing surfaces keep rendering from the old modules through thin
   adapters.
2. **Settings + print** — the surface with the most verification evidence, so a
   regression is easy to spot.
3. **Run + scene** — the core behaviour; the scene trigger becomes a named
   interface instead of a deep import.
4. **Games + album** — fork mode and the collection album.
5. **Profile + about** — including the version string read from one source.
6. **Cutover** — delete the legacy tree, archive the self-host files, close the
   deferred defects that the new structure removes (D-4, D-11, D-12, D-1).

Each step: implement → gates → independent acceptance → push (`main`) → deployed
identity → release record + catalog row. A step that cannot be accepted stays out
of `main` and the previous version keeps serving.

## Acceptance is per surface, and it is invariants

The criteria for a surface come from `product.md` (owner of the user-visible facts)
and are written as invariants: "a run stores exactly one hit and opens the scene
once", "the dialog opens with zero `window.print` calls", "the three locales
render without a missing key", "print yields one A4 page per month". A port is
accepted when the old and new builds agree on those invariants, including the
edge cases listed in the defect register.

## Evidence a round must leave behind

- the candidate commit and the two gate runs (developer's and independent);
- the acceptance report with per-invariant verdicts and a named list of what was
  not verified;
- the deployed deployment id and the served-bytes hash comparison;
- the release record and the catalog row.

Missing any of these means the increment is not released, whatever the site shows.

## Budget

Targets, from the framework: whole increment ≤ 30 minutes of wall clock,
development ≤ 15, independent acceptance ≤ 10. A step of the rebuild that exceeds
2× its target is stopped and re-scoped, not finished "because it is nearly done".

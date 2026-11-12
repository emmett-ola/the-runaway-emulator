# 0003 — Surface-by-surface cutover, old route live until the new one is accepted

- Date: 2026-11-12. Decider: Maia (operating decision, framework delegation).
- Status: accepted.

## Context

A rebuild that replaces the whole skeleton at once cannot be accepted incrementally:
if something regresses, the regression arrives with the entire change and the only
diagnosis is a bisect across thousands of moved lines. The app is small but it is
live, and the owner's condition is that it stays clean throughout.

## Decision

The rebuild adds the new structure alongside the legacy one and replaces **one
surface per increment**. Each increment must satisfy that surface's invariants from
`product.md` in a real browser, on both the old and the new implementation, before
the next surface starts. The legacy route stays live until its replacement is
accepted and deployed. The legacy tree is deleted only in the cutover increment,
when no route references it.

## Consequences

- Every increment is independently reversible and independently reviewable.
- Acceptance evidence exists per surface, not for "the rebuild".
- The repository carries both trees for several increments — accepted cost, and the
  reason each increment states which tree it touched.
- A surface that cannot be accepted blocks only itself; the rest of the app keeps
  shipping.

## Evidence

`spec/WORKFLOW.md` (the ordered steps); framework `projects/run-refactor-brief.md`
option B, approved by the owner on 2026-11-12.

# RUN specification

**One authoritative document per fact.** If two documents disagree, the one named
here as the owner of that fact wins, and the other is corrected in the same change.
This directory describes what the rebuilt application must be; the shipped code is
evidence of what it currently is, not authority over the target.

| Fact | Owner document |
| --- | --- |
| Why the project exists, what it is not | `../../README.md`, and the portfolio entry in the framework repository (`spec/projects/runaway.md`) |
| User-visible surfaces and their acceptance invariants | `product.md` |
| Module boundaries, ownership of state | `architecture.md` |
| Stored data shape and migrations | `data-model.md` |
| Translation keys, locale files, parity rules | `i18n.md` |
| Branches, gates, release and deployment | `delivery.md`, `WORKFLOW.md` |
| Version identity of a shipped artifact | `versions.md` |
| Decisions already taken, and why | `decisions/` (numbered, append-only) |
| Defects and their state | framework repository, `spec/projects/runaway.md` (register) |

## Status of this specification set

Written 2026-11-12 as the first step of the owner-approved rebuild (option B in the
framework's `projects/run-refactor-brief.md`). It describes the **target**; the
current application does not satisfy it yet. Each surface is ported and accepted
separately, so between today and the cutover both the old and the new structure
exist in the repository.

## Rules that keep this directory honest

1. A specification sentence must be checkable by a person with the repository and
   the deployed URL. No aspirations, no "should ideally".
2. Numbers live in code and evidence, not in prose. Acceptance is written as
   invariants ("no key present at baseline is missing"), never as counts that a
   correct change could break.
3. A decision that changes behaviour is a numbered file in `decisions/`. Editing an
   old decision is not allowed; supersede it with a new number that names the one
   it replaces.
4. This directory is not a plan. A plan that changes nothing ships no code; the
   delivery workflow lives in `WORKFLOW.md` and the work itself is accepted
   surface by surface.

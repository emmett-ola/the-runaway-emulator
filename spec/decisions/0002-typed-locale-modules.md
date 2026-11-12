# 0002 — Typed locale modules replace the XML generator

- Date: 2026-11-12. Decider: Maia (operating decision, framework delegation).
- Status: accepted.

## Context

Copy lives in `src/i18n/*.xml`, is converted to TypeScript by
`src/i18n/xml-to-ts.js`, and is protected by two hash baselines and a preservation
projection that needs a named exception per additive attribute. That generator has
already caused one severe defect (it rewrote shipped copy and turned
`dashboard.hit_count` into an object, D-3) and one round of exception design
(`isPrintCalendarAccessibilityAddition` at `fdcd731`). Every copy change pays the
same tax.

## Decision

The three locales become typed TypeScript modules with `en_us` as the type source.
A parity test enforces: identical key sets, identical placeholders, no CJK in
`en_us`, no untranslated proper nouns outside a short allowlist, and no
user-visible string literal outside the locale modules. A one-off script converts
the current XML once; the generator, both baselines and the projection exception
are deleted in the same commit that lands the conversion.

## Consequences

- Adding a string is a three-file edit enforced by the compiler and the parity test
  — honest, and impossible to half-do.
- No generated file to regenerate, no hash to update before committing, no
  exception to invent when a dialog gains an attribute.
- Key names are frozen at the current set for the port; renaming them later is a
  separate, mechanical change.

## Evidence

`spec/i18n.md`; defect register D-3 and D-8 in the framework repository; the
`fdcd731` release record's account of the projection exception.

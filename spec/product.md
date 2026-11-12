# RUN — product surfaces and per-surface acceptance

Owner document for user-visible facts (see `README.md`). Written by **Avery**
(product role) on 2026-11-12 for the option-B rebuild, **adopted by Maia** as the
authority for this rebuild, with the three open questions ruled on at the end.
Read against `41ad563e30675b00e429cda1e6e8bbf4b764e805` and the route table in
`src/App.tsx`. It states what the product must keep doing; it does not describe
implementation or architecture.

## 1. Surface table

Routes are as declared; the login gate precedes all of them and is not itself a
route. "Evidence today" means recorded browser verification in
`spec/records/handoffs/`, not a build passing.

| # | Route | Purpose | Observable now (incl. broken / absent) | Data read / written | Evidence today |
| --- | --- | --- | --- | --- | --- |
| S0 | gate (no route) | Establish who the user is before any surface renders | Username only; empty password accepted; unknown username silently creates a record; wrong non-empty password rejected with a localized error; language switch on the gate | session username (per tab session); creates a user record and a credential hash on first entry | none recorded |
| S1 | `/` | The product: press Run, see the count and the history | Clock in the chosen timezone; Run control (one, or three in fork mode); quote; hit count; scene opens once per page session after a successful run; statistics, month calendar and log list appear only after the first hit; export / import / print / timezone via the header menu; import dialog offers merge or replace; animations block a second press | reads and writes the user's record: hit list, profile, game settings; reads timezone and theme preferences | run + scene + fork focus: PASS, `2026-11-12-run-hard-errors-acceptance/report.md`; print from this surface: PASS, `2026-11-12-run-g1-print.md` |
| S2 | `/games` | Entry point for the games and for the album | Card drop, card album (paged dialog with owned counts), fork-in-the-road toggle; three further items are labelled coming soon and inert; toggles persist | reads and writes the user's record (game settings, owned cards) | none recorded |
| S3 | `/games/cards` | Explanatory page for the card game | Static description and feature list; back control returns to `/`, not to `/games` | session username only | route returns 200 `text/html`, `2026-11-11-run-r1-release.md`; no behaviour verified |
| S4 | `/releases` | Release notes | Hardcoded English notes with version badges and dates; no inbound link from any surface | session username only | none recorded |
| S5 | `/settings` | Preferences and data management | Dark mode, color theme, timezone, language; export, import, print; storage mode (local active, cloud visible and disabled); each change reloads or applies immediately | writes theme, timezone, language, storage mode; reads and writes the user record for import/export/print | print entry + language + `zh_tw` menu: PASS in three locales, `2026-11-12-run-g1-print.md` and `2026-11-12-run-g1-acceptance/`; theme, timezone and storage-mode toggles: none recorded |
| S6 | `/profile` | Identity and totals | Username, member-since and joined dates, total hits, editable email with save | reads and writes the user record (email, registration date) | member-since stability across reload and midnight: PASS, `2026-11-12-run-hard-errors-acceptance/report.md`; email edit: none recorded |
| S7 | `/about` | Product identity | Brand, description, technology note, version string | none | none recorded |
| S8 | `*` | Unknown or stale path | Redirects to `/` | none | none recorded |
| — | no route | `src/pages/Storage.tsx` | Never rendered; carries a third `window.print()` | not reachable | dead code, `2026-11-12-run-g1-print.md` closing note |

## 2. Per-surface acceptance as invariants

Each item is a property a replacement must satisfy. None is a number to be fitted.

**S0 Login**
- L1 A username with an empty password enters the product, in every locale.
- L2 An unknown username creates its own empty record and enters; it never inherits another user's hits.
- L3 Once a non-empty password exists for a username, a wrong non-empty password is refused and the refusal is a localized credential message, not a raw exception.
- L4 Every string on the gate comes from all three locales; no key path is rendered as text.

**S1 Run and history**
- R1 One successful press adds exactly one stored hit, and the visible count increases by exactly one.
- R2 That same press opens the scene exactly once; a later press in the same page session still counts but does not reopen the scene; a reload restores the one opening.
- R3 A wrong fork button and the boom easter egg add no hit and open no scene. (D-5: unproven today; the invariant stands anyway.)
- R4 While an animation is in flight, the control refuses a second press, so no double count.
- R5 The timezone preference governs both the displayed clock and the day an existing hit is filed under; changing it changes both, consistently for stored hits.
- R6 Statistics, month calendar and log list derive from the same stored hit set: their totals agree with the hit count after any import.
- R7 Export followed by import returns the same hit count and the same timestamps.
- R8 Merge adds only ids not already stored, replace discards the current hits, and neither changes the current username.
- R9 A reload loses no hit, invents none, and a language change neither adds nor drops one.

**S2 Games**
- G1 A game toggle persists per user and survives a reload.
- G2 With fork mode on, all three run controls are reachable and focus returns to the one pressed (D-6, currently closed).
- G3 Features labelled coming soon stay non-interactive and stay labelled as such.
- G4 The album's owned counts agree with the stored card data, and opening or closing it changes no total.

**S3 Card game page**
- C1 All copy comes from the three locales.
- C2 The page's return control leads to the hub it belongs to, not past it.

**S4 Releases**
- RS1 The route renders on a direct visit and on a deep-link reload; it never shows a blank page.
- RS2 Every entry carries a version and a date; nothing is presented as latest that is not the deployed version.

**S5 Settings**
- S1 Every control's change survives a reload and is observable in the surface that consumes it.
- S2 A language change retranslates the visible page without a reload and leaves no missing key.
- S3 Cloud storage is presented as unavailable and is inert: never selectable, never set as the stored mode.
- S4 Local mode is the only mode; choosing it keeps all data on the device and attempts no network write.
- S5 The print entry opens the current month's calendar from stored hits and prints one A4 page per month, calendar content only.
- S6 Replace-import discards data only after an explicit confirmation in the import dialog.

**S6 Profile**
- P1 Member-since derives from one persisted date and is stable across mounts, reloads and a day boundary (D-12 open; invariant unmet today).
- P2 The stored hit total equals the count shown on S1.
- P3 A saved email persists and is shown after reload; an empty email is a permitted state.
- P4 A record missing its registration date is repaired once and written back, not re-synthesised per mount.

**S7 About**
- A1 The version shown matches the deployed build.

**Cross-surface**
- X1 Every user-visible string exists in `en_us`, `zh_cn` and `zh_tw`; no missing key renders as its path.
- X2 An unknown path redirects to `/` with no flash of a broken page.
- X3 A render error in one surface does not blank the application (D-4 open; invariant unmet today).

## 3. Product decisions the rebuild must not silently change

- **PD-1 Demo identity.** A username is the whole account; an empty password always enters; there is no server-side account. The current password handling is a demo affordance, not authentication, and must not be read as a security boundary by anyone building on it.
- **PD-2 Device-local storage only.** The record lives in this browser on this device. Cloud storage is a labelled, disabled placeholder; it is not a queued feature.
- **PD-3 Scope of persistence.** Identity is per browser session; data is per device. A new session asks again for the username, and finds the hits intact.
- **PD-4 Scene frequency.** The post-run scene shows once per page session and is never persisted; it is not "once per user" or "once per day".
- **PD-5 Three locales, equal status.** `en_us`, `zh_cn`, `zh_tw` are all first-class; a surface ships in all three or it is not done.
- **PD-6 Print shape.** One A4 page per month, calendar only — not a multi-month export, not a screenshot of the page.
- **PD-7 Import is explicit.** Import happens only when the user chooses a file, and merge versus replace is a decision the user makes in a dialog.
- **PD-8 Games scope.** Fork-in-the-road and the card album have behaviour; slot machine, achievements and daily challenges are unbuilt placeholders with no commitment behind them.

**Defects, not decisions** (these are regressions or accidents; fixing them is not a scope change):
- DF-1 `/releases` is unreachable by navigation — no link exists anywhere in the app.
- DF-2 `src/pages/Storage.tsx` is unrouted and holds a third `window.print()`; it is dead code, and any rebuild that ports it would resurrect a defect.
- DF-3 `/releases` copy is hardcoded English outside i18n, so a `zh_cn` user reads English. Inconsistent with PD-5; reads as an oversight, not a choice.
- DF-4 `/games/cards` returns to `/` rather than `/games`; minor, and probably accidental.
- DF-5 D-12 (registration date re-synthesised per mount) and D-4 (no error boundary) remain open in the defect register; P1 and X3 are written so that closing them cannot be argued away.

## 4. Open questions

- **Q1 — Is `/releases` a surface to keep?** Recommended default: keep the route, give it no navigation entry, and require RS1–RS2 and DF-3 (proper localization) as its acceptance. It is a small page, but it is currently a public URL that a rebuild could silently drop.
- **Q2 — Is the passwordless bypass a decision or a defect?** Recommended default: a decision. Keep it, keep it labelled as demo identity, and do not add password enforcement during the rebuild; changing it is a separate, owner-visible change.
- **Q3 — Should identity persist beyond the browser session?** Today it does not, and I cannot tell whether that is deliberate. Recommended default: keep session-scoped identity (PD-3) for the rebuild, and treat "stay signed in" as a new feature if it is ever wanted.

## 5. Rulings on the open questions (Maia, 2026-11-12)

- **Q1 — `/releases` stays, and becomes reachable.** Keep the route, localize it in
  the same step that ports About (DF-3), and link it from About rather than from the
  main navigation. A public URL that no surface points to is a page that silently
  rots; a link from About costs one line and makes RS1–RS2 checkable by a user.
- **Q2 — The passwordless bypass is a decision, not a defect.** It stays, it is
  documented here as demo identity, and no one may present it as authentication.
  Enforcing passwords would be a product change with its own round.
- **Q3 — Identity stays session-scoped.** PD-3 stands. "Stay signed in" is a new
  feature, not a rebuild item.

With those three rulings, this document is the acceptance authority for every
rebuild increment: an increment is done when the invariants of its surfaces hold on
the deployed build, and the surfaces it does not touch keep theirs.

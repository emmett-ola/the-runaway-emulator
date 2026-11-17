# Product: surfaces and per-surface invariants

What the product does for a user today, and the properties a change must not break. It states
behaviour, not implementation: signed-in identity lives in [identity.md](identity.md), stored
bytes in [storage.md](storage.md), locales in [i18n.md](i18n.md).

## 1. Surfaces

The login gate precedes every route and is not itself a route.

| # | Route | Purpose | Behaviour today |
| --- | --- | --- | --- |
| S0 | gate (no route) | Establish who the user is | Username first. An unknown handle asks for a new password plus confirmation and then creates the account; a known handle asks for its password. Emails can be entered and stay unverified (no SMTP). Language switch on the gate. |
| S1 | `/` | The product: press Run, see the count and the history | Clock in the chosen timezone; Run control (one, or three in fork mode); quote; hit count; the scene opens once per page session after a successful run; statistics, month calendar and log list appear after the first hit; export / import / print / timezone from the header menu; the import dialog offers merge or replace; animations block a second press |
| S2 | `/games` | Games entry and the card album | Card drop, album dialog with owned counts, fork-in-the-road toggle; three further items are labelled coming soon and inert; toggles persist per user |
| S3 | `/games/cards` | Explanation of the card game | Static description; its back control returns to `/games` |
| S4 | `/releases` | Release notes | Localized notes with version badges and dates, reachable from About; the newest entry is the deployed version |
| S5 | `/settings` | Preferences and data management | Dark mode, colour theme, timezone, language, export, import, print; storage mode shows cloud as visible and disabled; each change applies immediately or on reload |
| S6 | `/profile` | Identity and totals | Username, member-since and joined dates, total hits, editable email with save |
| S7 | `/about` | Product identity | Brand, description, technology note, version string, link to releases |
| S8 | `*` | Unknown or stale path | Redirects to `/` |

## 2. Invariants

Each item is a property a change must keep true. None of them is a number to fit.

**S0 Login**
- L1 A username with no local account is offered password setup with confirmation before the
  account is created; a username with an account is asked for its password and enters only when
  it matches.
- L2 An unknown username creates its own empty record; it never inherits another account's hits.
- L3 A wrong password is refused with a localized message, not a raw exception; repeated
  failures are throttled.
- L4 Every gate string comes from all three locales; no key path renders as text, and no
  implementation vocabulary ("code point", "UTF-8") appears in the copy.

**S1 Run and history**
- R1 One successful press adds exactly one stored hit and the visible count rises by exactly one.
- R2 That press opens the scene exactly once; a later press in the same page session counts but
  does not reopen it; a reload restores that single opening.
- R3 A wrong fork button and the boom easter egg add no hit and open no scene.
- R4 While an animation is in flight the control refuses a second press, so no double count.
- R5 The timezone preference governs both the displayed clock and the day an existing hit is
  filed under; changing it changes both consistently for stored hits.
- R6 Statistics, month calendar and log list derive from the same stored hit set; their totals
  agree with the hit count after any import.
- R7 Export followed by import returns the same hit count and the same timestamps.
- R8 Merge adds only ids not already stored, replace discards the current hits, and neither
  changes the current username.
- R9 A reload loses no hit, invents none, and a language change neither adds nor drops one.

**S2 Games**
- G1 A game toggle persists per user and survives a reload.
- G2 With fork mode on, all three run controls are reachable and focus returns to the one pressed.
- G3 Features labelled coming soon stay non-interactive and stay labelled.
- G4 The album's owned counts agree with the stored card data; opening or closing it changes no
  total.

**S3 Card game page**
- C1 All copy comes from the three locales.
- C2 The return control leads to `/games`, the hub it belongs to.

**S4 Releases**
- RS1 The route renders on a direct visit and on a deep-link reload; it never shows a blank page.
- RS2 Every entry carries a version and a date, and nothing is presented as the newest that is
  not the deployed version.

**S5 Settings**
- S1 Every control's change survives a reload and is observable in the surface that consumes it.
- S2 A language change retranslates the visible page without a reload and leaves no missing key.
- S3 Cloud storage is presented as unavailable and inert: never selectable, never stored as the
  mode.
- S4 Local mode is the only mode; it keeps all data on the device and attempts no network write.
- S5 The print entry opens the current month's calendar from stored hits and prints one A4 page
  per month, calendar content only.
- S6 Replace-import discards data only after an explicit confirmation in the import dialog.

**S6 Profile**
- P1 Member-since derives from one persisted date and is stable across mounts, reloads and a day
  boundary.
- P2 The stored hit total equals the count shown on S1.
- P3 A saved email persists and is shown after reload; an empty email is a permitted state.
- P4 A record missing its registration date is repaired once and written back, never
  re-synthesised per mount.

**S7 About**
- A1 The version shown matches the deployed build (the build injects `package.json`).

**Cross-surface**
- X1 Every user-visible string exists in `en_us`, `zh_cn` and `zh_tw`; no missing key renders as
  its path.
- X2 An unknown path redirects to `/` without a flash of a broken page.
- X3 A render error in one surface does not blank the application.

## 3. Product decisions

- **PD-1 Credential identity.** A username is the whole account, protected by a locally set
  password. There is no server-side account, no verification email and no password recovery;
  losing the password means losing access to that local account. Details in
  [identity.md](identity.md).
- **PD-2 Device-local storage.** The record lives in this browser on this device. Cloud storage is
  designed, labelled and disabled — not a queued switch — see [cloud.md](cloud.md).
- **PD-3 Scope of persistence.** Identity is per tab session: a reload in the same tab stays
  signed in, a new tab asks again for the password. Data is per device and always survives.
- **PD-4 Scene frequency.** The post-run scene shows once per page session and is never
  persisted; not "once per user", not "once per day".
- **PD-5 Three locales, equal status.** `en_us`, `zh_cn`, `zh_tw` are all first-class; a surface
  ships in all three or it is not done.
- **PD-6 Print shape.** One A4 page per month, calendar only — not a multi-month export, not a
  screenshot of the page.
- **PD-7 Import is explicit.** Import happens only when the user chooses a file, and merge versus
  replace is the user's decision in a dialog.
- **PD-8 Games scope.** Fork-in-the-road and the card album have behaviour; slot machine,
  achievements and daily challenges are unbuilt placeholders with no commitment behind them.

No product defect is open. The five the rebuild inherited (member-since drift, missing error
boundary, unreachable `/releases`, its unlocalized copy, the `/games/cards` back link) closed in
1.0.2 and 1.2.0; the records are in [versions](../versions/README.md).

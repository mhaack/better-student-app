# Plan: Test markers + test-detail sheet in the Stundenplan (D1)

Marks Klassenarbeiten/Leistungskontrollen in the five-day grid and opens a
bottom sheet with the details when a marked day header is tapped. The grid
itself (layout, 13px subject / 10px room, rust changes, dashed cancellations)
stays as it is.

## Context: what the API can and can't supply

The exam source is the one Termine already uses (`docs/plans/termine.md`):
`journal/lessons?include=notes.type`, filtered client-side to `KLA`/`LEI`,
double periods merged by `mergeDoublePeriods()` in `data/termine.js`.

| Spec field        | Source                                                    | Available |
| ----------------- | --------------------------------------------------------- | --------- |
| date, subject     | journal lesson `day.date`, `subject`                      | yes       |
| kind              | `note.type.name`                                          | partly, see below |
| period(s)         | journal lesson `nr`, merged                               | yes       |
| start–end time    | timetable lesson `time.from` / `time.to` (`from`/`to`), first period's start to last period's end | yes (joined) |
| room              | that day's grid lesson (plan when published, else timetable) | yes (joined) |
| teacher           | that day's grid lesson `teacherList` (forename + surname) | yes       |
| topic (Thema)     | `note.description`                                        | yes       |
| Hilfsmittel, Dauer, Gewichtung | —                                            | **no**    |

Following the spec's own rule ("if a field is missing, hide its row"):

- **Hilfsmittel / Dauer and Gewichtung never render.** The API has no such
  fields. The row-building code takes them as optional anyway, so they show up
  if a source for them ever appears. No placeholder. *(Superseded: dropped
  entirely, see Decisions.)*
- **Kind is the note type's name**: "Klassenarbeit/Klausur" or
  "Leistungskontrolle", the same text Termine shows. The spec's examples
  (Vokabeltest, Referat …) don't exist as types at this school. Teachers
  sometimes write them into the description, but parsing free text for a
  label would be a guess.
- **Teacher shows as "Sandra Kaiser", not "Frau Kaiser".** The salutation
  needs `gender`, which the app deliberately never requests (see the
  personal-data note in `api-notes.md`).

**Room, period and time come from the grid, not the note.** The spec requires
lesson numbers and rooms to match the timetable entries for that day. The
journal lesson carries its own `rooms`, but those can disagree with a
published plan (a room change on exam day). So the data layer joins each exam
to `day.lessons` by period and takes room, teacher and times from there. That
reuses what `lessonsForDate()` already resolved, including `diffList`, so a
changed room shows the *new* room. If no grid lesson matches a period (no
timetable entry, or a cancelled lesson), the Zeit row falls back to the
period alone and the Raum row is hidden.

## Approach

### Data: `data/termine.js` + `data/stundenplan.js`

- Pull the filter-and-merge out of `getTermineData()` into an exported
  `examsFromNotes(notes)` (type filter + `mergeDoublePeriods` + sort) so both
  screens share one definition of "an exam". The sort becomes date, then first
  period, which gives the lesson order the sheet stacks by.
- `getStundenplanData()` fetches `fetchJournalNotes(studentId, fromIso, toIso)`
  for the shown week alongside the plan and timetable. That's one extra
  request per week, cached by the existing `cached()` key. **A failing journal
  call yields no markers and never breaks the grid**: it's caught and treated
  as `[]`.
- New pure helper (unit-tested) `attachExams(days, exams, todayIso)`, which
  gives each day:
  - `exams: [{ ...exam, periods, timeLabel, room, teacher, countdown }]`
    in lesson order
  - and for each grid lesson in an exam period, `hasExam: true`
- `timeLabel`: "5.–6. Stunde · 11:40–13:15". This reuses `periodLabel` (en
  dash instead of the current hyphen, which also fixes Termine's
  "1.-2. Stunde" to match the design).
- `countdown`: "Heute" / "Morgen" / "In N Tagen", computed from calendar
  dates rather than milliseconds (DST, same reason as `addDays`). Reuse
  `daysUntil()` if its semantics fit.
- `testCount` next to `changeCount`.

### Grid: `views/stundenplan.js`

- **Header**: a day with ≥1 exam renders its header as
  `<div role="button" tabindex="0" data-exam-day="i" aria-label="Freitag 19.9. – Test anzeigen">`,
  with a 6×6 dot centred under the date. Min height 44px, hover/pressed
  `#EFEAE2`, radius 8px. Unmarked headers stay plain divs. It's a div, not a
  `<button>`, for the WebKit reason documented on `bindActivate`, which wires it.
- **Cells**: `.sp-cell` gets `position: relative`, and a cell with
  `hasExam` gets a `.sp-exam-dot` at top 6px / right 6px. A dot in a regular
  cell doesn't make that cell tappable; only the header opens the sheet, as
  specified. The dot is absolutely positioned, so cell size and text layout
  stay the same.
- Dot colour: `--text-primary` (#1A1714 light / #F3F0EA dark), never `--accent`.
- **Legend**: "{n} Änderungen · ● {m} Tests · Tippen für Details", keeping
  the rust colour on the Änderungen part as today. With no tests the line
  stays as it is now ("… · in dieser Woche").

### Sheet: extend `components/detail-sheet.js`, don't fork it

All three existing callers (changed lesson, Termin, Anstehend) use
`openDetailSheet`. The spec's accessibility and motion requirements are things
those sheets lack too, so they go into the shared component:

- **Focus trap** (Tab/Shift-Tab cycle inside the sheet), initial focus on the
  close button, **focus returns to the opener**. The opener is passed in, or
  falls back to `document.activeElement` at open time.
- **Slide up 200ms ease-out**, scrim fades in; both turn off under
  `prefers-reduced-motion: reduce`. Closing runs the same animation in reverse
  before removal (instant when reduced).
- **Over the whole screen including the tab bar**: the backdrop is already
  `position: fixed; inset: 0`. I'll add an explicit `z-index` so it can't
  depend on paint order.

The visual spec for this sheet (scrim `rgba(26,23,20,.32)`, `#F6F3EE` ground,
24px top radius, drag handle, 44px round white close button, 46px rows with
13px/15px label/value) differs from the current shared sheet (black 45% scrim,
white ground, no handle, borderless ✕). **Open question 1** below.

New content shape, `openExamSheet(container, day, opener)` in the view, built
on the shared shell:

- One block per exam in lesson order. Each block has the pill ("Heute" /
  "Morgen" / "In N Tagen") + date "Fr 19.9.", the subject in Instrument
  Serif 32px, the kind at 14px, then rows in the order
  Thema · Zeit · Raum · Hilfsmittel / Dauer · Gewichtung (missing ones
  omitted).
- The close button sits once in the sheet header, not once per block.
- CTA "In Termine öffnen" per exam, a full-width 48px outline button.

### Deep link into Termine

- New route `#/termine/<examId>`, where `examId` is the first merged note's
  `id`. That id is stable and already on the object.
- `views/termine.js` renders as usual, then scrolls the matching row
  (`data-exam-id`) into view and briefly highlights it. If no row matches
  (the exam is gone, or it's on the Ferien segment), it renders plain Termine.
- The bottom nav's active tab works unchanged, because `currentBasePath()`
  already reduces `/termine/123` to `/termine`.

### Tokens and dark mode

Most spec colours are existing tokens: `#1A1714` `--text-primary`, `#57504A`
`--text-secondary`, `#6F6862`/`#9C948A` `--text-muted`, `#E4DED5`/`#2E2A24`
`--border`, `#D9D2C8` `--border-strong`. Two need new tokens because they
switch roles between themes:

- `--sheet-bg`: `#F6F3EE` light (= `--bg`), `#1D1A16` dark (= `--surface`)
- `--pressed`: `#EFEAE2` light. The spec gives no dark value; I propose
  `#26221D`, between `--surface` and `--border`.

The inverted pill is `--text-primary` on `--bg` in both themes, which gives
exactly the spec's `#1A1714/#F6F3EE` and `#F3F0EA/#14120F`. Both dark blocks
in `tokens.css` (explicit + `prefers-color-scheme`) get the new tokens.

## Tests (first, per CLAUDE.md)

`scripts/test-stundenplan-exams.mjs`, using names/rooms like the real ones:

- A double-period Klassenarbeit gives one exam, periods [5,6],
  "5.–6. Stunde · 11:40–13:15", and both cells get `hasExam`.
- **Room comes from the grid**: a plan room change on exam day (original +
  new room in one array) shows the new room only.
- No grid lesson for the period: Zeit is period-only, Raum is absent.
- Two exams on one day are ordered by first period, not by note order.
- Countdown: today, tomorrow, in 3 days, and across the DST change in late
  October.
- `STU`/`HAU` notes never mark anything.
- The existing Termine tests keep passing with `examsFromNotes` extracted.

Then a Playwright check at 390×844, light and dark: dots, header hit area,
sheet over the tab bar, Esc and focus return, scrim tap, and the deep link
landing on the exam.

## Decisions (review 2026-10-02)

1. **Existing sheets stay exactly as they are.** The test sheet gets the
   spec's look through its own classes (`exam-sheet`), built on the shared
   shell in `detail-sheet.js`. The shell gains focus trap + focus return for
   every sheet (behaviour only, no visual change); the slide/fade motion is
   on the test sheet only.
2. **Past tests in the shown week are marked.** The pill reads "Gestern" /
   "Vor N Tagen", and there's no "In Termine öffnen" button, because Termine
   starts at today.
3. **The legend follows the spec as written** when the week has tests; the
   line without tests stays as today.
4. **`--pressed` dark is `#26221D`.**
5. **Hilfsmittel, Dauer and Gewichtung are dropped entirely**, not wired.
   **Kind is the note type name**; the specifics live in the Thema text.

## Not in this pass

- No Hilfsmittel/Dauer/Gewichtung source. There is none in the API, so the
  rows are wired but stay hidden.
- No swipe-to-dismiss on the drag handle. It's decorative unless asked for.

## As built

- `examsFromNotes()` (`data/termine.js`) is the one definition of an exam;
  merged exams carry every note id (`ids`) so the Termine deep link matches a
  double period by either lesson's id. `periodLabel` now uses an en dash in
  both screens.
- `attachExams()` (`data/stundenplan.js`) joins exams to the grid by period
  *and* subject. Bell times come from the base timetable, because plan
  lessons have none.
- `mountSheet()` (`components/detail-sheet.js`) is the shared shell: Escape,
  backdrop tap, focus trap, focus return. `openDetailSheet` renders the same
  markup as before on top of it.
- The marked header's 44px hit area and pressed background sit on a
  `::before` centred behind the text, so the header row keeps its height.
- **Changed after review:** no dot in the day header. The cell dots mark the
  day; the header is still the tap target. The legend is a wrapping flex row
  with 8px between its parts.
- **Changed after review:** the dots are the accent colour (the same as the
  unread-Mitteilungen dot) at 8px, instead of 6px ink. The cell dot sits at
  top 8px / right 8px.
- **Changed after review:** every detail sheet (changed lesson, Termin,
  Anstehend) now uses the test sheet's design: one set of `.detail-*`
  styles, with `.exam-*` only for the pill, date and CTA. Rows go through
  the shared `detailRow()`. Colours stay the old sheet's: white
  (`--surface`) ground, accent eyebrow, muted subtitle and labels, so the
  `--sheet-bg` token was dropped again. The close button is the old plain
  ✕ at 20px (44px hit area), not the round button.
- **Changed after review:** no "In Termine öffnen" button; the sheet already
  holds every detail. The `#/termine/<id>` deep link, the merged `ids` and
  `isPast` went with it, so the "Deep link into Termine" section above no
  longer applies.
- **Changed after review:** the test sheet's header mirrors the other
  sheets: the kind ("Leistungskontrolle", "Klassenarbeit/Klausur") as the
  accent eyebrow, the subject as title, the countdown pill and date beneath.
- **Changed after review:** tests in Heute's Anstehend list open the same
  sheet (no dot there). `attachExams` moved to `data/termine.js`, where
  `withExamDetails()` gives Anstehend's exams the sheet fields; the sheet
  itself is `components/exam-sheet.js`. Heute now fetches the day plan for
  its whole 14-day Anstehend window (one call) instead of the shown day only,
  so a test's room reflects a published change.
- **Changed after review:** a cell holding a test is tappable too, like a
  changed cell, and opens the test sheet for just that test. When the cell
  is also changed, the test sheet wins; its Raum row already shows the room
  and teacher after the change. The day header still opens all of the day's
  tests.
- The inverted pill reuses `--lk-badge-bg/text`, which already are exactly
  the spec's colours in both themes.

Verified: 14 new test cases in `scripts/test-stundenplan-exams.mjs`, all test
files passing. Rendered at 390×844 against mocked API routes in light and
dark: header and cell dots, legend, a sheet with three exams, a past exam
without the CTA, focus trap, Esc returning focus to the header, scrim tap,
and `#/termine/<id>` scrolling to and highlighting the exam.

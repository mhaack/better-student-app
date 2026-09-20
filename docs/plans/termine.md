# Plan: Termine (Klassenarbeiten, Klausuren, Tests) + Ferien

Implements design screens **2a · G1 "Termine"** and **2a · G2 "Ferien"** —
the second design export, which supersedes the earlier E1 sketch. Two
structural changes came with it:

- **Termine is a fifth bottom-nav tab**, not a row under Mehr as E1 implied.
- The screen carries a **Termine / Ferien segmented control**; G1 is the
  first segment, G2 the second.

Note a wording slip in the export: G1's header reads "Aufgaben" while its nav
label and G2's header both read "Termine". "Aufgaben" looks like a leftover
from the Hausaufgaben board. **Use "Termine" for both segments.**

## Context

There is no Termine/exams endpoint. Probed and ruled out: `holidays`,
`school-holidays`, `vacations`, `ferien`, `terms`, `days`, `years/current`,
`journal/notes`, `note-types` — all return the same `401 {"message":""}` as an
invented route. `/api/collections` is also not it: it holds 2 rows, both past
and already graded, `visible_from: null` — collections are created at grading
time, so they say nothing about what's coming.

**The source is `journal/lessons` with `include=notes.type`**, which the app
already calls (`fetchJournalNotes`). The note types are richer than
`docs/api-notes.md` previously recorded:

| Code  | id | Name                    |
| ----- | -- | ----------------------- |
| `KLA` | 17 | Klassenarbeit/Klausur   |
| `LEI` | 51 | Leistungskontrolle      |
| `HAU` | 16 | Hausaufgabe             |
| `STU` | 15 | Stundenthema            |

(`HAU` corrects an earlier note in this repo claiming the school records no
homework — that conclusion came from a 3-week sample.)

Two facts that shape the design:

1. **The horizon is ~6 months, not 2 weeks.** Teachers enter Klausuren far
   ahead. Everything on the books as of 2026-09-20 is 9 notes across 22
   lessons — the whole rest of the school year in a *single unpaginated
   page*. The current `NOTE_WINDOW_DAYS = 14` in `data/heute.js` discards
   everything past September.
2. **Note type cannot be filtered server-side.** `note` and `not_note` are in
   the allowed-filter list, but every value shape tried (`KLA`, the type id
   `51`, the full name, `1`, `true`, `0`) returns `500 Server Error`. They are
   broken, not misused. Filter client-side — free at this payload size.

Each note carries `description` and `type`; the parent lesson carries
`subject`, `teachers`, `rooms`, `nr` (period) and `day.date`.

### Ferien

Two sources, and they answer different questions:

| Question | Source | Authority |
| -------- | ------ | --------- |
| Is there school on day X? | `time-tables/current` → `no_school_dates` | the school itself |
| What is this break called, and how long does it really run? | `schulferien-api.de` | the state |
| What is this single free day called? | computed Easter arithmetic | national |

**`no_school_dates`** is a bare `string[]` of `YYYY-MM-DD` (64 entries),
weekdays only — weekends are never listed. It is authoritative for *whether*
school happens, which is what the Heute rollover already depends on. It has
no names and, as shown below, no guarantee of completeness.

**`schulferien-api.de`** (github.com/maxleistner/deutsche-schulferien-api)
supplies named, official ranges. Three of its endpoints can answer our
question; measured against the real calendar, they are not equal:

| Endpoint | Requests for a school year | Notes |
| -------- | -------------------------- | ----- |
| `v1/{year}/{state}` | **2** | calendar years, needs merge + dedupe |
| `v2/{year}/{state}?from=&to=` | **2** | the `{year}` path segment still bounds it — a range crossing into 2027 returned only the 2026 entries |
| `v2/date/{YYYY-MM-DD}?states=` | **1 per block** (~8) | returns the *containing* range, not just a boolean |
| **`v2/next/{days}?states=`** | **1** | already forward-looking and sorted |

`v2/next/365?states=SN` returns exactly the seven blocks of the school year
ahead, in order, with no merging, no dedupe and no year-boundary special case:

```
GET https://schulferien-api.de/api/v2/next/365?states=SN
-> [{ "start": "2026-10-12T00:00Z", "end": "2026-10-24T23:59Z",
      "name": "herbstferien", "name_cp": "Herbstferien",
      "stateCode": "SN", "slug": "herbstferien-2026-SN" }, … 7 total]
```

**This is the one we use.** `v2/date/…` is a fine answer to "is this one date
Ferien" — and it does return the whole containing range, so it would work —
but it costs one request per block where `next` costs one in total.

Because `next` is relative to *now*, late in a school year it also returns the
*following* year's autumn break. Cut the list at **the first Sommerferien
inclusive**: the summer break ends a school year by definition, so this needs
no date arithmetic and stays correct whenever the screen is opened.

The **state comes from `/api/school`**, which returns `state: "Sachsen"` (plus
`type`, `city`, `postal_code`). The endpoint is already wired up as
`fetchSchool()` in `data/repository.js` and already called by `views/mehr.js`,
so this costs no new request there — but it does need a **full-German-name →
two-letter-code map** (16 entries; "Sachsen" → `SN`), since the holiday API
takes codes.

Verified live: `access-control-allow-origin: *` on both GET and the OPTIONS
preflight (204), so a browser-only app can call it directly. Year data exists
for 2025–2028; **2029 returns a 500** leaking an `ENOENT` path, so failures
must be handled rather than trusted — `next/365` sidesteps this today, but the
same service will hit it eventually.

#### Why both sources, not just one

Cross-referencing every no-school date of this school year against the
official calendar settles it:

```
covered by official Schulferien:   52
covered by gesetzlicher Feiertag:   2   (Buß- und Bettag, Christi Himmelfahrt)
neither (school-specific):          0
```

Nothing is school-specific — the "Brückentag / beweglicher Ferientag" case I
assumed would need a generic "Schulfrei" label **does not occur at this
school**. But the two public holidays are *not* in the Schulferien API (it
covers Ferien, not Feiertage), so the Easter arithmetic still earns its place
— just in a much smaller role than planned.

And the school's own calendar is **incomplete** where the official one is not:

```
Herbstferien      2026-10-12..2026-10-24   school lists 10/10 weekdays   ok
Weihnachtsferien  2026-12-23..2027-01-02   school lists  8/ 8 weekdays   ok
Winterferien      2027-02-08..2027-02-19   school lists 10/10 weekdays   ok
Osterferien       2027-03-26..2027-04-02   school lists  6/ 6 weekdays   ok
Pfingstferien     2027-05-07..2027-05-07   school lists  1/ 1 weekdays   ok
Pfingstferien     2027-05-15..2027-05-18   school lists  2/ 2 weekdays   ok
Sommerferien      2027-07-10..2027-08-20   school lists 15/30 weekdays   MISMATCH
```

The summer break is **twice as long as `no_school_dates` records**. This is
the "as recorded, not statutory" caveat from the previous revision of this
plan, now measured and fixable: showing "12.7. – 30.7." would be simply wrong.

#### What this corrects in the previous plan

The month-and-length heuristic is **demoted to a fallback**, and two of its
outputs were wrong:

- It labelled 2027-05-07 and 2027-05-15..18 as `null` → "Schulfrei", because
  they fall under the 5-school-day threshold. They are officially
  **Pfingstferien**. The threshold cannot distinguish a short real Ferien
  block from a stray free day; only the official calendar can.
- Its Sommerferien range inherited the truncation above.

The heuristic stays in the codebase because the app is an offline-capable PWA
and this is a third-party dependency (see Risks), but it is no longer the
primary namer.

## Implementation (as built)

**New: `public/js/api/schulferien.js`** — the one place that talks to the
third-party service.

- `STATE_CODES`: full German name → two-letter code, all 16 Länder, since
  `/api/school` gives `"Sachsen"` and the API wants `SN`.
- `fetchSchulferien(stateCode)` → `[{ name, from, to }]` from
  `GET /api/v2/next/365?states={code}`, truncated at the first Sommerferien
  inclusive (see above). Normalise the ISO timestamps to plain `YYYY-MM-DD`
  by **slicing the string, never parsing it** — the `end` is inclusive at
  `23:59Z`, so `new Date()` in a negative-offset timezone lands on the
  previous day.
- Strip the trailing "ferien" from `name_cp` for G2's stem column
  ("Herbstferien" → "Herbst").
- **Never throws.** A 500, a 404 (bad code), an unknown state name, an
  offline device or a dead service all resolve to `[]`, and the caller falls
  back to the heuristic. This service is a nice-to-have, not a dependency of
  the app booting.
- Cached through the existing `cached()` helper with a long `staleMs` — the
  school-holiday calendar changes approximately never. Note the cache key must
  not be time-derived even though the endpoint is relative to now; a day's
  drift on a 365-day window changes nothing we display.

**New: `public/js/domain/holidays.js`** — pure, unit-testable, no network.

- `holidayBlocks(noSchoolDates)` → `[{ from, to, schoolDays, name }]`.
  Dedupes, sorts, and merges consecutive dates, bridging a gap only when every
  day skipped is a Saturday or Sunday. `schoolDays` is the count of raw dates
  in the block — `no_school_dates` lists weekdays only, so this *is* the
  number of school days lost, which is what G2 displays ("10 Schultage frei").
  No weekday arithmetic needed.
- `nameBlocks(blocks, officialFerien, feiertage)` → the layered namer, applied
  per block in this order:
  1. an official Ferien range containing the block's start → its `name_cp`
     ("Sommerferien"), **and the official `from`/`to` replace the block's
     own**, which is what fixes the truncated summer break;
  2. otherwise a computed public holiday on the block's only day →
     that name ("Buß- und Bettag");
  3. otherwise the month heuristic below;
  4. otherwise `null`, rendered "Schulfrei" — never a guess.
- `nextHoliday(blocks, fromIso)` → the first named block after `fromIso`.

**Fallback heuristic** (step 3), used only when the service is unreachable.
Applied to blocks of `MIN_FERIEN_SCHOOL_DAYS = 5`+ school days:

  | Start month   | School days | Name             | Stem (G2 list) |
  | ------------- | ----------- | ---------------- | -------------- |
  | any           | < 5         | `null`           | —              |
  | Sep, Oct, Nov | 5+          | Herbstferien     | Herbst         |
  | Dec, Jan      | 5+          | Weihnachtsferien | Weihnachten    |
  | Feb           | 5+          | Winterferien     | Winter         |
  | Mar, Apr      | 5+          | Osterferien      | Ostern         |
  | May           | 5+          | Pfingstferien    | Pfingsten      |
  | Jun           | 5–14        | Pfingstferien    | Pfingsten      |
  | Jun           | 15+         | Sommerferien     | Sommer         |
  | Jul, Aug      | 5+          | Sommerferien     | Sommer         |

  June needs the length split because states differ: a week in early June is
  Pfingsten, six weeks is the summer break starting early (NRW,
  Niedersachsen). `SOMMER_MIN_SCHOOL_DAYS = 15` separates the two.

  G2's list uses the **stem** ("Herbst"), the dark card the full name
  ("Herbstferien") — hence both columns. Derive the stem by trimming a
  trailing "ferien", so an official name maps the same way.

  Known to be wrong for short official Ferien (the 2027 Pfingstferien case
  above) — acceptable in a degraded offline mode, not as the primary path.

**New: `public/js/domain/feiertage.js`** — names the public holidays the
Schulferien API does not cover. German public holidays are computable: the
movable ones all hang off Easter, which Gauss's algorithm gives exactly.

- `easterSunday(year)` → Gauss's algorithm, pure integer arithmetic.
- `holidayNames(year)` → `{ "YYYY-MM-DD": "Name" }` covering the fixed days
  (Neujahr, Tag der Arbeit, Tag der Deutschen Einheit, Reformationstag, beide
  Weihnachtsfeiertage), the Easter-relative ones (Rosenmontag −48, Karfreitag
  −2, Ostermontag +1, Christi Himmelfahrt +39, Pfingstmontag +50, Fronleichnam
  +60), and Buß- und Bettag (the Wednesday before 23 November).

  Verified against the two Feiertage in this school year:

  ```
  2026-11-18  ->  Buß- und Bettag
  2027-05-06  ->  Christi Himmelfahrt
  ```

  The list is *national* — a few entries are state-specific (Fronleichnam,
  Reformationstag). Since these names only ever label days the school has
  **already told us are free**, a holiday that doesn't apply here is simply
  never looked up. The risk is a mislabel, never a phantom day off.

**Changed: `public/js/data/repository.js`** — `fetchJournalNotes` keeps its
signature; callers pass the wider range. Add nothing new: one call with
`filter[range]` already covers the whole year in one page.

**Changed: `public/js/api/mappers.js`** — `mapJournalNotes` additionally
returns `typeId` and `teacher` (via the existing `teacherShortNames`), which
the exam rows want and the Heute list ignores.

**New: `public/js/data/termine.js`** — `getTermineData()`:

- Awaits `fetchCurrentTimetable()` for `no_school_dates`, then
  `fetchJournalNotes(studentId, todayIso, yearEndIso)` where `yearEndIso`
  comes from the current interval (fall back to "today + 12 months").
- Keeps `KLA` and `LEI` only. **`HAU` is deliberately excluded** — homework is
  a different screen (the design has a separate "Hausaufgaben" board) and
  mixing it in would bury the exams.
- Dedupes by `${date}|${subjectId}|${text}`, same as `data/heute.js`, because
  a double period records the same entry twice with different note ids — but
  **merges the periods instead of dropping them**, so a double period renders
  as `1.–2. Stunde` (the design shows exactly this).
- Returns `{ next, months, nextHoliday, countUntilHoliday }` where `months` is
  `[{ label: "Oktober", items: [...] }]` and `next` is the soonest item
  (also still present in `months`, since the design's dark card repeats the
  first list row rather than removing it).

**New: `public/js/data/ferien.js`** — `getFerienData()`:

- In parallel: `fetchCurrentTimetable()` (for `no_school_dates`) and
  `fetchSchool()` (for `state`), then the single `fetchSchulferien(code)`.
- `holidayBlocks()` over the no-school dates, filtered to the school year,
  then `nameBlocks()` with whatever the service returned (possibly `[]`).
- Split into `ferien` (named, 5+ school days, or any official Ferien range)
  and `freieTage` (the rest).
- Returns `{ next, ferien, freieTage, yearLabel, source }`, where `yearLabel`
  is "Schuljahr 2026/27" from the interval bounds and `source` is
  `"official" | "derived"` so the view can be honest when degraded.

**New: `public/js/views/termine.js`** — owns both segments.

- Title "Termine" (not G1's "Aufgaben" — see the note at the top), with the
  subtitle switching per segment: `"{n} Termine bis zu den {Ferienname}"` on
  Termine, `"Schuljahr 2026/27"` on Ferien.
- **Segmented control** below the title: two buttons in a `--border`-filled
  track, the active one white with a hairline shadow, `role="tablist"` with
  `aria-selected`. The choice is view-local state (a closured variable, same
  pattern as `weekOffset` in `views/stundenplan.js`) — it resets to Termine on
  each mount and is deliberately **not** persisted; it is a glance, not a
  preference. Only the body below the control re-renders on switch, so the
  header doesn't flash.
- Both segments' data is fetched **once, in parallel**, on mount — switching
  never hits the network. They share the timetable call anyway, and the exam
  payload is one page.

**Termine segment** (G1):
- "Als nächstes" card, inverted (`--text-primary` ground, `--surface` text):
  eyebrow, subject in Instrument Serif 26px, relative distance from the
  existing `daysUntil()`, then `Fr 19.9. · 2. Stunde · Klassenarbeit`, a
  hairline divider, and the topic. The design's "Nr. 1" is dropped — the API
  has no exam number.
- Month sections on a `52px 1fr` grid: day number in serif, weekday beneath,
  subject / type · period / topic on the right. `min-width: 0` on the grid
  item itself (not a descendant), per the truncation rule this project has
  been bitten by.
- Trailing Ferien row in the same grid, greyed via `--text-muted`.

**Ferien segment** (G2):
- Same inverted card for the next break: name, "in 16 Tagen" via `daysUntil()`,
  then `Mo 12.10. – Fr 23.10. · 10 Schultage frei`.
- "Ferien" section: one row per block, stem name left, date range right.
- "Einzelne freie Tage" section: same rows at a smaller size, named via
  `feiertage.js` or "Schulfrei".
- Rows are `display:flex; justify-content:space-between` with the date
  `white-space:nowrap`, so a long name wraps rather than shoving the date off.

**Changed: `public/js/app.js`** — `route(/^\/termine$/, withShell(renderTermine))`.

**Changed: `public/js/components/bottom-nav.js`** — a fifth tab between
Stundenplan and Mehr. Two consequences the design already accounts for:

- **"Stundenplan" is renamed "Plan"** in the nav (the route and page title
  stay `/stundenplan` / "Stundenplan"). At 390px, five labels at 12px do not
  fit; the design drops to 11px *and* shortens the label, and "Plan" is the
  only label long enough to need it.
- `.nav-item` font-size 12px → 11px and `.bottom-nav` horizontal padding
  8px → 4px, matching the design. `--touch-target` is unchanged, so each tab
  is still 48px tall; only the label shrinks.
- Needs a fifth icon in `components/icons.js` — the existing set is
  `house`, `graduationCap`, `calendarDays`, `ellipsis`. Add `clipboardList`
  (or similar), matching the current 24px stroke style.

**Changed: `public/js/views/mehr.js`** — the "kommen in einer späteren
Version" empty-state loses its Termine mention. No link row: Termine is a tab
now, so a duplicate entry under Mehr would be noise.

**Changed: `public/css/app.css`** — the segmented control, the inverted card,
the month grid rows, the Ferien list rows, and the nav size change.

**Changed: `public/_headers`** — add `https://schulferien-api.de` to
`connect-src`. This is the first non-beste.schule data origin the app talks
to; without it the CSP blocks the call silently and the Ferien tab quietly
falls back to the heuristic, which is exactly the kind of failure that looks
like it works.

**New: `scripts/test-holidays.mjs`** — wired into `npm test`. Covers:
weekend bridging (the two-week Herbstferien must come back as one block);
the 5-school-day naming threshold (Buß- und Bettag stays unnamed);
year-crossing (Weihnachtsferien 2026-12-23 → 2027-01-01); the missing upper
year bound (Sommerferien starting after the last school day is still
included); `nextHoliday` skipping unnamed blocks; and empty input.

**New: `scripts/test-feiertage.mjs`** — Easter for several years against known
values (2026-04-05, 2027-03-28), each derived offset, Buß- und Bettag across a
year where 23 November is itself a Wednesday, and an unnamed date returning
`undefined` rather than a guess.

**New: `scripts/test-schulferien.mjs`** — pure parsing only, no network: the
inclusive `23:59Z` end date surviving as the same calendar day (the timezone
trap — assert it under a negative-offset `TZ`), truncation at the first
Sommerferien (including the late-in-year case where Sommerferien is the *only*
entry kept), the "ferien" stem trim, the state-name → code map covering all 16
Länder, and every failure shape (500, 404, unknown state, network throw)
resolving to `[]` rather than rejecting.

**Changed: `scripts/test-holidays.mjs`** — additionally covers the naming
layers: an official range overriding both the name *and* the block's `to`
(the truncated-summer fix), a Feiertag naming a single-day block, the
heuristic taking over when the official list is empty, and an unnamed block
staying `null`.

## What the build changed

Six things the plan got wrong, each found by running it against real data:

1. **Blocks have to split at official-Ferien boundaries.** 2027-05-06 is
   Christi Himmelfahrt (a Feiertag), 2027-05-07 is officially Pfingstferien.
   They are adjacent weekdays, so the merge swallowed both into one nameless
   two-day block labelled "Schulfrei". `holidayBlocks()` now takes the
   official calendar and only merges days of the same kind.
2. **The school year starts at the earliest *interval*, not `year.from`.**
   The year record says 2026-08-01; school actually starts 2026-08-17. The
   two-week gap let the tail of the *previous* summer break render as this
   year's first holiday ("Sommer 3.8. – 14.8.2026").
3. **`ferienStem` needs an explicit map, not a suffix trim.** Dropping
   "ferien" yields "Weihnachts", "Oster" and "Pfingst" — none of them German
   words. Caught by a test, not by inspection.
4. **The timezone trap runs the other way.** The plan said a negative offset
   would shorten a holiday. It is positive offsets that break: the `23:59Z`
   end rolls into the next day in Europe/Berlin — where this app actually
   runs — silently *extending* every holiday. The string-slice fix is the
   same either way; the reasoning in the comment was not.
5. **Holidays interleave chronologically** in the Termine list rather than
   closing it. Exams run September to March and cross three breaks, so an
   appended row never appeared at all under the "after the last exam"
   condition the plan specified.
6. **The subtitle counts exams before the next break**, not all of them.
   "7 Termine bis zu den Herbstferien" was false; only 4 fall before it.

Smaller: `data/termine.js` returns a flat, date-sorted `exams` array and the
*view* does the month grouping, because exams and holidays share one stream.
Single-day breaks render as "7.5.2027", not "7.5. – 7.5.2027".

## Verified

- 95 tests pass (was 56): 18 holidays, 14 schulferien, 7 feiertage added.
- Rendered at 390×844 against the live journal + timetable payloads with the
  real holiday service, light and dark, no horizontal overflow.
- Subtitle reads "4 Termine bis zu den Herbstferien" — matching the design's
  own caption and the hand-counted figure.
- Ferien segment shows the corrected summer range (10.7. – 20.8.2027, not the
  truncated 12.7. – 30.7. the school recorded), and names both Feiertage.
- Heute is unaffected; nav reads Heute · Noten · Plan · Termine · Mehr.

## Deliberately not in this pass

- **No Heute teaser.** A Klausur three months out is not "heute" news; the
  Anstehend section keeps its 14-day window. Revisit once the screen exists.
- **No persisted segment choice** — see above.
- **No Hausaufgaben screen** (design board "Hausaufgaben") — separate feature.
  Measured on live data: `HAU` exists and is used regularly (7 entries in the
  5 weeks the journal covers, in 4 of 5 weeks) but is entered **on or near the
  lesson**, never months ahead — exactly one `HAU` lies in the next 6 months,
  two days out. So it needs a *backward-looking* window of days, the inverse
  of this screen's 6-month forward horizon, which is why it stays separate.
  It also has **no due-date field**: `day.date` is when homework was set, not
  when it is due, so the design's "grouped by Fälligkeit" cannot be built
  faithfully from this API.
- **No exam numbering** ("Klassenarbeit Nr. 1") — not in the API.

## Risks

- **A third-party dependency on a community project.** `schulferien-api.de`
  is a Vercel deployment of hand-maintained JSON files, one per year. Data
  exists for 2025–2028; 2029 already 500s. It can go stale, change shape, or
  disappear. Mitigated by design, not by hope: the fetch never throws, an
  empty result falls back to the derived heuristic, the response is cached,
  and no part of the app's boot path depends on it. The degraded mode is a
  worse *label*, never a missing screen.
- **It is a new outbound origin.** One more service learns the user's state
  and roughly when they open the app. No PII is sent — the request is
  `GET /api/v1/2027/SN`, no auth, no identifiers — but it is worth stating
  plainly in the README alongside the Pirsch note, since "talks only to
  beste.schule" stops being true.
- **The fallback heuristic is known-wrong for short official Ferien** (2027
  Pfingstferien) and for the truncated summer. Acceptable offline; the reason
  the official source is primary.
- **Feiertage names are national, school calendars are state-specific.**
  Cosmetic only: these names label days the API already told us are free, so
  a mislabel never invents or removes a day off.
- **`time-tables/current` returns the *newest* timetable rather than the one
  in effect** (known latent bug, `docs/api-notes.md`). It feeds
  `no_school_dates` here the same way it feeds Heute — not made worse by this
  change, and not fixed by it either.
- **A fifth nav tab tightens the bar.** 390px is the narrow case in the
  design; the 11px label is the design's own answer. Worth a real-device look
  before merge, since this is the first change to touch the nav's dimensions.

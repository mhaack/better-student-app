# Plan: Fixed Klausur plans for Jahrgang 11/12 as a fallback test source

The school publishes the Klausur dates for Jahrgang 11 and 12 for the whole
year up front. Not every teacher enters them in beste.schule, so Termine,
Heute's Anstehend list and the Stundenplan dots miss some of them. The plans
now live in `public/data/klausuren_<Jahrgang>_<YYYY>_<YY>.json`:

```json
{"date": "2026-11-03", "kurs": "ph2", "teacher": "RCD", "duration": 90}
```

## Rule: beste.schule first, the file fills gaps

**beste.schule stays exactly as it is today.** Every KLA/LEI note, small
tests included, keeps showing the way it does now, unchanged. A file entry
is added **only if beste.schule has no test for that day and Kurs**. If it
does, the file entry is dropped, with one exception: a covering Klausur
(KLA) takes the plan's **Dauer**, which the Klassenbuch never records. Its
Thema, periods, room and teacher stay beste.schule's. A smaller test (LEI)
on that day hides the file entry but doesn't take its Dauer, because it is a
different, shorter test. *(Changed after review: originally nothing was
merged, not even the Dauer.)*

"Same day and Kurs" means the same `date` and the same `subjectId`, because a
student has one Kurs per subject. If the file entry has no `subjectId` (see
below), the fallback is the teacher code: the note's `teacher` (journal
lesson teacher `local_id`s) contains the file's `teacher`.

## Context: matching the file to the student

Checked against `fixtures/raw/groups-include-students-subjects.json` and
the timetable fixture:

- **Kurs ↔ group**: the group `local_id` with the Jahrgang prefix
  (`^[0-9-]+`) stripped, compared **case-sensitively**. `11BIO1` → `BIO1`,
  `11ph2` → `ph2`, `11-12la1` → `la1`. Case is meaningful: `MA1` (LK) and
  `ma1` (GK) are different Kurse with different dates.
- **Which file**: Jahrgang from `getSchoolContext().intervalType`
  (`11er`/`12er`); the school year comes from `year.from` (`2026-08-…` →
  `2026_27`). `la1` (a `11-12` group) is in both files with the same dates,
  so picking one file by Jahrgang is enough. Sek I: no file, nothing changes.
- **Some groups have no subject**: `11fr1`, `11gh1` and `11ree1` come back
  with `subjects: []`, and `context.courses` filters those out. Matching uses
  the student's raw non-class groups instead, and takes the subject from the
  timetable lesson of that group (`lesson.group.local_id`). If neither has
  one, the label is the Kurs code.
- **Teacher codes** (`KLH`, `RTH` …) are the timetable teachers'
  `local_id`. The full name comes from there, falling back to the code.
- **Hosting**: same-origin, so the CSP `connect-src 'self'` covers it with no
  new host, and the service worker's network-first runtime cache keeps it
  available offline.

## Approach

### `data/klausuren.js` (new)

- `fetchKlausurPlan(jahrgang, year)`: `fetch("/data/klausuren_…json")`,
  cached for a day via `cached()`. A 404, a network error or bad JSON returns
  `[]`. The file is a bonus and must never break a screen.
- `klausurenForStudent(entries, groups, timetable)` (pure): keeps the
  entries whose `kurs` matches one of the student's groups, and maps each to
  the exam shape `examsFromNotes()` produces:
  `{ id: "klausur:<date>:<kurs>", date, subject, subjectShort, subjectId,
  typeName: "Klausur", typeCode: "KLA", text: "", periods: [],
  periodLabel: "", teacher, duration, source: "plan" }`.
- `withPlannedKlausuren(noteExams, planExams)` (pure): returns
  `noteExams` unchanged, plus every plan exam that no note exam covers (rule
  above), sorted by date and first period.
- One loader, `getPlannedKlausuren(studentId, fromIso, toIso)`, used by all
  three screens. It reads `getSchoolContext` (cached), groups and timetable,
  and catches every failure as `[]`.

### Placement in the grid: the Kurs's own lessons (decided)

The file has no period. `attachExams()` gets one addition: an exam with no
`periods` takes them from that day's lessons with the same `subjectId`. From
there the existing code does the rest: the dots land on the Kurs's own cells,
room and teacher come from the grid (so a room change shows the new room),
and Zeit reads "3.–4. Stunde · 09:50–11:20". **If the Kurs has no lesson that
day**, the exam still counts for the day and the header opens the sheet, but
no cell gets a dot, and Zeit/Raum are left out.

Needed for that: `mapTimetableLesson` keeps `groupLocalId`, and
`periodLabel` gets exported, or `attachExams` builds the label from the
resolved periods.

### Screens

- **Termine** (`getTermineData`): `withPlannedKlausuren(examsFromNotes(notes),
  planned)`. File Klausuren appear in "Als nächstes" and in the list.
- **Heute / Anstehend**: plan exams within the 14-day window join the notes
  before the sort and the cut to 6, and open the same sheet.
- **Stundenplan**: `fetchWeekExams` adds the week's plan exams, so dots,
  sheet and the legend's test count include them.

### No new UI: the duration rides on existing fields

Every view already renders `periodLabel`/`timeLabel`, so the data layer puts
the Dauer there instead of adding a new row:

- `periodLabel` of a plan exam is "3.–4. Stunde · 90 Min.", or "90 Min."
  when the Kurs has no lesson that day. It shows on Termine's lines, in the
  Anstehend sheet's subtitle and, through `timeLabel`, in the test sheet's
  Zeit row ("3.–4. Stunde · 09:50–11:20 · 90 Min.").
- `text` stays empty. Termine and the sheets already leave the Thema/body
  out when there is no text.
- **The one view touch**: Heute's Anstehend row renders `Fach · text`. In
  `views/heute.js` the " · text" part is left out when `text` is empty (a
  rendering guard for an optional field), and `getHeuteData` stops dropping
  exams without text. Notes of other types without text are still dropped,
  as today.

### Docs

`docs/api-notes.md` gets a short section: the Klausur plan is a second,
static exam source, the Kurs ↔ group naming rule, and groups with empty
`subjects`.

## Tests (first, per CLAUDE.md)

`scripts/test-klausuren.mjs`, with Kurs codes and teacher codes like the
real ones, no student data:

- `MA1` matches `11MA1` and not `11ma1`; `ma1` the other way round.
- `la1` matches `11-12la1`.
- A Kurs the student doesn't take is ignored.
- A group with `subjects: []` (`11gh1`) gets its subject from the timetable.
- **beste.schule wins**: a KLA note on the same date and subject drops the
  file entry. The note keeps its fields and gains only the Dauer
  (`periodLabel` and the sheet's Zeit row end in "90 Min.").
- A LEI (small test) on the same day and subject also drops it, and stays
  identical to before (no Dauer).
- A note on the same day for a *different* subject keeps the file entry.
- A note on a different day for the same subject keeps the file entry.
- Teacher-code fallback when the plan exam has no `subjectId`.
- `attachExams`: a plan exam takes the periods of the Kurs's lessons that
  day, a room change shows the new room, and a day without a lesson for that
  Kurs gives no `hasExam` cell but keeps the exam on the day.
- A missing or broken file gives no exams, and the screens work as before.

The existing Termine and Stundenplan exam tests must keep passing unchanged.
Plus: a plan exam's `periodLabel`/`timeLabel` carry "90 Min.", and Heute
keeps a plan exam without text while still dropping text-less notes of
other types.

Then a Playwright check at 390×844 against mocked routes: a file Klausur in
Termine, in Anstehend (no dangling " · "), as a dot in the grid, and the
duration in the sheet's Zeit row.

## Not in this pass

- Sek I (no files exist).
- Any UI to pick or upload a plan; new plans are dropped into
  `public/data/` by hand.
- A separate "Dauer" row or any other new UI element.

## As built

- Periods come from the **base timetable by group** (`groupLocalId`, now kept
  by `mapTimetableLesson`), not by subject from the grid. That way Termine
  shows "1.–2. Stunde · 90 Min." too, and `attachExams` keeps its join by
  period and subject unchanged. Room and teacher still come from that day's
  grid, so a published room change shows the new room.
- `timeLabel` is built from the periods plus `durationLabel`: "1.–2. Stunde
  · 07:30–09:05 · 90 Min.". Output for notes is unchanged. `periodLabel`
  moved to `util/format.js`.
- No teacher-name lookup from the file's code: the sheet's teacher comes from
  the grid like every other exam, and with no lesson that day there's no Raum
  row anyway.
- `getPlannedKlausuren()` never throws; each screen fetches it alongside the
  journal call. `withExamDetails()` takes the plan exams as an optional last
  argument, so Heute's Anstehend gets them with the sheet fields.

Verified: 19 cases in `scripts/test-klausuren.mjs`, all 10 test files
passing. Rendered at 390×844 against mocked API routes: Termine lists the
plan Klausuren for the student's Kurse only, and a Kurs whose Klausur
beste.schule already has shows the beste.schule entry alone. Anstehend shows
"Mathematik" with no dangling " · ". The grid dots the Kurs's two Monday
cells, and the sheet's Zeit row carries the Dauer.

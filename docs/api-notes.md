# beste.schule API — verified notes

Recorded 2026-09 against the live API with a guardian Personal Access Token
(a Saxon Gymnasium, one student in Jahrgang 11).
Raw responses live in `fixtures/raw/` (gitignored — they contain real student
data). Everything below was observed, not inferred.

## Transport

- Base URL `https://beste.schule/api`, `Accept: application/json`,
  `Authorization: Bearer <token>`.
- Responses are `{ data, links, meta }`; `meta.version` is `"0.3"`.
- Pagination: `meta.current_page` / `meta.last_page` / `per_page`. **`per_page`
  is capped at 100** — asking for 250 still returns 100 per page, so multi-page
  fetches are real (e.g. `substitution-plans/days` came back as 3 pages).
- The API uses spatie/laravel-query-builder: invalid `include`/`filter` values
  fail with HTTP 400 and an error body that lists what *is* allowed. Worth
  reading verbatim when something breaks.

## Includes and filters that work

| Route | Verified params |
|---|---|
| `students` | — |
| `school` | — |
| `years` | — (intervals come nested; no separate `intervals` call needed) |
| `subjects` | `filter[student]` |
| `groups` | `filter[student]`, `include=subjects,students` |
| `grades` | `filter[student]`, `filter[year]`, `filter[interval]`, `filter[subject]`, `include=collection.subject,teacher` |
| `collections` | `filter[student]` |
| `finalgrades` | `filter[student]`, `filter[year]` |
| `time-tables/current` | `include=lessons.times` |
| `substitution-plans/days` | `filter[range]=YYYY-MM-DD,YYYY-MM-DD`, `include=lessons,subject,teachers,rooms,notes` |
| `journal/lessons` | `filter[student]`, `filter[range]`, `include=notes.type` |
| `announcements` | `include=readGuardiansCount,readStudentsCount` (see below); `filter[student]`; `sort=read_from` |
| `absences`, `notifications`, `checklists` | — |
| `notes` | **403** for this (guardian) role |

**`subject` is not an allowed include on `grades`.** The allowlist is
`student, teacher, collection, collection.subject, histories, readBy`
(each also with `…Count` / `…Exists`). A grade has no subject of its own — it
inherits the subject of its collection.

## Shapes that differ from the obvious guess

- **People**: `forename` + `name`, where `name` is the *surname*
  (`{ forename: "Maria", name: "Schmidt" }`). Not firstname/lastname.
- **Student**: `{ id, forename, nickname, name, birthday, meta_groups[], tags[] }`.
  The class/Tutorenkurs is in `meta_groups` (`meta: 1`); there is no school
  field — use `/api/school`.
- **Groups** are the courses a student takes (`meta: 0`), each with its
  `subjects[]`. `/api/subjects` lists everything the *school* offers (21 here,
  including a leftover "Coronatest"), so it is the wrong source for "which
  subjects does this student have".
- **Rooms** are arrays and labelled by `local_id` ("210", "THR1", "Home1") —
  there is no `name`. **Teachers** are arrays too; a lesson can have several
  of both.
- **Grade**: `{ id, value: "8", given_at, read, student_id, collection_id,
  collection: {...}, teacher: {...} }`. `value` is a string.
- **Collection**: `{ id, type, weighting, name, given_at, interval_id,
  subject_id, interval: {...}, subject: {...} }`. `type` is free text
  configured per school — this school uses "Sonstige"; it is *not* a fixed
  code like "KA"/"So", so UI must not hardcode buckets.
- **Interval**: `{ id, name: "1. Schulhalbjahr", type, from, to, year_id }`
  with `type` one of **`"Sek I"` / `"11er"` / `"12er"`**. A year carries all
  six (two per type); which ones apply depends on the student's Jahrgang.
  **This is the grading-scale signal**: Sek I = Noten 1–6, 11er/12er =
  Oberstufe Punkte 0–15.
- **Finalgrades** here are `{ id, calculation_verbal, calculation_for:
  "teacher", subject_id, interval_id, teacher_id, teacher, subject }` — **no
  value and no `calculation_rule`**, so there is nothing official to display
  and every subject average the app shows is its own estimate ("geschätzt").
  The detail route `finalgrades/{id}` returns exactly the same fields as the
  list, so there is no reason to fetch it per id.
- **Timetable lesson**: `{ id, weekday (1 = Monday), nr (period), weeks: ["A"],
  subject, group, teachers[], rooms[], time: { nr, from, to } }`. The
  timetable also carries `weeks[]` mapping ISO calendar weeks to A/B, plus
  `no_school_dates[]`.
- **`substitution-plans/days`** returns the *whole* published day, not just
  changes: `{ date, notes[], lessons[] }` where each lesson has
  `status: "initial" | "planned" | "canceled"` (one "l"). There is no explicit
  "room change" vs "substitution" — compare against the base timetable to tell
  them apart. Day-level `notes[]` carry school-wide announcements.
- **A changed plan lesson lists the original *and* the new entries together**
  in its `rooms[]` and `teachers[]`, with nothing marking which is which.
  Rooms come sorted alphabetically (`["206", "218"]` for 218 → 206); a
  stand-in teacher appears next to the regular one (`["Sandra Kaiser",
  "Ulrike Raupach"]` for Raupach → Kaiser). The new entry is whichever one the
  base timetable doesn't have — see `diffList` in `js/data/timetable.js`.
  Printing the plan's array as "the new room/teacher" is always wrong.
- **`journal/lessons`** is the Klassenbuch: notes hang off a lesson as
  `{ id, description, type: { local_id, name } }`. Types seen: `LEI`
  ("Leistungskontrolle", an announced test) and `STU` ("Stundenthema", what the
  lesson covered — backward-looking). No `due_date`; the lesson's own date is
  the date it applies to. A double period records the **same entry twice, once
  per lesson, with different note ids** — dedupe by content.
- **Announcement** body is `message` (markdown-ish, with attachment links).
  See *Announcements* below.

## Announcements

Verified 2026-09 (guardian token, 2 items). One page of `per_page: 20`.

```
{ id, title, message,
  read_from, read_to,       // visibility window, YYYY-MM-DD — no created_at
  write_from, write_to,     // window in which a confirmation can be given
  for: "guardian" | "student",
  need_confirmation_from_student: 0|1,   // ints, not booleans
  need_confirmation_from_guardian: 0|1,
  single_group: false,
  type: { id, name: "Elternbrief", color: null, default, default_for } }
```

- **There is no `created_at` and no `read` field.** The mapper's old guesses
  (`created_at`/`date`, `read`/`is_read`) all miss. `read_from` is the only
  date and works as "published on"; the list comes back in `id` order.
- `message` is Markdown: `**bold**`, blank-line paragraphs, a trailing
  `"  "` hard break, and links as `[Name.pdf](/attachments/463)` with a
  **path relative to the site root**. Some senders type lists inline
  (`"… empfehlen wir: - a, - b, - c"`), so they don't render as real lists.
- Allowed includes: `teacher`, `guardians`, `students`, `groups` (each with
  `…Count`/`…Exists`), `readGuardiansCount`, `readStudentsCount`,
  `allGuardiansCount`, `allStudentsCount`, `readByAnyGuardianCount`,
  `readByAllGuardiansCount`. Allowed sorts: `id, title, read_from, read_to,
  for, read`. Allowed filters: `title, type, min_groups, min_students, group,
  student, guardian, teacher, subject, room, interval, year, role, school`.
- **Read state** lives on per-person rows: with `include=guardians,students`
  each person carries `status: [{ id, read: bool, response: [] }]`. An item
  sent to 47 whole groups had *no* guardian/student rows at all until someone
  opened it, so "no row" means unread. Those includes also bring emails,
  phone numbers and all 47 groups — don't use them for this. The counts are
  enough: `read_guardians_count` / `read_students_count` came back `1/0` on
  the item this guardian had opened and `0/0` on the unopened one. The counts
  appear to be scoped to the viewer (`all_guardians_count: 1` for a student
  who surely has two guardians), but that is only verified for one account.
- **Role**: `GET /api/user` (alias `/api/me`) returns `role: "guardian"`,
  plus `unread_notifications_count`. That's how to pick which count applies.
- **Attachments**: `GET /api/attachments/{id}` with the Bearer token answers
  `302` to a presigned S3 URL (`s3-eu-central-1.ionoscloud.com`, expires in
  5 min), with CORS headers on the 302. A `fetch` would follow it to a host
  the CSP's `connect-src` doesn't allow. The web path `/attachments/{id}` (what
  the Markdown links to) needs a beste.schule *web session*: without one it
  302s to `/login`.
- Confirming ("Lesebestätigung") is not verified yet: no write route is known.

## No LK/GK anywhere

Nothing in `groups`, `subjects`, `grades` or `finalgrades` marks a course as
Leistungs- or Grundkurs. The only available signal is this school's group
naming convention — subject code uppercase for LK, lowercase for GK
(`11MA1`, `11BIO1` vs `11ph2`, `11de2`) — which matched the student's two
actual LKs. The app treats it as a hint and falls back to one flat list when
the result looks implausible (see `resolveCourseTypes` in `js/data/context.js`).

## OAuth from a browser-only app

**`/oauth/token` is CORS-enabled** (verified 2026-09), so the authorization
code exchange can run in the browser with no server or edge function:

- `OPTIONS /oauth/token` preflight -> `204` with
  `access-control-allow-origin: <caller origin>`, `allow-methods: POST`,
  `allow-headers: authorization,content-type,accept`.
- The **actual** `POST` response carries the same `access-control-allow-origin`
  too (a preflight passing alone wouldn't be enough — the browser also has to
  be allowed to read the real response). Probed with a bogus client_id: the
  reply is a readable `401 {"error":"invalid_client"}`, i.e. rejected on the
  credentials, not on CORS.
- The origin is echoed back rather than `*`, alongside
  `access-control-allow-credentials: true`, so any origin works — including
  `localhost` during development.
- `/oauth/authorize` needs no CORS at all: it's a top-level browser redirect,
  not a fetch.

The token endpoint accepts a JSON body (not just form-encoded).

**Public (secret-less) clients are supported.** Creating a client with
"Proof Key for Code Exchange" ticked yields a client with no secret. Verified
by posting to `/oauth/token` with only a `client_id` and a deliberately bogus
code: the reply is `400 invalid_grant` ("Cannot validate the provided
authorization code") — the client authenticated fine and only the code was
rejected. A confidential client would have answered `invalid_client` instead.
That one-word difference is the whole test.

Two notes on the client registration UI:

- The client id is a small **integer** (this account's is 236), not a UUID —
  older Passport. Easy to miss when scanning for a long random-looking string.
- A PKCE client is shown **without a secret**, which is correct, not a failed
  creation.

`/oauth/authorize` accepts the client and 302s an unauthenticated visitor to
`/login`, as expected.

### Still open

- There are no scopes: a token carries the full permissions of the logged-in
  user's role, so OAuth buys a real login screen, expiry and revocation here —
  not least privilege.
- Access-token lifetime and whether refresh tokens rotate (the app handles
  rotation either way — it stores whatever the refresh response returns).

## Still open
- Write routes (marking announcements read / confirming them, notifications)
  and their CORS. `OPTIONS /api/announcements` allows only `GET`.
- Token lifetime and rate limits.
- Whether other schools populate `calculation_rule` on finalgrades (the
  formula evaluator in `js/domain/grades.js` handles it if they do).

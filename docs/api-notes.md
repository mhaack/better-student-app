# beste.schule API — verified notes

Recorded 2026-09 against the live API with a guardian Personal Access Token
(a Saxon Gymnasium, one student in Jahrgang 11).
Raw responses live in `fixtures/raw/` (gitignored — they contain real student
data). Everything below was observed, not inferred.

## There is an OpenAPI spec — read it before guessing

**`https://beste.schule/api.json`** (OpenAPI 3.1, ~2.7 MB, 242 paths) is the
machine-readable spec behind `https://beste.schule/documentation/api`. It lists
every route, its verbs, request bodies and responses.

Check it *first*. Guessing route names cost us real time: the Lesebestätigung
endpoint is `POST /announcements/{id}/respond`, and probing for `read`,
`confirm`, `confirmation` and `mark-read` found nothing because none of those
exist. The docs UI also tags routes unevenly — `/notifications` is in the spec
but easy to miss in the rendered page.

Two traps when probing by hand:

- **A CORS preflight proves nothing about a route.** `OPTIONS` with an
  `Origin` + `Access-Control-Request-Method` returns `204` and echoes the
  requested method back for *any* path, `api/totally/bogus/path/xyz` included.
  Only the actual request shows whether the browser may read the response.
- **Unknown `/api/...` paths answer `401 {"message":""}`, not `404`** — they
  fall through to a web-session-guarded catch-all. A plain `OPTIONS` (no CORS
  headers) is the reliable probe: a real route reports its verbs in `Allow:`,
  while the catch-all always says `Allow: GET,HEAD`.

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
| `announcements`, `absences`, `notifications`, `checklists` | — |
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
- **Announcement** body is `message`: Markdown (`**bold**`, `\n\n`
  paragraphs, `[file.pdf](/attachments/463)` links **relative** to
  `https://beste.schule`), no HTML. There's no `created_at`: the only dates
  are `read_from`/`read_to` (visibility window) and `write_from`/`write_to`
  (meaning unclear). No read flag and no author by default — use
  `include=teacher,readGuardiansCount,readStudentsCount`; the read counts
  are scoped to the viewer, not school-wide. Attachments exist only as links
  in `message`. `/api/attachments/:id` returns metadata as JSON, and
  otherwise 302s to a presigned S3 URL on `s3-eu-central-1.ionoscloud.com`
  that sends **no CORS headers** for any origin (preflight → 403), so the
  browser can't fetch attachment bytes at all; the web route `/attachments/:id` needs a web
  session. Re-checked 2026-09-30 against the OpenAPI spec and the live API —
  see "Attachments can't be shown in-app" below before probing this again. Allowed filters include `student`; there's no `read` filter.
  `GET /announcements/{id}` also takes **`append=stat`**, which returns
  per-group read stats: `{ group, students_read_count, guardians_read_count,
  students_count, guardians_count, read_by_any_guardian_count,
  read_by_all_guardians_count }`. Details in `docs/plans/mitteilungen.md`.

## Sending a Lesebestätigung (verified 2026-09-30)

**`POST /api/announcements/{id}/respond`** — "Marks the announcement as read
for all entities belonging to the authenticated user and optionally stores
form-field answers." Body optional, `{ "response": "<string>" }` for the form
answers; `200` returns the announcement, `422` validation, `404` unknown id.

- Works from the browser: the **actual** `POST` response carries
  `access-control-allow-origin: <caller origin>`, not just the preflight.
- A guardian token is authorized. Confirming again is idempotent — the read
  counts don't move.
- It marks the letter read for **every** entity belonging to the signed-in
  user, so a guardian with several children confirms for all of them at once.
  There is no per-child variant.
- **The 200 body carries personal data nobody asked for:** `guardians` and
  `students` come embedded regardless of `include`, with phone numbers,
  e-mail addresses, a child's `birthday`, `gender`, `nickname` and `tags`
  (which can include medical consent markers). It also *omits* the read
  counts, since those only exist as includes. `data/repository.js` throws the
  body away and refetches through the narrow include list instead.
- Each embedded entity does carry a `status: { id, read, response }` — real
  per-person read state, unlike the aggregate counts. Reading it means
  requesting the personal data above, so the app doesn't.
- **`write_from`/`write_to` do not gate responding** (verified 2026-09-30).
  They looked like the window in which a response is accepted, but a guardian
  confirmed announcement 3866 through this app on 30.09, seven days after its
  `write_to` of `2026-09-23`, and the API returned 200. What the pair actually
  means is still unknown — just not this. The app keeps treating any non-200
  as "use beste.schule" rather than predicting a rule from two dates.
- The letter's own page on the web app is
  `https://beste.schule/school/announcements/{id}` (from a notification's
  `redirect_url`) — the fallback link.

## Attachments can't be shown in-app (re-verified 2026-09-30)

Settled, and not for lack of a route: the spec documents only
`GET/POST /attachments`, `GET /attachments/{attachmentId}` and
`DELETE /attachments/{attachment}`. There is no inline, preview, base64 or
download variant, and the `Attachment` schema is just
`{id, filename, filesize_kb, attachmentable_type, attachmentable_id, url}` —
`url` being the session-guarded web route. The spec's "a valid signed URL
bypasses the read authorization check" means Laravel signed routes the server
generates; the API never hands one to a client.

**Two independent blockers**, either of which alone would be fatal:

1. `GET /api/attachments/:id` with a non-JSON `Accept` 302s to a presigned URL
   on `s3-eu-central-1.ionoscloud.com`. That bucket answers a CORS preflight
   with **403** and its real `GET` sends no `access-control-allow-origin` at
   all, so `fetch` can't read the bytes. Reading the `Location` instead
   doesn't work either: a cross-origin `redirect: "manual"` fetch yields an
   opaque-redirect response with no readable headers, by spec.
2. Even holding the presigned URL, S3 serves the file as
   `content-disposition: attachment; filename="…"`, baked into the signature.
   An `<iframe>`/`<object>` pointed at it downloads the file instead of
   rendering it.

The embedding escape hatches are closed too: an `<iframe>` can't send an
`Authorization` header, and the route accepts no token in the query string —
`?token=`, `?access_token=`, `?api_token=`, `?signature=` all 401. The web
route without a session cookie 302s to `/login`, and third-party cookies are
blocked in an installed PWA anyway.

Note the presigned URL needs **no credentials** — plain `curl` follows the
redirect and gets `200 application/pdf`. CORS is a browser rule, not a server
one, so "curl can download it" is not evidence the app could. Only
beste.schule enabling CORS on the bucket, or adding an API route that streams
the file with CORS headers and an inline disposition, would change this. A
proxy of our own stays ruled out: it would route tokens and student documents
through our server.

## Role: `/api/me`

`GET /api/me` (and the identical `/api/user`) returns `role: "guardian"` —
the only reliable way to tell a guardian session from a student one. It also
returns `email`, `phone_private`, `unread_notifications_count`, a nested
`guardian`/`teacher` object and a `students` array with birthdays, so
`mapMe()` keeps `role` and drops everything else.

Announcements keep guardian and student read state in **separate** fields
(`read_guardians_count` / `read_students_count`), and a letter asks only one
of them to confirm. Summing them conflates the roles: a letter would look read
as soon as the child opened it, hiding the guardian's outstanding
Lesebestätigung. Pick the side that matches `role`.

## Notifications (not used by the app)

`GET /api/notifications` is the bell feed — one entry per event, shaped
`{ id (uuid), notification_type: "grade" | "announcement", action: "created" |
"updated", read_at, redirect_url, data, … }`. `POST /api/notifications/read`
and `POST /api/notifications/{id}/read` mark them read.

This is an inbox marker, **not** a Lesebestätigung, and it duplicates what the
app already derives from grades and announcements — so nothing calls it.

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
- What `write_from`/`write_to` on an announcement actually mean. They don't
  gate responding (see above).
- Token lifetime and rate limits.
- Whether other schools populate `calculation_rule` on finalgrades (the
  formula evaluator in `js/domain/grades.js` handles it if they do).

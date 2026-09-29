# Plan: Mitteilungen (announcements)

## Context

beste.schule announcements (Elternbriefe, Informationen der Schulleitung) are
invisible in the app today. `fetchAnnouncements()` + `mapAnnouncement()`
exist but nothing calls them, and the mapper's field names were guesses.
Checked against the live API on 2026-09-28 with a guardian token (one child,
two announcements visible) — findings below, also recorded in
`docs/api-notes.md`.

## What the API returns

`GET /api/announcements` — standard paginated envelope (`data`, `links`,
`meta` with `per_page: 20`, `total`). `apiFetchAll` already handles that.

Per item (no extra includes):

| Field | Example / meaning |
|---|---|
| `id` | number |
| `title` | plain text, always set ("Belehrung Sportunterricht 2026/2027") |
| `message` | **Markdown** (see below) |
| `read_from` / `read_to` | `YYYY-MM-DD` — visibility window. The **only date** on the item; there is no `created_at`. `read_from` is effectively the publish date. |
| `write_from` / `write_to` | `YYYY-MM-DD`, meaning unclear (maybe the confirmation window) — ignore for now |
| `for` | `"guardian"` or `"student"` — intended audience. A guardian sees both kinds. |
| `need_confirmation_from_guardian` / `…_student` | `0`/`1` — whether a Lesebestätigung is requested |
| `single_group` | boolean |
| `type` | `{ id, name: "Elternbrief", color: null, … }` |

Not present: author, read flag, attachments field, expiry flag beyond
`read_to`.

**Includes** (`include=` allowlist): `teacher`, `guardians`, `students`,
`groups`, and counts `readGuardiansCount`, `readStudentsCount`,
`readByAnyGuardianCount`, `readByAllGuardiansCount`, `allGuardiansCount`,
`allStudentsCount` (+ the usual `…Count`/`…Exists`).
- `include=teacher` → `{ id, local_id, forename, name, tags }` — the author.
  `name` is the surname, as elsewhere.
- `include=readGuardiansCount,readStudentsCount` → `read_guardians_count` /
  `read_students_count`. These are **scoped to the viewer**, not school-wide
  (a school-wide letter shows `1`, not hundreds): `1` on the letter from
  August, `0` on last week's one. This is the read state.
- `guardians` / `students` carry personal data (phone, e-mail, birthday) —
  **don't request them**.

**Filters** (allowlist): `title, type, min_groups, min_students, group,
student, guardian, teacher, subject, room, interval, year, role, school`.
`filter[student]=<id>` is accepted and returned the same two items; with one
child we can't tell whether it narrows per child. `filter[read]` doesn't
exist. `GET /api/announcements/:id` works and returns the same shape.

**`message` format.** Real Markdown, LF line breaks, no HTML, no entities:
- paragraphs separated by `\n\n`; one line ends in two spaces + `\n` (a
  Markdown hard break)
- `**bold**` (used as an in-body headline)
- links as `[Belehrung_Sportunterricht.pdf](/attachments/463)` — **relative**
  to `https://beste.schule`. No bare URLs in either item.
- one "list" is flattened into a sentence (`… empfehlen wir: - a, - b, - c.`),
  i.e. the editor doesn't reliably produce real list syntax. Don't try to
  rescue that.
- the sender's name is typed at the end of the body by hand.

**Attachments** are *only* Markdown links in `message`; there's no separate
field. `GET /api/attachments/463` (bearer) → `{ id, filename, filesize_kb,
attachmentable_type: "App\\Models\\Announcement", attachmentable_id, url }`,
where `url` is the web route `https://beste.schule/attachments/463`.
- The web route needs a beste.schule **web session** (bearer → 302 to
  `/login`). Opening it in a new tab works only if the user is logged in to
  beste.schule in that browser.
- The API route with `Accept` other than JSON (or `?download=1`) 302s to a
  **presigned S3 URL** on `s3-eu-central-1.ionoscloud.com` (5-minute
  expiry). Fetching the file in-app would need that host in `connect-src`
  (and S3 CORS) — not doing that without discussing it.

**Today's two items** (content summarised): (1) Elternbrief from the sports
department, visible Aug 2026 – Sep 2027, asks guardians to read and confirm
the PE safety briefing, one PDF attachment; already read (count 1). (2)
Letter from the head teacher, visible 23.–30.09., informs about a police
presence near the school and gives safety advice, no attachment; unread.

## Mapper corrections (`api/mappers.js`)

Current `mapAnnouncement` gets two of five fields right:

| Field | Now | Reality |
|---|---|---|
| `title` | `raw.title` | ✓ |
| `body` | `pick(message, body, text, …)` | ✓ via `message`; drop the other guesses |
| `createdAt` | `pick(created_at, date)` | ✗ always `undefined` → replace with `date: raw.read_from`, `visibleUntil: raw.read_to` |
| `read` | `pick(read, is_read)` | ✗ always `false` → `readCount: (read_guardians_count ?? 0) + (read_students_count ?? 0)`; the boolean is decided in `data/` |
| — | — | add `type: raw.type?.name`, `author` (`forename name` from `teacher`, or `null`), `needsConfirmation` (either flag set) |

`fetchAnnouncements()` requests
`include=teacher,readGuardiansCount,readStudentsCount`, no filter.

## Body rendering: tiny safe Markdown subset

The format is Markdown, so plain linkify isn't enough (it would show
`[name](/attachments/463)` literally). New pure function in `domain/`
(unit-tested), e.g. `domain/markdown.js → renderMessage(text)`:

1. `escapeHtml()` the whole string first.
2. Split on blank lines into `<p>`; single `\n` (with or without trailing
   spaces) → `<br>`.
3. `**x**` → `<strong>x</strong>`.
4. `[text](href)` → link, where `href` is resolved against
   `https://beste.schule` with `new URL()` and kept **only if** the protocol
   is `https:`/`http:`; otherwise the text is left as plain text.
5. Bare `https?://` URLs → links (none seen yet, cheap to support).

Everything else (headings, lists, italics, HTML) stays literal. Links get
`target="_blank" rel="noopener noreferrer"`.

**Attachments** are extracted in `data/`: a link whose resolved path matches
`/attachments/\d+` becomes `{ id, name: linkText, url }` and is removed from
the body (an emptied trailing paragraph is dropped). The detail screen shows
them as tappable rows (file icon, name) opening
`https://beste.schule/attachments/<id>` with `target="_blank"` — a
navigation, so no CSP change. In the installed PWA that opens as an in-app
browser sheet over the app; the first time it asks for the beste.schule web
login, after that the browser session persists. Row subtitle: "Öffnet in
beste.schule".

Opening the file *inside* the app was checked and isn't possible client-side
(decided 2026-09-29): the API's 302 carries CORS headers for our origin, but
the S3 bucket it redirects to sends no `Access-Control-Allow-Origin` for any
origin and answers preflights with 403, so `fetch` can't read the file even
with the host in `connect-src`. `redirect: "manual"` hides the presigned
`Location`, the token isn't accepted as a query parameter, and the file is
served as `Content-Disposition: attachment` anyway. A proxy of our own would
route tokens and student documents through our server — ruled out. If
beste.schule ever enables CORS on the bucket, revisit.

## Data layer (`data/mitteilungen.js`)

`getMitteilungenData()` → `{ items, fresh, unreadCount }`:
- `items`: all, sorted by `date` desc, then `id` desc. Each gets
  `read = readCount > 0`, `preview` (first non-empty line of the body with
  Markdown stripped, ~120 chars), `attachments`, `bodyMarkdown` (without the
  attachment links).
- `fresh`: unread **and** `date` within the last 14 days. Read-only means an
  item stays "unread" until confirmed on beste.schule, and one letter here is
  visible for a whole year — so "unread" alone would pin it to Heute for
  months. The 14-day window keeps Heute about what's new.
- `unreadCount`: all unread items (for the Mehr row).

## UI

- **Heute:** compact "Mitteilungen" section at the **end** of the screen,
  after the Klassenbuch notes — the day's plan stays first. Only rendered
  when `fresh` is non-empty: per item title, date, one-line preview, accent
  dot; tap → detail. Loaded independently of the Heute data so an
  announcements error just hides the section instead of breaking Heute.
- **Bottom nav:** a small accent dot on the Mehr tab icon while
  `unreadCount > 0`. Once an item is older than 14 days it leaves Heute but
  can stay unread for months (one letter is visible for a year); the dot
  keeps it findable without a sixth tab (five already barely fit at 390px).
- **List `#/mehr/mitteilungen`:** back link `‹ Mehr`, cards with title, date
  (`formatFullDate`, new in `util/format.js` — `weekdayOrDate` is for near
  dates only), type ("Elternbrief"), two-line preview, unread dot, paperclip
  when attachments exist. Empty → `renderEmptyState("Keine Mitteilungen.")`.
- **Detail `#/mehr/mitteilungen/:id`:** back link `‹ Mitteilungen`, title,
  date · type · author (if present), rendered body, attachment rows. If
  `needsConfirmation && !read`: a muted note "Lesebestätigung in beste.schule
  erforderlich". Reads from the same cached list — no second request.
- **Mehr:** a "Mitteilungen" row at the top with the unread count badge;
  drop "und Mitteilungen" from the placeholder sentence (Hausaufgaben and
  Fehlzeiten remain).
- Routes nested under `/mehr` so the Mehr tab stays highlighted
  (`currentBasePath()` uses the first segment). No fifth tab.
- Read-only: no mark-as-read write (CORS of write routes unconfirmed).

## Tests

`scripts/test-mitteilungen.mjs` with synthetic messages in the real shape
(no real text): `**bold**`, `\n\n` paragraphs, `"  \n"` hard break, a
relative `/attachments/123` link, an absolute link, a `javascript:` link
(must stay text), `<script>` in the body (must be escaped), a bare URL.
Plus `fresh`/`unreadCount` selection around the 14-day edge, and the mapper
on a raw item shaped like the API's.

## Open questions

1. Multiple children: fetch unfiltered (current plan) or per selected child
   with `filter[student]`? Unverifiable with one child; unfiltered can't
   miss anything.
2. Read counts were checked with a guardian token only. For a student token
   `read_students_count` should be the one that matters; summing both is
   assumed to be right for either role.

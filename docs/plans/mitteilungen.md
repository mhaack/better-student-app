# Plan: Mitteilungen (announcements)

## Context

beste.schule sends Elternbriefe and school notices as *announcements*. Some of
them ask for a confirmation ("Lesebestätigung") within a deadline. The app
doesn't show them at all yet. `fetchAnnouncements()` + `mapAnnouncement()`
exist but nothing calls them, and the mapper was written from guesses. The
live check (2026-09, see *Announcements* in `docs/api-notes.md`) showed that
most of those guesses are wrong.

## What the API gives us (short version)

- `title`, `message` (Markdown), `type.name` ("Elternbrief").
- Dates: **no `created_at`**. `read_from`/`read_to` is the visibility window
  (`read_from` works as "published on"), and `write_to` is the confirmation
  deadline.
- `need_confirmation_from_guardian` / `…_student` (0/1).
- **No `read` flag.** `include=readGuardiansCount,readStudentsCount` gives
  per-viewer counts: 1 means this account has opened/confirmed it, 0 means it
  hasn't. `GET /api/user` → `role` says which count is ours.
- Attachments are Markdown links to `/attachments/{id}`, relative to
  beste.schule. That path only works with a beste.schule web session. The
  API variant redirects to a short-lived S3 URL on a host the CSP blocks.
- No write route is known, so the app can't mark items read or confirm them.

The last point shapes the UI: the server's "unread" only clears when the user
opens the item **on beste.schule**. A badge driven only by the server count
would never go away in our app.

## UI

Two different questions, answered in two places:

1. **"Is there something new?"** Shown on Heute, which is the screen people
   open.
2. **"What did the school send?"** Shown in a list under Mehr, which is also
   where people go to read one in full.

### Heute: a Mitteilungen card at the top

Only shown when there's something to act on:

- **Neu**: not yet seen *in this app* (a local "seen" set of ids, see below).
- **Bestätigung ausstehend**: `needsConfirmation && !confirmed && today ≤
  confirmBy`. Shows the deadline, e.g. "bis 01.10.".

One row per item (title + type/date), tapping opens the detail view. At most
3 rows, then "Alle Mitteilungen ›". It reuses the `card--accent` look of the
Änderungen card. When nothing is new or pending, the card isn't rendered and
Heute stays calm.

### Mehr → Mitteilungen list (`#/mehr/mitteilungen`)

- A "Mitteilungen" row at the top of Mehr with a count of new items. It
  replaces the "kommt später" sentence.
- The list is newest first (by `read_from`). Each card shows the title, type ·
  date, the first ~2 lines of text, and one of two markers: an accent dot for
  *neu*, or a "Bestätigung bis 01.10." chip. The marker has a text label, so
  it doesn't rely on colour, like lesson statuses.
- Items outside `read_from..read_to` are hidden. The API seems to filter these
  already, but that isn't verified.
- The route is nested under `/mehr` so the Mehr tab stays highlighted (same
  reason as `/noten/:id`).

### Detail (`#/mehr/mitteilungen/:id`)

- A `‹ Mitteilungen` back link, title, type · date, and the full body rendered
  from the Markdown subset below.
- Attachments are pulled out of the body into a list of file rows under the
  text ("📎 Belehrung_Sportunterricht.pdf"). They open
  `https://beste.schule/attachments/{id}` in a new tab.
- If a confirmation is pending, a notice with the deadline and a button
  "Auf beste.schule bestätigen" opens beste.schule. The note says that
  confirming isn't possible in this app yet.
- Opening the detail adds the id to the local "seen" set.

### Why no new bottom tab

There are already five tabs, which is the limit at 390 px. There are only a
handful of announcements per year, so a tab would mostly be empty. The Heute
card makes new ones visible anyway.

## Implementation

Following the layering rules in CLAUDE.md:

- **`api/mappers.js`**: fix `mapAnnouncement` to return the real fields:
  `{ id, title, body, typeName, publishedAt: read_from, visibleUntil:
  read_to, confirmBy: write_to, audience: for, needsConfirmation: { guardian,
  student }, readCount: { guardian, student } }`. Shape only, no role logic.
- **`data/repository.js`**:
  - `fetchUser()` (`GET user`, cached) → `{ role }`. Only the role is read
    from it. The route also returns contact data, which we don't keep.
  - `fetchAnnouncements(studentId)` →
    `announcements?filter[student]=…&include=readGuardiansCount,readStudentsCount`.
    The filter makes it follow the student switcher for guardians with
    several children. Do **not** include `guardians`/`students`: they bring
    emails and phone numbers.
- **`data/mitteilungen.js`**: combines role + list + local seen-set into
  `{ id, title, typeName, publishedAt, bodyBlocks, attachments,
  isNew, confirmation: null | { by, done } }`. Filters by visibility window,
  sorts, and exposes `getHeuteMitteilungen()` for the card.
- **`state/seen-announcements.js`**: the local seen set in `localStorage`
  (try/catch, like `state/settings.js`). The first run marks everything older
  than 14 days as seen, so a new install doesn't flag a year of old letters.
- **`domain/markdown.js`**: a small, pure Markdown-subset parser →
  a block list (`paragraph` with inline `text`/`bold`/`link` runs, plus
  `attachment`). It supports blank-line paragraphs, `**bold**`,
  `[text](url)`, bare `https://` URLs and hard line breaks. Anything else stays
  literal text. Relative URLs are resolved against `https://beste.schule`.
  Only `http(s)` links are kept, and `/attachments/{id}` links become
  attachments. The view escapes every text run with `escapeHtml`, so the
  rule "API text is never HTML" in `util/dom.js` still holds. This replaces
  the old plan's `linkify` regex, which can't handle `[name](/attachments/…)`.
- **`views/mitteilungen.js`** (list + detail), a card in `views/heute.js`,
  the row in `views/mehr.js`, and two routes in `app.js`.

## Tests (first)

- `scripts/test-markdown.mjs`: paragraphs, bold, relative attachment link →
  attachment, `javascript:` link dropped, `<script>` stays text, inline
  "- a, - b" stays one paragraph.
- `scripts/test-mitteilungen.mjs`: an anonymized fixture shaped like the two
  real items. It covers the guardian vs. student count, a pending
  confirmation before and after `write_to`, the seen set → `isNew`, the
  visibility window, and the sort order.

## Out of scope / open

- **Confirming in the app.** Needs a write route plus CORS for non-GET methods,
  which aren't known yet (preflight allows only `GET` today).
- **Attachments without a web session.** They'd need `fetch(/api/attachments/{id})`
  and the S3 host in `connect-src`. That is a CSP change, so it needs a
  discussion first. The first version links to beste.schule instead.
- `notifications` / `unread_notifications_count`: a separate feed, not part
  of this plan.
- Only verified with one guardian account. The student-role counts need a
  check with a student token.

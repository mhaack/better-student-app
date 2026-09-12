# Plan: Mitteilungen (announcements)

## Context

The data layer already has `fetchAnnouncements()` + `mapAnnouncement()`
(`public/js/data/repository.js`, `public/js/api/mappers.js`), confirmed
against the live API (`docs/api-notes.md`: body is `message`, markdown-ish,
with attachment links) — but nothing calls it. Guardians/students currently
can't see Elternbriefe or Neuigkeiten at all, even though this is the closest
of the missing features to already being done.

## Implementation

**New files:**
- `public/js/data/mitteilungen.js` — `getMitteilungenData()`: calls the
  existing `fetchAnnouncements()`, sorts by `createdAt` descending, returns
  `{ items }`. Thin, mirrors `data/heute.js` / `data/noten.js` in shape.
- `public/js/views/mitteilungen.js` — mirrors `views/fach-detail.js`'s
  structure: a `‹ Mehr` back-link (`class="back-link" href="#/mehr"`), title,
  `renderSkeleton()`/`renderErrorState()`/`bindErrorState()` from
  `components/states.js` while loading, then a list of cards (date via a new
  `formatFullDate(iso)` in `util/format.js` — `weekdayOrDate` is for near
  dates only and wrong here since announcements can be old). Empty list →
  `renderEmptyState("Keine Mitteilungen.")`.

**Rendering the body text:** API notes say the body is "markdown-ish, with
attachment links" but the project's rule (`util/dom.js`) is that API free
text is rendered as plain text only, never raw HTML. Full markdown rendering
is out of scope here — instead: escape the body with the existing
`escapeHtml()`, preserve line breaks with CSS `white-space: pre-wrap`, and add
one small helper, `linkify(escapedText)` in `util/dom.js`, that
regex-replaces bare `http(s)://…` URLs in the *already-escaped* string with
`<a>` tags built from that same safe string (no re-parsing of user input as
HTML, so no injection risk). This covers "attachment links" without a
markdown parser. If richer formatting (bold, lists) turns out to matter after
seeing real announcement content, that's a follow-up, not blocking this pass.

**Read/unread:** `mapAnnouncement` already reads a `read` boolean off the API
response itself (server-computed) — no local "seen" tracking or write calls
needed. Render unread items with a small accent-colored dot (reuse the
existing accent-dot visual language from Heute's Änderungen card) and
slightly heavier text weight; no "mark as read" action in this pass (the
mark-read write route's CORS is explicitly unconfirmed per
`docs/api-notes.md`'s "Still open" section — not worth the risk for this).

**Wiring:**
- `public/js/app.js`: import `renderMitteilungen`, add
  `route(/^\/mehr\/mitteilungen$/, withShell(renderMitteilungen));`. Nested
  under `/mehr` (not a bare `/mitteilungen`) deliberately — `currentBasePath()`
  in `router.js` takes only the first path segment, so nesting is what keeps
  the "Mehr" tab highlighted while viewing this screen (same reason
  `/noten/:subjectId` is nested under `/noten`).
- `public/js/views/mehr.js`: replace the stub sentence's "Mitteilungen"
  mention with a real link/row to `#/mehr/mitteilungen` (styled like the
  existing `.card`), placed near the top since it's now real content, not a
  placeholder.

**Verify against the live API before/while building:** the exact field names
beyond `message` (does `title` exist? is the date field `created_at`?) were
not in `docs/api-notes.md` — `mapAnnouncement`'s `pick()` fallbacks are
defensive guesses. Quick check: `curl` the `announcements` route with a real
token (same pattern as the earlier grades-400 investigation) before
finalizing the card layout, and correct the mapper if a guessed field name is
wrong.

## Verification

`npm test` (unaffected, sanity check only). `npm run serve` + Playwright:
mock `/api/announcements` with a couple of read/unread items including a
bare URL in the body; verify the list renders, the link is clickable, unread
styling shows, and `#/mehr/mitteilungen` keeps the "Mehr" tab highlighted in
the bottom nav.

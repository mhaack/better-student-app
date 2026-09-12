# Plan: Stundenplan week navigation

## Context

`getStundenplanData()` (`public/js/data/stundenplan.js`) always resolves to
"this week, or next week once the weekend starts" with no way to look at any
other week. The original design intent ("swipe between weeks") was never
built.

## Implementation

**Changed: `public/js/data/stundenplan.js`**
`getStundenplanData()` becomes `getStundenplanData(weekOffset = 0)`. Keep
`resolveWeekStart(today)` exactly as-is (it's the "default" anchor: this week,
or next week once it's the weekend) and add `weekOffset * 7` days on top of
its result before building the 5 `dates`. Add `weekOffset` to the returned
object (the view needs it to know whether to show a "diese Woche" reset
link), and change `isNextWeek` (currently only true/false for the
auto-picked next-week case) to something like `isDefaultWeek: weekOffset ===
0` so the view can always tell "am I off the default" regardless of
direction.

**Changed: `public/js/views/stundenplan.js`**
Follow `views/noten.js`'s exact pattern (`loadAndRender(container, ...)`
that only replaces `#sp-body`, called once on mount and again on
interaction — see `noten.js`'s `#interval-picker` `change` handler for the
precedent). Concretely:
- Add `‹` / `›` buttons flanking the existing `#sp-subtitle` date range.
- A `weekOffset` variable closured inside `renderStundenplan` (resets to 0
  every fresh mount — the screen should always open on the current week,
  never remember a previous session's scroll position).
- Button clicks: `weekOffset += 1` / `-= 1`, call `loadAndRender` again
  (shows `renderSkeleton(6)` in `#sp-body` during the refetch, same as
  `noten.js` does).
- When `weekOffset !== 0`, show a small "Diese Woche" text link next to the
  subtitle that resets `weekOffset = 0` and reloads.
- No swipe/gesture handling — arrow buttons only, simplest robust option
  that still satisfies "navigate to other weeks."

No changes needed to `data/timetable.js` (`lessonsForDate` already takes an
arbitrary date) or to `_headers`/manifest.

## Verification

`npm test` (unaffected, sanity check only). `npm run serve` + Playwright:
mock timetable + substitution routes for two different weeks; click `›` and
confirm the grid and date-range subtitle update to next week's data; click
"Diese Woche" and confirm it returns to the original range.

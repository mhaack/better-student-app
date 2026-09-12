# Plan: Stundenplan week navigation

## Context

`getStundenplanData()` (`public/js/data/stundenplan.js`) always resolved to
"this week, or next week once the weekend starts" with no way to look at any
other week. The original design intent ("swipe between weeks") was never
built.

## Implementation (as built)

**Changed: `public/js/data/stundenplan.js`**
`getStundenplanData()` takes `weekOffset = 0`. `resolveWeekStart(today)`
stays as-is (it's the "default" anchor: this week, or next week once it's
the weekend); `weekOffset * 7` days are added on top of its result before
building the 5 `dates`. The returned object carries `weeksFromNow` — how
many whole weeks the shown week is ahead of the actual current calendar
week (0 even when `resolveWeekStart` already auto-jumped over a weekend),
so the view can phrase the "Änderungen …" line the same way regardless of
whether the shift came from the weekend default or manual navigation.

**Changed: `public/js/views/stundenplan.js`**
Follows `views/noten.js`'s `loadAndRender(container, ...)` pattern (called
once on mount, again on navigation, replacing only `#sp-body` and showing
`renderSkeleton(6)` during the refetch), with `loadAndRender` wrapped in
try/catch so week-navigation errors get the same `renderErrorState` as the
initial load.

- `weekOffset` is closured inside `renderStundenplan`, always starting at 0
  on a fresh mount.
- Forward-only, clamped to `[0, MAX_WEEK_OFFSET=3]` — 4 navigable weeks in
  total (this/next week through 3 weeks further out). Navigating below 0
  (into the actual past) is not possible.
- `‹`/`›` buttons flank `#sp-subtitle`, each disabled at its bound.
- Touch swipe on `#sp-body` (touchstart/touchend, threshold 50px, ignores
  gestures where the vertical delta dominates) drives the same `goToWeek`
  as the buttons — swipe left = forward, swipe right = back (also clamped
  at 0, so it re-visits already-reached weeks, never the past).
- No "Diese Woche" reset link — the `‹` button/back-swipe already returns
  to week 0 in at most 3 steps, and this build has no scenario where you'd
  need to skip straight back from week 3.
- No week-position indicator (dots, "Woche 2/4") — the date-range subtitle
  is considered sufficient.

**Added: `public/css/app.css`**
`.sp-week-nav` (flex row) and `.sp-week-nav-btn` (44px touch target,
`--text-secondary` / `--text-disabled` on `[disabled]`) ahead of the
existing Stundenplan grid rules.

No changes needed to `data/timetable.js` (`lessonsForDate` already takes an
arbitrary date) or to `_headers`/manifest.

## Verification

`npm test` (unaffected, sanity check only). `npm run serve` + Playwright:
mock timetable + substitution routes for several weeks; swipe/click `›`
repeatedly and confirm the grid, subtitle and "Änderungen …" label update
per week, that `›` disables at week 3, and that swiping/clicking back down
to week 0 disables `‹` and restores the original range.

# Plan: manual dark/light mode toggle (in Mehr)

## Context

`public/css/tokens.css` already fully implements a `[data-theme="dark"|"light"]`
override on top of `prefers-color-scheme` — built for exactly this, unused so
far. The app currently only ever follows the OS setting; there's no UI to
pick "always light" or "always dark" regardless of the device. This feature
is entirely about state + a small anti-flash script + the UI control — no
CSS changes needed.

## Implementation

**New: `public/js/state/theme.js`**
- `THEME_KEY = "schulblick.theme"`, values `"system" | "light" | "dark"`
  (default `"system"`), stored in `localStorage` (unlike the auth token, a
  theme preference isn't sensitive, so no session/local split needed —
  always `localStorage`, following the same key-naming convention as
  `state/auth-store.js`).
- `getThemePreference()` / `setThemePreference(value)`.
- `applyTheme(value)`: sets `document.documentElement.dataset.theme = value`
  for `"light"`/`"dark"`, or deletes the attribute for `"system"` (letting
  the `prefers-color-scheme` media query in tokens.css govern); also updates
  the `<meta name="theme-color">` tag's `content` so the browser's own
  chrome (status bar / address bar tint) matches. `setThemePreference` calls
  this after persisting.

**New: `public/theme-init.js`** (plain classic script, **not** an ES module —
modules always defer, defeating the purpose here)
Reads `localStorage["schulblick.theme"]` directly (the key is duplicated as a
literal constant with a comment pointing at `state/theme.js` to keep in
sync — a classic script can't `import` from an ES module) and immediately
sets `document.documentElement.dataset.theme` + the theme-color meta tag,
before any CSS paints. This has to run as a **render-blocking classic
`<script src="...">`** (no `defer`/`async`/`type="module"`) to execute before
first paint; `public/_headers`' CSP is `script-src 'self'` with no
`'unsafe-inline'`, so this must be an external same-origin file, not an
inline `<script>` block in `index.html`.

**Changed: `public/index.html`**
- Replace the current single static `<meta name="theme-color" content="#F6F3EE">`
  with `<meta name="theme-color" id="theme-color-meta" content="#F6F3EE">` —
  JS now owns updating it.
- Add `<script src="/theme-init.js"></script>` right after the
  charset/viewport meta tags, before the Google Fonts `<link>`s and the CSS
  `<link>`s, so it runs first.

**Changed: `public/js/views/mehr.js`**
Add a "Darstellung" section using a `<select>` styled with the existing
`.interval-picker` class (same pattern already used for the student
switcher in this file, and for the Halbjahr picker in `noten.js` — zero new
CSS needed) with options System/Hell/Dunkel, initialized from
`getThemePreference()`, calling `setThemePreference(e.target.value)` on
`change`. Takes effect immediately (CSS variables re-cascade the instant the
attribute changes) — no reload needed.

## Verification

No API mocking needed. `npm run serve`, load the page, switch the select to
"Dunkel", confirm `[data-theme="dark"]` took effect immediately; reload the
page and confirm it stays dark (came from `theme-init.js`, not a flash of
light-then-dark); switch to "System" and confirm it now tracks the OS/browser
color-scheme preference. Also run `npm test` — this feature doesn't touch
grade/trend logic, so it's just a sanity check nothing broke incidentally.

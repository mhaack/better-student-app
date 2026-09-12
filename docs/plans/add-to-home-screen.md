# Plan: Add to Home Screen

## Context

The manifest/icons/service worker already make the app technically
installable (confirmed: `display: standalone`, 192/512px icons incl.
maskable, `sw.js` registered), but there's no explicit affordance for it, and
iOS Safari never shows a native install prompt at all — those users need to
be told the manual steps.

## Implementation

**New: `public/js/state/install.js`**
- At module load (side-effect, so it must be imported early/unconditionally
  from `app.js`, not lazily from the Mehr view): attach a
  `window.addEventListener("beforeinstallprompt", ...)` that calls
  `event.preventDefault()` and stores the event in a module-level variable.
  This has to be attached from app boot, not from Mehr's view — if the event
  fires before anything is listening, it's gone for that page session.
- `canInstall()` → `true` if a `beforeinstallprompt` event is currently
  stored.
- `promptInstall()` → calls the stored event's `.prompt()`, awaits
  `.userChoice`, then clears the stored event (each event is single-use).
- `isStandalone()` → `window.matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true` (the second half is Safari's
  iOS-specific property).
- `isIos()` → user-agent sniff (`/iPad|iPhone|iPod/.test(navigator.userAgent)`),
  needed because iOS Safari never fires `beforeinstallprompt` — those users
  need manual instructions instead of a button.

**Changed: `public/js/app.js`**
Add `import "./state/install.js";` near the top (a side-effect import, purely
to register the listener at boot — nothing is destructured from it here).

**Changed: `public/js/views/mehr.js`**
Add an "App installieren" section, branching at render time:
- `isStandalone()` → already installed; show a short confirmation line, no
  button (self-corrects next visit after a fresh install, since
  `matchMedia('display-mode: standalone')` updates once the app actually
  runs standalone).
- else `canInstall()` → a button ("Zum Home-Bildschirm hinzufügen") calling
  `promptInstall()` (reuse `.button-primary`).
- else `isIos()` → a short static instruction card (share-icon → "Zum
  Home-Bildschirm"), since there's no programmatic install path on iOS.
- else (desktop browser without install support, e.g. Firefox) → render
  nothing; no dead-end UI for a capability that doesn't exist there.

No manifest/service-worker/icon changes needed — those are already correct
for installability (confirmed while renaming the app/favicon earlier:
192px/512px PNGs incl. maskable, `display: standalone`, `sw.js` registered).

## Verification

`npm test` (unaffected, sanity check only). `beforeinstallprompt` isn't
dispatchable from a real Chromium session under Playwright the way a browser
triggers it natively, so this one is mostly verified by (a) confirming
`isIos()` + `isStandalone()` branch correctly via UA/`matchMedia` overrides in
a test page, and (b) a manual check on an actual Android Chrome / iOS Safari
device before considering it done — flagging this now so it's not a surprise
later.

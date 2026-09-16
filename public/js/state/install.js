// "Add to home screen" support.
//
// The listener below is registered as a side effect at import time, from
// app.js — deliberately not from the Mehr view. Chromium fires
// `beforeinstallprompt` once, early; if nothing is listening at that moment
// the event is simply gone for the rest of the page session and the install
// button could never appear.

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  // Stops Chromium's own mini-infobar so the prompt happens where the user
  // asked for it, in Mehr, instead of interrupting them mid-screen.
  event.preventDefault();
  deferredPrompt = event;
});

// After a successful install the stored event is spent and the browser will
// not hand out another one.
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
});

/** True when the browser has offered an install prompt we can still show. */
export function canInstall() {
  return deferredPrompt !== null;
}

/**
 * Shows the native install prompt. Each event is single-use, so it's cleared
 * whether the user accepts or dismisses.
 * @returns {Promise<"accepted"|"dismissed"|"unavailable">}
 */
export async function promptInstall() {
  if (!deferredPrompt) return "unavailable";
  const event = deferredPrompt;
  deferredPrompt = null;
  event.prompt();
  const choice = await event.userChoice;
  return choice?.outcome === "accepted" ? "accepted" : "dismissed";
}

/** Already running as an installed app rather than in a browser tab. */
export function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // Safari on iOS doesn't implement the display-mode query and uses this instead.
    window.navigator.standalone === true
  );
}

/**
 * iOS Safari never fires `beforeinstallprompt` — there is no programmatic
 * install path at all, so those users get written instructions instead of a
 * button. UA sniffing is the only signal available here.
 */
export function isIos() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

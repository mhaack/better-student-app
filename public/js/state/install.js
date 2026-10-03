// "Add to home screen" support. Imported from app.js, not the Mehr view:
// Chromium fires `beforeinstallprompt` once, early, and a late listener
// misses it.

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  // No mini-infobar; the prompt is offered in Mehr.
  event.preventDefault();
  deferredPrompt = event;
});

// Spent after an install.
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
});

/** True when the browser has offered an install prompt we can still show. */
export function canInstall() {
  return deferredPrompt !== null;
}

/**
 * Shows the native install prompt; the event is single-use.
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
    // iOS Safari.
    window.navigator.standalone === true
  );
}

/** iOS has no install prompt, so it gets instructions; UA sniffing is all there is. */
export function isIos() {
  return /iPad|iPhone|iPod/.test(window.navigator.userAgent);
}

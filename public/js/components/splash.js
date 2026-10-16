// The intro animation lives in index.html and app.css, so it paints before
// this module loads and fades itself out without it. This only removes the
// finished node and lets a tap cut it short.
export function initSplash() {
  const splash = document.getElementById("splash");
  if (!splash) return;
  // theme-init.js only turns it on when signed in.
  const skipped = document.documentElement.dataset.splash !== "on";
  // On a slow load the CSS fade can finish before this runs, and animationend never comes.
  const finished = getComputedStyle(splash).visibility === "hidden";
  if (skipped || finished || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    splash.remove();
    return;
  }
  splash.addEventListener("animationend", (event) => {
    if (event.target === splash) splash.remove();
  });
  splash.addEventListener("click", () => splash.classList.add("is-skipping"), { once: true });
}

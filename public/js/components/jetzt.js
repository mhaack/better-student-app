// Pieces of the "Jetzt" display shared by Heute and the Stundenplan.

/** A progress bar for the running lesson; `className` sets its look. */
export function progressBar(progress, className, label) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return `<span class="${className}" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>`;
}

/**
 * Calls `onTick` at every full minute and when the page becomes visible again,
 * until `node` leaves the document (the view was replaced).
 */
export function everyMinute(node, onTick) {
  let timer;
  function schedule() {
    clearTimeout(timer);
    const now = new Date();
    // Just past the minute, so the clock has turned when onTick reads it.
    timer = setTimeout(tick, (60 - now.getSeconds()) * 1000 - now.getMilliseconds() + 50);
  }
  function stop() {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  }
  function tick() {
    if (!node.isConnected) return stop();
    onTick();
    schedule();
  }
  function onVisible() {
    if (document.visibilityState === "visible") tick();
  }
  document.addEventListener("visibilitychange", onVisible);
  schedule();
}

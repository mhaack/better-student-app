// The "Jetzt" display: the running lesson, or the next one in a break.

/** "9:45" or "09:45" → minutes since midnight; null if missing. */
function toMinutes(hm) {
  const [h, m] = String(hm ?? "").split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * What to show for `now` on a school day's lessons ({ period, status, from, to }):
 * - `{ kind: "off" }` before the first or from the end of the last held lesson;
 * - `{ kind: "lesson", period, from, to, progress, restMin, past }` during one;
 * - `{ kind: "gap", period, from, inMin, free, past }` before the next one,
 *   `free` when a cancelled lesson lies in between.
 * `past` lists the periods (cancelled ones too) that have ended.
 */
export function jetztState(now, lessons) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const timed = lessons
    .map((l) => ({ ...l, start: toMinutes(l.from), end: toMinutes(l.to) }))
    .filter((l) => l.start !== null && l.end !== null)
    .sort((a, b) => a.start - b.start);
  const held = timed.filter((l) => l.status !== "cancelled");
  if (!held.length || nowMin < held[0].start || nowMin >= held.at(-1).end) return { kind: "off" };

  const past = timed.filter((l) => l.end <= nowMin).map((l) => l.period);
  const current = held.find((l) => nowMin >= l.start && nowMin < l.end);
  if (current) {
    return {
      kind: "lesson",
      period: current.period,
      from: current.from,
      to: current.to,
      progress: (nowMin - current.start) / (current.end - current.start),
      restMin: current.end - nowMin,
      past,
    };
  }

  const next = held.find((l) => l.start > nowMin);
  const free = timed.some((l) => l.status === "cancelled" && l.end > nowMin && l.start < next.start);
  return { kind: "gap", period: next.period, from: next.from, inMin: next.start - nowMin, free, past };
}

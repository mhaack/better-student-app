// Turns a series of grade values into SVG polyline points for the mini-trend
// (Noten list) and the larger Fach-Detail trend chart.
//
// Design requirement (docs/plan.md, chat1.md): a trend line must only ever
// show *direction*, and "up" must mean "better" on both scales even though
// grade_1_6 (1 best) and points_0_15 (15 best) run in opposite directions.
// Callers pass `betterIsHigher` so this module can flip the y-axis instead of
// baking scale assumptions into chart code.

/**
 * @param {number[]} values chronological, oldest first
 * @param {{ width: number, height: number, betterIsHigher: boolean, min?: number, max?: number, padding?: number }} options
 * @returns {string} SVG polyline "points" attribute value
 */
export function toTrendPoints(values, options) {
  const { width, height, betterIsHigher, padding = height * 0.15 } = options;
  if (values.length === 0) return "";

  const min = options.min ?? Math.min(...values);
  const max = options.max ?? Math.max(...values);
  const range = max - min || 1;

  const usableHeight = height - padding * 2;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = values.length > 1 ? index * stepX : width / 2;
      const normalized = (value - min) / range; // 0..1, 1 = max raw value
      const betterness = betterIsHigher ? normalized : 1 - normalized; // 1 = best
      const y = padding + (1 - betterness) * usableHeight;
      return `${round(x)},${round(y)}`;
    })
    .join(" ");
}

function round(n) {
  return Math.round(n * 10) / 10;
}

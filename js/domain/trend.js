// Turns a series of grade values into SVG polyline points for the mini-trend
// (Noten list) and the larger Fach-Detail trend chart.
//
// Design requirement (docs/plan.md, chat1.md): a trend line must only ever
// show *direction*, and "up" must mean "better" on both scales even though
// grade_1_6 (1 best) and points_0_15 (15 best) run in opposite directions.
// Callers pass `betterIsHigher` so this module can flip the y-axis instead of
// baking scale assumptions into chart code.

/**
 * Width of the mini trend line in the Noten list: the Oberstufe list is
 * denser than the Noten 1-6 one (design 2a, B1 vs B2). Shared so the SVG the
 * view draws and the points the data layer computes can't drift apart.
 */
export const MINI_TREND_WIDTH = { grade_1_6: 84, points_0_15: 76 };

/** The absolute bounds of each grading scale, for axis-bearing charts. */
export const SCALE_BOUNDS = {
  grade_1_6: { min: 1, max: 6 },
  points_0_15: { min: 0, max: 15 },
};

/**
 * Pass `min`/`max` to plot against the absolute scale (0-15 or 1-6). Leave
 * them out only where the chart shows direction alone and carries no axis —
 * otherwise the axis labels would describe a range the line doesn't use.
 *
 * @param {number[]} values chronological, oldest first
 * @param {{ width: number, height: number, betterIsHigher: boolean, min?: number, max?: number, padding?: number, insetX?: number }} options
 * @returns {string} SVG polyline "points" attribute value
 */
export function toTrendPoints(values, options) {
  const { width, height, betterIsHigher, padding = height * 0.15, insetX = 0 } = options;
  if (values.length === 0) return "";

  const min = options.min ?? Math.min(...values);
  const max = options.max ?? Math.max(...values);
  const range = max - min || 1;

  const usableHeight = height - padding * 2;
  const usableWidth = width - insetX * 2;
  const stepX = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  return values
    .map((value, index) => {
      const x = values.length > 1 ? insetX + index * stepX : width / 2;
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

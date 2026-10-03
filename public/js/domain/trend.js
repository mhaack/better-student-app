// Grade values → SVG polyline points for the trend charts. "Up" means
// "better" on both scales; callers pass `betterIsHigher` to flip the y-axis.

/** Mini trend width per scale, shared by the view's SVG and the data layer. */
export const MINI_TREND_WIDTH = { grade_1_6: 84, points_0_15: 76 };

/** The absolute bounds of each grading scale, for axis-bearing charts. */
export const SCALE_BOUNDS = {
  grade_1_6: { min: 1, max: 6 },
  points_0_15: { min: 0, max: 15 },
};

/**
 * Pass `min`/`max` for charts with an axis; omit them for direction only.
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

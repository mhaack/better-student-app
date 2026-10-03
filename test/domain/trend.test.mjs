// Trend line geometry: "up" means better on both scales.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { toTrendPoints, SCALE_BOUNDS } from "../../public/js/domain/trend.js";

describe("toTrendPoints", () => {
  test("absolute bounds put 15 P at the top and 0 P at the bottom", () => {
    const points = toTrendPoints([15, 0], {
      width: 100,
      height: 60,
      betterIsHigher: true,
      ...SCALE_BOUNDS.points_0_15,
      padding: 0,
    });
    assert.equal(points, "0,0 100,60");
  });

  test("on the 1-6 scale a 1 is at the top", () => {
    const points = toTrendPoints([1, 6], {
      width: 100,
      height: 60,
      betterIsHigher: false,
      ...SCALE_BOUNDS.grade_1_6,
      padding: 0,
    });
    assert.equal(points, "0,0 100,60");
  });

  test("mid-range values stay mid-chart instead of filling it", () => {
    const points = toTrendPoints([8, 9], {
      width: 100,
      height: 60,
      betterIsHigher: true,
      ...SCALE_BOUNDS.points_0_15,
      padding: 0,
    });
    // Both values sit in the upper-middle band; neither touches an edge.
    const ys = points.split(" ").map((p) => Number(p.split(",")[1]));
    assert.ok(ys.every((y) => y > 0 && y < 60), `expected interior ys, got ${ys}`);
    assert.ok(ys[1] < ys[0], "9 P must sit above 8 P");
  });

  test("insetX keeps end markers off the edges", () => {
    const points = toTrendPoints([1, 2], { width: 100, height: 60, betterIsHigher: true, insetX: 12 });
    assert.equal(points.split(" ")[0].split(",")[0], "12");
    assert.equal(points.split(" ")[1].split(",")[0], "88");
  });
});

// Plain-Node sanity tests for js/domain/grades.js (no test framework, no
// build step — matches the rest of this project).
import assert from "node:assert/strict";
import { toTrendPoints, SCALE_BOUNDS } from "../js/domain/trend.js";
import {
  parseGrade,
  isUnterkurs,
  pointsToGradeLabel,
  evaluateCalculationRule,
  subjectAverage,
} from "../js/domain/grades.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test("parseGrade: Sek I plain grade", () => {
  assert.equal(parseGrade("2", "grade_1_6").numeric, 2);
});

test("parseGrade: Sek I plus/minus modifiers", () => {
  assert.equal(parseGrade("2+", "grade_1_6").numeric, 1.75);
  assert.equal(parseGrade("2-", "grade_1_6").numeric, 2.25);
});

test("parseGrade: Sek I decimal comma", () => {
  assert.equal(parseGrade("1,5", "grade_1_6").numeric, 1.5);
});

test("parseGrade: Oberstufe points", () => {
  assert.equal(parseGrade("12", "points_0_15").numeric, 12);
  assert.equal(parseGrade("12 P", "points_0_15").numeric, 12);
});

test("parseGrade: out-of-range points rejected", () => {
  assert.equal(parseGrade("17", "points_0_15").numeric, null);
});

test("parseGrade: same raw value on both scales does not cross-contaminate", () => {
  assert.equal(parseGrade("3", "grade_1_6").numeric, 3);
  assert.equal(parseGrade("3", "points_0_15").numeric, 3);
});

test("isUnterkurs: below 5 points", () => {
  assert.equal(isUnterkurs(4), true);
  assert.equal(isUnterkurs(5), false);
});

test("pointsToGradeLabel: matches the design's 12 P ~= 2+ example", () => {
  assert.equal(pointsToGradeLabel(12), "2+");
});

test("pointsToGradeLabel: boundary values", () => {
  assert.equal(pointsToGradeLabel(15), "1+");
  assert.equal(pointsToGradeLabel(14), "1");
  assert.equal(pointsToGradeLabel(13), "1-");
  assert.equal(pointsToGradeLabel(0), "6");
});

test("evaluateCalculationRule: basic arithmetic with variables", () => {
  const value = evaluateCalculationRule("(Ka_sum / Ka_count + So_sum / So_count) / 2", {
    Ka_sum: 3.3,
    Ka_count: 2,
    So_sum: 2.7,
    So_count: 2,
  });
  assert.ok(Math.abs(value - 1.5) < 1e-9, `expected ~1.5, got ${value}`);
});

test("evaluateCalculationRule: rejects unknown variables instead of throwing a JS error type mismatch", () => {
  assert.throws(() => evaluateCalculationRule("Foo_sum + 1", {}), /Unknown variable/);
});

test("evaluateCalculationRule: does not eval arbitrary JS", () => {
  assert.throws(() => evaluateCalculationRule("require('fs')", {}));
});

test("subjectAverage: falls back to weighted mean and labels it estimated", () => {
  const grades = [
    { numeric: 2, scale: "grade_1_6", collection: { type: "KA", weighting: 2 } },
    { numeric: 1, scale: "grade_1_6", collection: { type: "So", weighting: 1 } },
  ];
  const result = subjectAverage(grades, null, "grade_1_6");
  assert.equal(result.source, "estimated");
  assert.ok(Math.abs(result.value - 1.6667) < 1e-3, `expected ~1.6667, got ${result.value}`);
});

test("subjectAverage: uses api_value when the school provides a student-level final grade", () => {
  const result = subjectAverage([], { calculation_for: "student", value: 1.8 }, "grade_1_6");
  assert.equal(result.source, "api_value");
  assert.equal(result.value, 1.8);
});

test("subjectAverage: never mixes scales into one average", () => {
  const grades = [
    { numeric: 2, scale: "grade_1_6", collection: { type: "KA", weighting: 1 } },
    { numeric: 12, scale: "points_0_15", collection: { type: "Klausur", weighting: 1 } },
  ];
  const result = subjectAverage(grades, null, "grade_1_6");
  assert.equal(result.value, 2); // the points_0_15 grade must be excluded, not blended in
});

test("subjectAverage: flags Unterkurs on the Oberstufe scale", () => {
  const result = subjectAverage(
    [{ numeric: 4, scale: "points_0_15", collection: { type: "Klausur", weighting: 1 } }],
    null,
    "points_0_15"
  );
  assert.equal(result.unterkurs, true);
});

test("toTrendPoints: absolute bounds put 15 P at the top and 0 P at the bottom", () => {
  const points = toTrendPoints([15, 0], {
    width: 100,
    height: 60,
    betterIsHigher: true,
    ...SCALE_BOUNDS.points_0_15,
    padding: 0,
  });
  assert.equal(points, "0,0 100,60");
});

test("toTrendPoints: on the 1-6 scale a 1 is at the top", () => {
  const points = toTrendPoints([1, 6], {
    width: 100,
    height: 60,
    betterIsHigher: false,
    ...SCALE_BOUNDS.grade_1_6,
    padding: 0,
  });
  assert.equal(points, "0,0 100,60");
});

test("toTrendPoints: mid-range values stay mid-chart instead of filling it", () => {
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

test("toTrendPoints: insetX keeps end markers off the edges", () => {
  const points = toTrendPoints([1, 2], { width: 100, height: 60, betterIsHigher: true, insetX: 12 });
  assert.equal(points.split(" ")[0].split(",")[0], "12");
  assert.equal(points.split(" ")[1].split(",")[0], "88");
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) {
  console.error("Some tests failed.");
}

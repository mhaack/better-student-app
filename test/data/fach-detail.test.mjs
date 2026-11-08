// Grouping a subject's grades by type on the Fach detail page.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { groupByType } from "../../public/js/data/fach-detail.js";

function grade(type, numeric, givenAt, weighting = 1) {
  return { numeric, givenAt, collection: { type, weighting, name: `${type} ${givenAt}` } };
}

describe("groupByType", () => {
  test("merges each teacher's spelling into one group", () => {
    const groups = groupByType([grade("SO", 12, "2026-09-11"), grade("so", 14, "2026-09-23")]);
    assert.deepEqual(
      groups.map((g) => [g.type, g.grades.length]),
      [["Sonstige", 2]]
    );
  });

  test("puts Klausur first even when another type weighs more", () => {
    const groups = groupByType([
      grade("So", 13, "2026-09-11"),
      grade("So", 14, "2026-09-23"),
      grade("LK", 11, "2026-09-26"),
      grade("K", 13, "2026-10-09"),
    ]);
    assert.deepEqual(
      groups.map((g) => g.type),
      ["Klausur", "Sonstige", "Leistungskontrolle"]
    );
  });

  test("orders the other types by weighting share", () => {
    const groups = groupByType([
      grade("LK", 11, "2026-09-26"),
      grade("SO", 12, "2026-09-11"),
      grade("SO", 10, "2026-10-01"),
    ]);
    assert.deepEqual(
      groups.map((g) => [g.type, g.weightingPct]),
      [
        ["Sonstige", 67],
        ["Leistungskontrolle", 33],
      ]
    );
  });

  test("lists a group's grades newest first", () => {
    const [group] = groupByType([grade("KL", 10, "2026-09-15"), grade("Klausur", 8, "2026-11-03")]);
    assert.deepEqual(
      group.grades.map((g) => g.givenAt),
      ["2026-11-03", "2026-09-15"]
    );
  });
});

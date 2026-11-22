// Grade distribution for the Noten charts: whole Notes, points, KA vs. Sonstige.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gradeDistribution, gradeKind, pointsToNote, wholeNote } from "../../public/js/domain/grade-distribution.js";

// The design's sample Halbjahre (subject ids invented).
const SEK1 = [
  { subjectId: 1, ka: [1, 3], sl: [1, 2, 2, 4] }, // Mathematik
  { subjectId: 2, ka: [2], sl: [1, 2, 3] }, // Englisch
  { subjectId: 3, ka: [2, 4], sl: [1, 2, 3] },
  { subjectId: 4, ka: [1, 3], sl: [2, 3, 5] },
  { subjectId: 5, ka: [2], sl: [1, 2, 4] },
  { subjectId: 6, ka: [], sl: [1, 3] },
  { subjectId: 7, ka: [], sl: [2] },
  { subjectId: 8, ka: [], sl: [] },
];
const OBER = [
  { subjectId: 1, ka: [13, 11, 9], sl: [15, 13, 12, 11, 10] },
  { subjectId: 2, ka: [14, 12], sl: [14, 13, 12, 9] },
  { subjectId: 3, ka: [13, 10], sl: [14, 12, 11, 8] },
  { subjectId: 4, ka: [11, 7], sl: [13, 10, 6, 4] },
  { subjectId: 5, ka: [], sl: [] },
];

const toEntries = (subjects) =>
  subjects.flatMap(({ subjectId, ka, sl }) => [
    ...ka.map((value) => ({ subjectId, value, kind: "ka" })),
    ...sl.map((value) => ({ subjectId, value, kind: "sl" })),
  ]);

describe("pointsToNote", () => {
  test("maps each band of three points to one Note and 0 points to a 6", () => {
    const expected = { 15: 1, 13: 1, 12: 2, 10: 2, 9: 3, 7: 3, 6: 4, 4: 4, 3: 5, 1: 5, 0: 6 };
    for (const [points, note] of Object.entries(expected)) {
      assert.equal(pointsToNote(Number(points)), note, `${points} P`);
    }
  });
});

describe("wholeNote", () => {
  test("counts a tendency as its whole Note", () => {
    assert.equal(wholeNote(1.75), 2);
    assert.equal(wholeNote(2.25), 2);
    assert.equal(wholeNote(3), 3);
  });

  test("rounds a decimal Note to the nearest whole Note", () => {
    assert.equal(wholeNote(2.4), 2);
    assert.equal(wholeNote(2.6), 3);
  });

  test("stays within 1 to 6", () => {
    assert.equal(wholeNote(0.75), 1);
    assert.equal(wholeNote(6.25), 6);
  });
});

describe("gradeKind", () => {
  test("puts Klausuren and Klassenarbeiten in the KA series", () => {
    for (const type of ["K", "KL", "Klausur", "KA", "Klassenarbeit", " ka "]) {
      assert.equal(gradeKind(type), "ka", type);
    }
  });

  test("counts Leistungskontrollen, Sonstige and unknown codes as Sonstige", () => {
    for (const type of ["LK", "SO", "SN", "Sonstige", "Referat", "", undefined]) {
      assert.equal(gradeKind(type), "sl", type);
    }
  });
});

describe("gradeDistribution", () => {
  test("counts the Sek I sample as 27 Noten", () => {
    const dist = gradeDistribution(toEntries(SEK1), { scale: "grade_1_6", unit: "notes" });
    assert.equal(dist.unit, "notes");
    assert.equal(dist.count, 27);
    assert.deepEqual(
      dist.buckets.map((b) => b.label),
      ["1", "2", "3", "4", "5", "6"]
    );
    assert.deepEqual(
      dist.buckets.map((b) => [b.ka, b.sl]),
      [
        [2, 5],
        [3, 7],
        [2, 4],
        [1, 2],
        [0, 1],
        [0, 0],
      ]
    );
  });

  test("gives Mathematik and Englisch alone 10 Noten", () => {
    const entries = toEntries(SEK1).filter((e) => e.subjectId === 1 || e.subjectId === 2);
    const dist = gradeDistribution(entries, { scale: "grade_1_6", unit: "notes" });
    assert.equal(dist.count, 10);
  });

  test("buckets the Oberstufe sample by points from 15 down to 0", () => {
    const dist = gradeDistribution(toEntries(OBER), { scale: "points_0_15", unit: "points" });
    assert.equal(dist.count, 26);
    assert.equal(dist.buckets.length, 16);
    assert.equal(dist.buckets[0].label, "15");
    assert.equal(dist.buckets.at(-1).label, "0");
    const thirteen = dist.buckets.find((b) => b.value === 13);
    assert.deepEqual([thirteen.ka, thirteen.sl, thirteen.total], [2, 3, 5]);
  });

  test("converts Oberstufe points to Noten", () => {
    const dist = gradeDistribution(toEntries(OBER), { scale: "points_0_15", unit: "notes" });
    assert.equal(dist.count, 26);
    assert.deepEqual(
      dist.buckets.map((b) => b.total),
      [9, 11, 4, 2, 0, 0]
    );
  });

  test("has empty buckets without grades", () => {
    const dist = gradeDistribution([], { scale: "grade_1_6", unit: "notes" });
    assert.equal(dist.count, 0);
    assert.ok(dist.buckets.every((b) => b.total === 0));
  });
});

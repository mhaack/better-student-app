// Grade parsing, labels and averages on both scales.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  parseGrade,
  isUnterkurs,
  pointsToGradeLabel,
  gradeTypeLabel,
  markNewGrades,
  evaluateCalculationRule,
  gradeWeights,
  subjectAverage,
} from "../../public/js/domain/grades.js";

describe("parseGrade", () => {
  test("Sek I plain grade", () => {
    assert.equal(parseGrade("2", "grade_1_6").numeric, 2);
  });

  test("Sek I plus/minus modifiers", () => {
    assert.equal(parseGrade("2+", "grade_1_6").numeric, 1.75);
    assert.equal(parseGrade("2-", "grade_1_6").numeric, 2.25);
  });

  test("Sek I decimal comma", () => {
    assert.equal(parseGrade("1,5", "grade_1_6").numeric, 1.5);
  });

  test("Oberstufe points", () => {
    assert.equal(parseGrade("12", "points_0_15").numeric, 12);
    assert.equal(parseGrade("12 P", "points_0_15").numeric, 12);
  });

  test("out-of-range points rejected", () => {
    assert.equal(parseGrade("17", "points_0_15").numeric, null);
  });

  test("same raw value on both scales does not cross-contaminate", () => {
    assert.equal(parseGrade("3", "grade_1_6").numeric, 3);
    assert.equal(parseGrade("3", "points_0_15").numeric, 3);
  });
});

describe("isUnterkurs", () => {
  test("below 5 points", () => {
    assert.equal(isUnterkurs(4), true);
    assert.equal(isUnterkurs(5), false);
  });
});

describe("pointsToGradeLabel", () => {
  test("matches the design's 12 P ~= 2+ example", () => {
    assert.equal(pointsToGradeLabel(12), "2+");
  });

  test("boundary values", () => {
    assert.equal(pointsToGradeLabel(15), "1+");
    assert.equal(pointsToGradeLabel(14), "1");
    assert.equal(pointsToGradeLabel(13), "1-");
    assert.equal(pointsToGradeLabel(0), "6");
  });
});

describe("gradeTypeLabel", () => {
  test("maps each teacher's spelling of Sonstige to one label", () => {
    for (const raw of ["SO", "So", "so", "Sonstige", "SN"]) {
      assert.equal(gradeTypeLabel(raw), "Sonstige", raw);
    }
  });

  test("reads LK as Leistungskontrolle, not Leistungskurs", () => {
    assert.equal(gradeTypeLabel("LK"), "Leistungskontrolle");
    assert.equal(gradeTypeLabel("Lk"), "Leistungskontrolle");
  });

  test("maps K, KL and Klausur to Klausur", () => {
    for (const raw of ["K", "KL", "Klausur"]) {
      assert.equal(gradeTypeLabel(raw), "Klausur", raw);
    }
  });

  test("maps KA and Klassenarbeit to Klassenarbeit", () => {
    for (const raw of ["KA", "ka", "Klassenarbeit"]) {
      assert.equal(gradeTypeLabel(raw), "Klassenarbeit", raw);
    }
  });

  test("ignores surrounding whitespace", () => {
    assert.equal(gradeTypeLabel(" so "), "Sonstige");
  });

  test("keeps an unknown code as the teacher typed it", () => {
    assert.equal(gradeTypeLabel("Referat"), "Referat");
  });

  test("falls back to Sonstige for a missing type", () => {
    assert.equal(gradeTypeLabel(undefined), "Sonstige");
    assert.equal(gradeTypeLabel(""), "Sonstige");
  });
});

describe("markNewGrades", () => {
  const unread = { id: 1, read: false, readByGuardian: false };
  const readByChild = { id: 2, read: true, readByGuardian: false };
  const readByParent = { id: 3, read: true, readByGuardian: true };
  const flags = (role) => markNewGrades([unread, readByChild, readByParent], role).map((g) => g.isNew);

  test("for a guardian, a grade stays new until a guardian has read it", () => {
    assert.deepEqual(flags("guardian"), [true, true, false]);
  });

  test("for a student, a grade read by anyone is no longer new", () => {
    assert.deepEqual(flags("student"), [true, false, false]);
  });

  test("with an unknown role, any read counts", () => {
    assert.deepEqual(flags(null), [true, false, false]);
  });

  test("marks an unseen grade with a previous value as changed", () => {
    const previous = { raw: "3", numeric: 3 };
    const [marked] = markNewGrades([{ ...unread, previous }, unread], "guardian");
    assert.equal(marked.isChanged, true);
    assert.equal(markNewGrades([unread], "guardian")[0].isChanged, false);
  });

  test("a seen changed grade is not changed", () => {
    const [marked] = markNewGrades([{ ...readByParent, previous: { raw: "3", numeric: 3 } }], "guardian");
    assert.equal(marked.isChanged, false);
  });

  test("a student-read grade is still changed for a guardian", () => {
    const [marked] = markNewGrades([{ ...readByChild, previous: { raw: "3", numeric: 3 } }], "guardian");
    assert.equal(marked.isChanged, true);
  });

  test("keeps the grade's own fields", () => {
    const [marked] = markNewGrades([{ ...unread, raw: "1-" }], "guardian");
    assert.equal(marked.raw, "1-");
    assert.equal(marked.id, 1);
  });
});

describe("evaluateCalculationRule", () => {
  test("basic arithmetic with variables", () => {
    const value = evaluateCalculationRule("(Ka_sum / Ka_count + So_sum / So_count) / 2", {
      Ka_sum: 3.3,
      Ka_count: 2,
      So_sum: 2.7,
      So_count: 2,
    });
    assert.ok(Math.abs(value - 1.5) < 1e-9, `expected ~1.5, got ${value}`);
  });

  test("rejects unknown variables instead of throwing a JS error type mismatch", () => {
    assert.throws(() => evaluateCalculationRule("Foo_sum + 1", {}), /Unknown variable/);
  });

  test("does not eval arbitrary JS", () => {
    assert.throws(() => evaluateCalculationRule("require('fs')", {}));
  });
});

describe("gradeWeights", () => {
  const g = (type, weighting = 1) => ({ collection: { type, weighting } });

  test("splits Oberstufe weight half Klausuren, half the rest", () => {
    assert.deepEqual(gradeWeights([g("K"), g("SO"), g("SO")], "points_0_15"), [0.5, 0.25, 0.25]);
  });

  test("keeps the API weighting in Sek I", () => {
    assert.deepEqual(gradeWeights([g("KA", 2), g("SO")], "grade_1_6"), [2, 1]);
  });

  test("keeps the API weighting without a Klausur", () => {
    assert.deepEqual(gradeWeights([g("SO"), g("LK")], "points_0_15"), [1, 1]);
  });
});

describe("subjectAverage", () => {
  test("falls back to weighted mean and labels it estimated", () => {
    const grades = [
      { numeric: 2, scale: "grade_1_6", collection: { type: "KA", weighting: 2 } },
      { numeric: 1, scale: "grade_1_6", collection: { type: "So", weighting: 1 } },
    ];
    const result = subjectAverage(grades, null, "grade_1_6");
    assert.equal(result.source, "estimated");
    assert.ok(Math.abs(result.value - 1.6667) < 1e-3, `expected ~1.6667, got ${result.value}`);
  });

  test("counts the Klausuren half of an Oberstufe estimate, however few they are", () => {
    // Biologie LK: Klausur Cytologie 13 P, then 13, 14, 13 P Sonstige.
    const grades = [
      { numeric: 13, scale: "points_0_15", collection: { type: "K", weighting: 1 } },
      { numeric: 13, scale: "points_0_15", collection: { type: "SO", weighting: 1 } },
      { numeric: 14, scale: "points_0_15", collection: { type: "So", weighting: 1 } },
      { numeric: 13, scale: "points_0_15", collection: { type: "LK", weighting: 1 } },
    ];
    const result = subjectAverage(grades, null, "points_0_15");
    assert.ok(Math.abs(result.value - 13.1667) < 1e-3, `expected ~13.1667, got ${result.value}`);
  });

  test("uses the plain mean in the Oberstufe until there is a Klausur and another grade", () => {
    const grades = [
      { numeric: 9, scale: "points_0_15", collection: { type: "SO", weighting: 1 } },
      { numeric: 12, scale: "points_0_15", collection: { type: "SO", weighting: 1 } },
    ];
    assert.equal(subjectAverage(grades, null, "points_0_15").value, 10.5);
  });

  test("uses api_value when the school provides a student-level final grade", () => {
    const result = subjectAverage([], { calculation_for: "student", value: 1.8 }, "grade_1_6");
    assert.equal(result.source, "api_value");
    assert.equal(result.value, 1.8);
  });

  test("never mixes scales into one average", () => {
    const grades = [
      { numeric: 2, scale: "grade_1_6", collection: { type: "KA", weighting: 1 } },
      { numeric: 12, scale: "points_0_15", collection: { type: "Klausur", weighting: 1 } },
    ];
    const result = subjectAverage(grades, null, "grade_1_6");
    assert.equal(result.value, 2); // the points_0_15 grade must be excluded, not blended in
  });

  test("flags Unterkurs on the Oberstufe scale", () => {
    const result = subjectAverage(
      [{ numeric: 4, scale: "points_0_15", collection: { type: "Klausur", weighting: 1 } }],
      null,
      "points_0_15"
    );
    assert.equal(result.unterkurs, true);
  });
});

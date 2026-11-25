import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  applyButtonState,
  initialDraft,
  resolveDraft,
  selectableIds,
  subjectFilterLabel,
} from "../../public/js/components/subject-filter-sheet.js";

const SUBJECTS = [
  { subjectId: 1, name: "Mathematik", count: 6 },
  { subjectId: 2, name: "Englisch", count: 4 },
  { subjectId: 3, name: "Deutsch", count: 5 },
  { subjectId: 4, name: "Geschichte", count: 0 },
];

describe("subjectFilterLabel", () => {
  test("reads Alle Fächer without a filter", () => {
    assert.equal(subjectFilterLabel(null, SUBJECTS), "Alle Fächer");
  });

  test("names one subject", () => {
    assert.equal(subjectFilterLabel(new Set([3]), SUBJECTS), "Deutsch");
  });

  test("names two subjects in list order, not selection order", () => {
    assert.equal(subjectFilterLabel(new Set([2, 1]), SUBJECTS), "Mathematik, Englisch");
  });

  test("counts three or more subjects", () => {
    assert.equal(subjectFilterLabel(new Set([1, 2, 3]), SUBJECTS), "3 Fächer");
  });

  test("ignores ids that are not in the list", () => {
    assert.equal(subjectFilterLabel(new Set([1, 99]), SUBJECTS), "Mathematik");
    assert.equal(subjectFilterLabel(new Set([99]), SUBJECTS), "Alle Fächer");
  });
});

describe("selectableIds", () => {
  test("leaves out subjects without grades", () => {
    assert.deepEqual(selectableIds(SUBJECTS), [1, 2, 3]);
  });
});

describe("initialDraft", () => {
  test("checks every selectable subject without a filter", () => {
    assert.deepEqual([...initialDraft(null, SUBJECTS)], [1, 2, 3]);
  });

  test("checks the filtered subjects", () => {
    assert.deepEqual([...initialDraft(new Set([2]), SUBJECTS)], [2]);
  });

  test("never checks a subject without grades", () => {
    assert.deepEqual([...initialDraft(new Set([2, 4]), SUBJECTS)], [2]);
  });
});

describe("resolveDraft", () => {
  test("is no filter when every selectable subject is checked", () => {
    assert.equal(resolveDraft(new Set([1, 2, 3]), SUBJECTS), null);
  });

  test("is the checked subjects otherwise", () => {
    assert.deepEqual(resolveDraft(new Set([1, 2]), SUBJECTS), new Set([1, 2]));
  });

  test("drops subjects without grades from the result", () => {
    assert.deepEqual(resolveDraft(new Set([1, 4]), SUBJECTS), new Set([1]));
  });

  test("is an empty set when nothing is checked", () => {
    assert.deepEqual(resolveDraft(new Set(), SUBJECTS), new Set());
  });
});

describe("applyButtonState", () => {
  test("shows all subjects when every selectable one is checked", () => {
    assert.deepEqual(applyButtonState(new Set([1, 2, 3]), SUBJECTS), {
      label: "Alle Fächer anzeigen",
      disabled: false,
    });
  });

  test("counts the checked subjects", () => {
    assert.deepEqual(applyButtonState(new Set([1, 2]), SUBJECTS), {
      label: "2 Fächer anzeigen",
      disabled: false,
    });
  });

  test("uses the singular for one subject", () => {
    assert.equal(applyButtonState(new Set([1]), SUBJECTS).label, "1 Fach anzeigen");
  });

  test("is disabled when nothing is checked", () => {
    assert.deepEqual(applyButtonState(new Set(), SUBJECTS), {
      label: "Mindestens ein Fach wählen",
      disabled: true,
    });
  });
});


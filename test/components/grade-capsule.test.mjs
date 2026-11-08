// The grade box with its Kenntnisnahme state: NEU sticker or seen check, never both.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gradeCapsule, gradeValue, newSticker } from "../../public/js/components/grade-capsule.js";

const has = (html, needle) => html.includes(needle);

describe("gradeValue", () => {
  test("adds P to an Oberstufe grade", () => {
    assert.equal(gradeValue({ raw: "14", scale: "points_0_15", numeric: 14 }), "14 P");
  });

  test("doesn't double the P when the teacher typed one", () => {
    assert.equal(gradeValue({ raw: "14P", scale: "points_0_15", numeric: 14 }), "14 P");
  });

  test("keeps an unparseable Oberstufe value as typed", () => {
    assert.equal(gradeValue({ raw: "nb", scale: "points_0_15", numeric: null }), "nb");
  });

  test("shows a Sek I grade as typed, without P", () => {
    assert.equal(gradeValue({ raw: "2-", scale: "grade_1_6", numeric: 2.25 }), "2-");
  });
});

describe("newSticker", () => {
  test("marks an unseen grade NEU, hidden from screen readers", () => {
    const html = newSticker({ isNew: true });
    assert.ok(has(html, '<span class="grade-sticker grade-sticker--lead" aria-hidden="true">NEU</span>'));
    assert.ok(has(html, 'class="sr-only"'));
  });

  test("shows nothing once the grade has been seen", () => {
    assert.equal(newSticker({ isNew: false, readByGuardian: true }), "");
  });
});

describe("gradeCapsule", () => {
  test("puts a NEU sticker on a new grade, hidden from screen readers", () => {
    const html = gradeCapsule({ raw: "1-", isNew: true, readByGuardian: false });
    assert.ok(has(html, '<span class="grade-sticker" aria-hidden="true">NEU</span>'));
    assert.ok(has(html, '<span class="sr-only">, neu, noch nicht gesehen</span>'));
    assert.ok(!has(html, "grade-seen"));
  });

  test("shows the seen check instead of a sticker once parents have seen it", () => {
    const html = gradeCapsule({ raw: "2", isNew: false, readByGuardian: true });
    assert.ok(has(html, 'class="grade-seen"'));
    assert.ok(has(html, 'aria-label="Von den Eltern gesehen"'));
    assert.ok(!has(html, "grade-sticker"));
  });

  test("labels the check plainly when someone other than a guardian read it", () => {
    const html = gradeCapsule({ raw: "13", isNew: false, readByGuardian: false });
    assert.ok(has(html, 'aria-label="Gesehen"'));
  });

  test("places the check before the capsule", () => {
    const html = gradeCapsule({ raw: "2", isNew: false, readByGuardian: true });
    assert.ok(html.indexOf("grade-seen") < html.indexOf('class="grade-capsule"'));
  });

  test("marks a points value with the points class", () => {
    const html = gradeCapsule({ raw: "14", scale: "points_0_15", numeric: 14, isNew: false });
    assert.ok(has(html, '<span class="grade-capsule grade-capsule--points">14 P</span>'));
  });

  test("escapes the grade value", () => {
    assert.ok(has(gradeCapsule({ raw: "<b>", isNew: false }), "&lt;b&gt;"));
  });
});

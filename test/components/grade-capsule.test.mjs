// The grade box with its Kenntnisnahme state: NEU sticker or seen check, never both.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gradeCapsule } from "../../public/js/components/grade-capsule.js";

const has = (html, needle) => html.includes(needle);

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

  test("escapes the grade value", () => {
    assert.ok(has(gradeCapsule({ raw: "<b>", isNew: false }), "&lt;b&gt;"));
  });
});

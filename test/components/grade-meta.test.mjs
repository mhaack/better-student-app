// The small line under a grade's title: optional leading text and the date.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gradeMeta } from "../../public/js/components/grade-meta.js";

const SEP = '<span class="grade-entry-sep" aria-hidden="true">·</span>';

describe("gradeMeta", () => {
  test("shows the date", () => {
    assert.equal(gradeMeta({ givenAt: "2026-11-03" }), '<div class="grade-entry-meta">03.11.26</div>');
  });

  test("leaves the read check to the grade capsule", () => {
    assert.equal(gradeMeta({ givenAt: "2026-11-03", readByGuardian: true }), '<div class="grade-entry-meta">03.11.26</div>');
  });

  test("puts leading text first and escapes it", () => {
    assert.equal(
      gradeMeta({ givenAt: "2026-10-13" }, ["Klausur <Mechanik>"]),
      `<div class="grade-entry-meta">Klausur &lt;Mechanik&gt;${SEP}13.10.26</div>`
    );
  });

  test("renders nothing when there is nothing to show", () => {
    assert.equal(gradeMeta({ givenAt: null }, [""]), "");
  });
});

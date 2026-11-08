// The small line under a grade's title: date and guardian read check.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gradeMeta } from "../../public/js/components/grade-meta.js";

const SEP = '<span class="grade-entry-sep" aria-hidden="true">·</span>';
const CHECK = '<span role="img" aria-label="von Eltern gelesen" title="Von Eltern gelesen">✓</span>';

describe("gradeMeta", () => {
  test("shows the date and a check when a guardian has read the grade", () => {
    assert.equal(
      gradeMeta({ givenAt: "2026-11-03", readByGuardian: true }),
      `<div class="grade-entry-meta">03.11.26${SEP}${CHECK}</div>`
    );
  });

  test("shows only the date for an unacknowledged grade", () => {
    assert.equal(gradeMeta({ givenAt: "2026-11-03", readByGuardian: false }), '<div class="grade-entry-meta">03.11.26</div>');
  });

  test("puts leading text first and escapes it", () => {
    assert.equal(
      gradeMeta({ givenAt: "2026-10-13", readByGuardian: true }, ["Klausur <Mechanik>"]),
      `<div class="grade-entry-meta">Klausur &lt;Mechanik&gt;${SEP}13.10.26${SEP}${CHECK}</div>`
    );
  });

  test("renders nothing when there is nothing to show", () => {
    assert.equal(gradeMeta({ givenAt: null, readByGuardian: false }, [""]), "");
  });
});

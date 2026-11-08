// The sheet behind a tapped lesson, shared by Heute and the Stundenplan.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { lessonStatusLabel } from "../../public/js/components/lesson-sheet.js";

describe("lessonStatusLabel", () => {
  test("names each kind of change", () => {
    assert.equal(lessonStatusLabel({ status: "cancelled" }), "Entfällt");
    assert.equal(lessonStatusLabel({ status: "room_change" }), "Raumänderung");
    assert.equal(lessonStatusLabel({ status: "substitution" }), "Vertretung");
  });

  test("calls an unknown change Geändert", () => {
    assert.equal(lessonStatusLabel({ status: "something_new" }), "Geändert");
  });

  test("has no label for a regular lesson", () => {
    assert.equal(lessonStatusLabel({ status: "regular" }), undefined);
  });
});

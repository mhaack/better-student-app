// The Termine markers: a dot for tests, a ring for homework, the same on every screen.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { categoryMarker, lessonMarkers } from "../../public/js/components/marker.js";

describe("categoryMarker", () => {
  test("draws a dot for a test and a ring for homework, hidden from screen readers", () => {
    assert.equal(categoryMarker("exam"), '<span class="marker marker--dot" aria-hidden="true"></span>');
    assert.equal(categoryMarker("hw"), '<span class="marker marker--ring" aria-hidden="true"></span>');
  });

  test("adds the placing class when given", () => {
    assert.ok(categoryMarker("hw", "marker--lead").includes('class="marker marker--ring marker--lead"'));
  });

  test("draws nothing for other entries", () => {
    assert.equal(categoryMarker("other"), "");
  });
});

describe("lessonMarkers", () => {
  test("puts the test dot before the homework ring", () => {
    const html = lessonMarkers({ hasExam: true, homework: [{ text: "S. 12" }] }, "sp-marks");
    assert.ok(html.startsWith('<span class="sp-marks">'));
    assert.ok(html.indexOf("marker--dot") < html.indexOf("marker--ring"));
  });

  test("draws nothing for a lesson without test or homework", () => {
    assert.equal(lessonMarkers({ hasExam: false, homework: [] }, "sp-marks"), "");
  });
});

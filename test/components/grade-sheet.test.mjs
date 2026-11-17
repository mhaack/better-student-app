// The slide-up card for acknowledging a new or changed grade.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { gradeSheetHtml } from "../../public/js/components/grade-sheet.js";

function content(overrides = {}) {
  return {
    grade: {
      id: 70482217,
      raw: "8",
      scale: "points_0_15",
      numeric: 8,
      isNew: true,
      isChanged: false,
      previous: null,
      givenAt: "2026-10-01",
      teacher: "Frau Muster",
      collection: { type: "SO", name: "History Flash mdl." },
      notice: { label: "Eingetragen", date: "2026-10-02", unreadIds: [] },
    },
    subjectName: "Geschichte",
    weighting: "Sonstige · 50 %",
    role: "guardian",
    ...overrides,
  };
}

const changed = (gradeOverrides = {}) =>
  content({
    grade: {
      ...content().grade,
      isChanged: true,
      previous: { raw: "3", scale: "points_0_15", numeric: 3 },
      notice: { label: "Geändert", date: "2026-10-19", unreadIds: [] },
      ...gradeOverrides,
    },
  });

describe("gradeSheetHtml", () => {
  test("heads the card with the Leistung's type, date and name", () => {
    const html = gradeSheetHtml(content());
    assert.match(html, /Sonstige · Do 01\.10\.26/);
    assert.match(html, /<h2[^>]*>History Flash mdl\.<\/h2>/);
  });

  test("shows a new grade with NEU and says nobody has seen it", () => {
    const html = gradeSheetHtml(content());
    assert.match(html, />NEU</);
    assert.match(html, /Neue Note/);
    assert.match(html, /Noch nicht von euch gesehen/);
    assert.doesNotMatch(html, /GEÄNDERT/);
  });

  test("speaks to a student directly", () => {
    const html = gradeSheetHtml(content({ role: "student" }));
    assert.match(html, /Noch nicht gesehen/);
    assert.match(html, /dass du die Note gesehen hast/);
  });

  test("shows a changed grade with GEÄNDERT and the old and new value", () => {
    const html = gradeSheetHtml(changed());
    assert.match(html, />GEÄNDERT</);
    assert.match(html, /Note geändert/);
    assert.match(html, /vorher <s>3 P<\/s> → jetzt 8 P/);
  });

  test("lists Fach, Gewichtung, Lehrkraft and when it was entered", () => {
    const html = gradeSheetHtml(content());
    for (const [label, value] of [
      ["Fach", "Geschichte"],
      ["Gewichtung", "Sonstige · 50 %"],
      ["Lehrkraft", "Frau Muster"],
      ["Eingetragen", "Fr 02.10.26"],
    ]) {
      assert.match(html, new RegExp(`${label}</span><span class="detail-value">${value}<`));
    }
  });

  test("says when a changed grade was changed", () => {
    assert.match(gradeSheetHtml(changed()), /Geändert<\/span><span class="detail-value">Mo 19\.10\.26</);
  });

  test("leaves out the date row when the feed has no entry", () => {
    const html = gradeSheetHtml(changed({ notice: { label: "Geändert", date: null, unreadIds: [] } }));
    assert.doesNotMatch(html, /detail-label">Geändert/);
  });

  test("offers to acknowledge or to close", () => {
    const html = gradeSheetHtml(content());
    assert.match(html, /data-acknowledge[^>]*>[\s\S]*Zur Kenntnis nehmen/);
    assert.match(html, /Bestätigt in beste\.schule, dass ihr die Note gesehen habt\./);
    assert.match(html, /data-later[^>]*>Später</);
  });

  test("escapes the API's text", () => {
    const html = gradeSheetHtml(content({ subjectName: "<b>Kunst</b>" }));
    assert.match(html, /&lt;b&gt;Kunst&lt;\/b&gt;/);
  });
});

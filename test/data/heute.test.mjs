// "Letzte Note" on Heute: the most recently entered grade, using the bell
// feed's dates where it has them. Subjects and names like the real ones.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { newestGrade, nextTermine } from "../../public/js/data/heute.js";

const NOW = new Date(2026, 10, 8, 9, 0); // Sunday 2026-11-08, local time

const grade = (id, givenAt, name) => ({ id, givenAt, subjectName: "Physik", collection: { name } });
const notification = (gradeId, createdAt, action = "created") => ({ gradeId, createdAt, action });

describe("newestGrade", () => {
  test("shows a Klausur graded today although it was written weeks ago", () => {
    const klausur = grade(71300001, "2026-10-13", "Klausur Mechanik");
    const test_ = grade(71194131, "2026-11-03", "Test Optik");
    const result = newestGrade(
      [test_, klausur],
      [notification(71194131, "2026-11-03"), notification(71300001, "2026-11-07")],
      NOW
    );
    assert.equal(result.grade, klausur);
  });

  test("falls back to given_at for a grade missing from the feed", () => {
    const older = grade(70566362, "2026-10-23", "Analysis I");
    const newer = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    assert.equal(newestGrade([older, newer], [notification(70566362, "2026-10-24")], NOW).grade, newer);
  });

  test("uses the latest entry when a grade was changed later", () => {
    const changed = grade(70935361, "2026-10-26", "Was ist Kunst?");
    const other = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    const result = newestGrade(
      [changed, other],
      [
        notification(70935361, "2026-10-27"),
        notification(71005722, "2026-11-03"),
        notification(70935361, "2026-11-05", "updated"),
      ],
      NOW
    );
    assert.equal(result.grade, changed);
  });

  test("breaks a same-day tie by the higher, later-entered id", () => {
    const first = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    const second = grade(71194131, "2026-11-03", "Klausur Mechanik");
    assert.equal(newestGrade([second, first], [], NOW).grade, second);
    assert.equal(newestGrade([first, second], [], NOW).grade, second);
  });

  test("ignores entries for grades that aren't this student's", () => {
    const own = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    assert.equal(newestGrade([own], [notification(99999999, "2026-11-07")], NOW).grade, own);
  });

  test("compares dates that carry a time of day", () => {
    const morning = grade(71000001, "2026-10-01", "Sprint");
    const evening = grade(71000002, "2026-10-01", "Ausdauer 12 min");
    const result = newestGrade(
      [morning, evening],
      [notification(71000001, "2026-11-06 18:30:00"), notification(71000002, "2026-11-06 07:15:00")],
      NOW
    );
    assert.equal(result.grade, morning);
  });

  test("returns the date the grade was entered, not the Leistung's", () => {
    const klausur = grade(71300001, "2026-10-13", "Klausur Mechanik");
    const result = newestGrade([klausur], [notification(71300001, "2026-11-07")], NOW);
    assert.equal(result.date, "2026-11-07");
  });

  test("returns given_at as the date when the feed has no entry", () => {
    const newer = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    assert.equal(newestGrade([newer], [], NOW).date, "2026-11-03");
  });

  test("shows nothing when the newest grade was entered more than 14 days ago", () => {
    const old = grade(70482217, "2026-10-01", "History Flash mdl.");
    assert.equal(newestGrade([old], [notification(70482217, "2026-10-20")], NOW), null);
  });

  test("still shows a grade entered exactly 14 days ago", () => {
    const edge = grade(70665820, "2026-10-20", "Utilitarismus");
    assert.equal(newestGrade([edge], [notification(70665820, "2026-10-25")], NOW).grade, edge);
  });

  test("shows nothing without grades", () => {
    assert.equal(newestGrade([], [notification(70665820, "2026-11-07")], NOW), null);
  });
});

describe("nextTermine", () => {
  const entry = (date, typeCode, text = "Kurztest") => ({ date, typeCode, text, subject: "Physik" });

  test("shows the next three by date and counts the rest", () => {
    const result = nextTermine([
      entry("2026-11-13", "HAU"),
      entry("2026-11-10", "KLA"),
      entry("2026-11-12", "LEI"),
      entry("2026-11-11", "HAU"),
      entry("2026-11-19", "HAU"),
    ]);
    assert.deepEqual(
      result.notes.map((n) => n.date),
      ["2026-11-10", "2026-11-11", "2026-11-12"]
    );
    assert.equal(result.more, 2);
  });

  test("has nothing more when three or fewer are coming", () => {
    assert.equal(nextTermine([entry("2026-11-10", "KLA")]).more, 0);
  });

  test("leaves out Stundenthemen and entries without text", () => {
    const result = nextTermine([entry("2026-11-10", "STU", "Wiederholung"), entry("2026-11-11", "HAU", "")]);
    assert.deepEqual(result, { notes: [], more: 0 });
  });

  test("keeps a plan Klausur, which has no text", () => {
    const klausur = { date: "2026-11-10", typeCode: "KLA", text: "", isExam: true };
    assert.deepEqual(nextTermine([klausur]).notes, [klausur]);
  });
});

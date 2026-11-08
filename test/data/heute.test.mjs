// Heute's data: the grades of the newest entry day (bell feed dates where it
// has them), the test card and the next Termine. Names like the real ones.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { latestGrades, nextTermine, upcomingTest } from "../../public/js/data/heute.js";

const NOW = new Date(2026, 10, 8, 9, 0); // Sunday 2026-11-08, local time

const grade = (id, givenAt, name) => ({ id, givenAt, subjectName: "Physik", collection: { name } });
const notification = (gradeId, createdAt, action = "created") => ({ gradeId, createdAt, action });

describe("latestGrades", () => {
  test("shows a Klausur graded today although it was written weeks ago", () => {
    const klausur = grade(71300001, "2026-10-13", "Klausur Mechanik");
    const test_ = grade(71194131, "2026-11-03", "Test Optik");
    const result = latestGrades(
      [test_, klausur],
      [notification(71194131, "2026-11-03"), notification(71300001, "2026-11-07")],
      NOW
    );
    assert.equal(result.grades[0], klausur);
    assert.equal(result.date, "2026-11-07");
  });

  test("falls back to given_at for a grade missing from the feed", () => {
    const older = grade(70566362, "2026-10-23", "Analysis I");
    const newer = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    const result = latestGrades([older, newer], [notification(70566362, "2026-10-24")], NOW);
    assert.equal(result.grades[0], newer);
    assert.equal(result.date, "2026-11-03");
  });

  test("uses the latest entry when a grade was changed later", () => {
    const changed = grade(70935361, "2026-10-26", "Was ist Kunst?");
    const other = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    const result = latestGrades(
      [changed, other],
      [
        notification(70935361, "2026-10-27"),
        notification(71005722, "2026-11-03"),
        notification(70935361, "2026-11-05", "updated"),
      ],
      NOW
    );
    assert.equal(result.grades[0], changed);
  });

  test("lists every grade entered on the newest day, the later-entered id first", () => {
    const first = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    const second = grade(71194131, "2026-11-03", "Klausur Mechanik");
    assert.deepEqual(latestGrades([first, second], [], NOW).grades, [second, first]);
  });

  test("groups by the day entered, not the time of day", () => {
    const morning = grade(71000001, "2026-10-01", "Sprint");
    const evening = grade(71000002, "2026-10-01", "Ausdauer 12 min");
    const result = latestGrades(
      [morning, evening],
      [notification(71000001, "2026-11-06 18:30:00"), notification(71000002, "2026-11-06 07:15:00")],
      NOW
    );
    assert.deepEqual(result.grades, [morning, evening]);
    assert.equal(result.date, "2026-11-06");
  });

  test("leaves out a grade entered the day before", () => {
    const today = grade(71194131, "2026-11-01", "Klausur Mechanik");
    const yesterday = grade(71005722, "2026-11-01", "Freiwillige Leistung AB");
    const result = latestGrades(
      [yesterday, today],
      [notification(71194131, "2026-11-07"), notification(71005722, "2026-11-06")],
      NOW
    );
    assert.deepEqual(result.grades, [today]);
  });

  test("ignores entries for grades that aren't this student's", () => {
    const own = grade(71005722, "2026-11-03", "Freiwillige Leistung AB");
    assert.equal(latestGrades([own], [notification(99999999, "2026-11-07")], NOW).grades[0], own);
  });

  test("shows nothing when the newest grade was entered more than 14 days ago", () => {
    const old = grade(70482217, "2026-10-01", "History Flash mdl.");
    assert.equal(latestGrades([old], [notification(70482217, "2026-10-20")], NOW), null);
  });

  test("still shows a grade entered exactly 14 days ago", () => {
    const edge = grade(70665820, "2026-10-20", "Utilitarismus");
    assert.equal(latestGrades([edge], [notification(70665820, "2026-10-25")], NOW).grades[0], edge);
  });

  test("shows nothing without grades", () => {
    assert.equal(latestGrades([], [notification(70665820, "2026-11-07")], NOW), null);
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

  test("leaves out the test already shown in the card", () => {
    const shown = entry("2026-11-10", "KLA");
    const result = nextTermine([shown, entry("2026-11-11", "HAU")], shown);
    assert.deepEqual(result.notes.map((n) => n.date), ["2026-11-11"]);
  });

  test("leaves out Stundenthemen and entries without text", () => {
    const result = nextTermine([entry("2026-11-10", "STU", "Wiederholung"), entry("2026-11-11", "HAU", "")]);
    assert.deepEqual(result, { notes: [], more: 0 });
  });

  test("keeps a plan Klausur, which has no text", () => {
    const klausur = { date: "2026-11-10", typeCode: "KLA", text: "", isExam: true };
    assert.deepEqual(nextTermine([klausur]).notes, [{ ...klausur, category: "exam" }]);
  });

  test("files each entry under its Termine category, for the marker", () => {
    const result = nextTermine([entry("2026-11-10", "KLA"), entry("2026-11-11", "HAU"), entry("2026-11-12", "XYZ")]);
    assert.deepEqual(result.notes.map((n) => n.category), ["exam", "hw", "other"]);
  });
});

describe("upcomingTest", () => {
  const exam = (date, extra = {}) => ({
    date,
    isExam: true,
    typeName: "Klassenarbeit",
    subject: "Mathematik",
    text: "Quadratische Funktionen",
    timeLabel: "5.–6. Std · 11:40–13:10",
    room: "108",
    ...extra,
  });

  test("labels a test on the shown day with its type only", () => {
    const result = upcomingTest([exam("2026-11-09")], "2026-11-09", "2026-11-08");
    assert.equal(result.label, "Klassenarbeit");
  });

  test("says Morgen for a test the day after today", () => {
    const result = upcomingTest([exam("2026-11-10")], "2026-11-09", "2026-11-09");
    assert.equal(result.label, "Morgen · Klassenarbeit");
  });

  test("names the weekday when the shown day is already tomorrow", () => {
    const result = upcomingTest([exam("2026-11-10")], "2026-11-09", "2026-11-08");
    assert.equal(result.label, "Dienstag · Klassenarbeit");
  });

  test("ignores a test two days after the shown day", () => {
    assert.equal(upcomingTest([exam("2026-11-11")], "2026-11-09", "2026-11-09"), null);
  });

  test("ignores homework", () => {
    const homework = { date: "2026-11-09", typeCode: "HAU", typeName: "Hausaufgabe", text: "S. 12" };
    assert.equal(upcomingTest([homework], "2026-11-09", "2026-11-09"), null);
  });

  test("picks the earlier of two tests", () => {
    const later = exam("2026-11-10", { subject: "Englisch" });
    const sooner = exam("2026-11-09");
    assert.equal(upcomingTest([later, sooner], "2026-11-09", "2026-11-09").exam, sooner);
  });

  test("places it by period, time and room", () => {
    const result = upcomingTest([exam("2026-11-09")], "2026-11-09", "2026-11-09");
    assert.equal(result.where, "5.–6. Std · 11:40–13:10 · 108");
  });
});

// Stundenplan test markers: which day and cell an exam lands on, and the
// room, time and teacher its sheet shows. Names like the real ones.
import assert from "node:assert/strict";
import { test } from "node:test";
import { examsFromNotes, attachExams, withExamDetails } from "../public/js/data/termine.js";
import { calendarDaysBetween, countdownLabel } from "../public/js/util/format.js";

const MA = { subject: "Mathematik", subjectShort: "MA", subjectId: 11 };
const EN = { subject: "Englisch", subjectShort: "EN", subjectId: 12 };
const DE = { subject: "Deutsch", subjectShort: "DE", subjectId: 13 };

let nextId = 1000;
const note = (date, period, subject, extra = {}) => ({
  id: nextId++,
  date,
  period,
  ...subject,
  text: "Klassenarbeit Nr. 1: Lineare Funktionen",
  typeName: "Klassenarbeit/Klausur",
  typeCode: "KLA",
  ...extra,
});

const lesson = (period, subject, extra = {}) => ({
  period,
  status: "regular",
  ...subject,
  room: "108",
  teacher: "Sandra Kaiser",
  ...extra,
});

const BELL = [
  [1, "08:00", "08:45"], [2, "08:50", "09:35"], [3, "09:55", "10:40"], [4, "10:45", "11:30"],
  [5, "11:40", "12:25"], [6, "12:30", "13:15"], [7, "13:45", "14:30"],
];
const timetable = { lessons: BELL.map(([period, from, to]) => ({ period, from, to })) };

// Mo 2026-09-14 … Fr 2026-09-18.
const week = (lessonsByIso = {}) =>
  ["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"].map((iso) => ({
    iso,
    lessons: lessonsByIso[iso] ?? [],
  }));

test("examsFromNotes keeps KLA/LEI only and merges a double period", () => {
  const exams = examsFromNotes([
    note("2026-09-18", 5, MA),
    note("2026-09-18", 6, MA),
    note("2026-09-18", 1, DE, { typeCode: "STU", typeName: "Stundenthema", text: "Kurzgeschichte" }),
    note("2026-09-17", 2, EN, { typeCode: "HAU", typeName: "Hausaufgabe", text: "Workbook p. 12" }),
    note("2026-09-16", 3, EN, { typeCode: "LEI", typeName: "Leistungskontrolle", text: "Vokabeltest Unit 2" }),
  ]);
  assert.deepEqual(
    exams.map((e) => [e.date, e.subjectShort, e.periods]),
    [["2026-09-16", "EN", [3]], ["2026-09-18", "MA", [5, 6]]]
  );
  assert.equal(exams[1].periodLabel, "5.–6. Stunde");
});

test("examsFromNotes orders two exams on one day by period, not by note order", () => {
  const exams = examsFromNotes([
    note("2026-09-18", 6, EN, { text: "Test Unit 3" }),
    note("2026-09-18", 2, DE, { text: "Erörterung" }),
  ]);
  assert.deepEqual(exams.map((e) => e.subjectShort), ["DE", "EN"]);
});

test("a double-period exam marks both cells and spans both periods' times", () => {
  const days = week({ "2026-09-18": [lesson(5, MA), lesson(6, MA), lesson(7, DE)] });
  const exams = examsFromNotes([note("2026-09-18", 5, MA), note("2026-09-18", 6, MA)]);
  const out = attachExams(days, exams, timetable, "2026-09-16");
  const fri = out[4];

  assert.equal(fri.exams.length, 1);
  assert.equal(fri.exams[0].timeLabel, "5.–6. Stunde · 11:40–13:15");
  assert.equal(fri.exams[0].room, "108");
  assert.equal(fri.exams[0].teacher, "Sandra Kaiser");
  assert.deepEqual(fri.lessons.map((l) => Boolean(l.hasExam)), [true, true, false]);
  assert.deepEqual(out.slice(0, 4).map((d) => d.exams.length), [0, 0, 0, 0]);
});

test("the room comes from the grid lesson, so a room change shows the new room", () => {
  // lessonsForDate has already resolved the plan's ["206", "218"] to 206.
  const moved = lesson(3, EN, { status: "room_change", room: "206", previousRoom: "218" });
  const days = week({ "2026-09-16": [moved] });
  const exams = examsFromNotes([note("2026-09-16", 3, EN, { typeCode: "LEI", text: "Vokabeltest" })]);
  const [exam] = attachExams(days, exams, timetable, "2026-09-14")[2].exams;
  assert.equal(exam.room, "206");
});

test("a substitution shows the stand-in teacher", () => {
  const sub = lesson(3, EN, { status: "substitution", teacher: "Ulrike Raupach", previousTeacher: "Sandra Kaiser" });
  const days = week({ "2026-09-16": [sub] });
  const exams = examsFromNotes([note("2026-09-16", 3, EN)]);
  const [exam] = attachExams(days, exams, timetable, "2026-09-14")[2].exams;
  assert.equal(exam.teacher, "Ulrike Raupach");
});

test("no grid lesson in the exam's period: period-only time, no room or teacher", () => {
  const days = week({ "2026-09-15": [lesson(1, DE)] });
  const exams = examsFromNotes([note("2026-09-15", 4, MA)]);
  const out = attachExams(days, exams, timetable, "2026-09-14");
  const [exam] = out[1].exams;
  assert.equal(exam.timeLabel, "4. Stunde · 10:45–11:30");
  assert.equal(exam.room, undefined);
  assert.equal(exam.teacher, undefined);
  assert.equal(out[1].lessons[0].hasExam, undefined);
});

test("a different subject in the exam's period is not the exam's lesson", () => {
  const days = week({ "2026-09-15": [lesson(4, DE, { room: "301" })] });
  const exams = examsFromNotes([note("2026-09-15", 4, MA)]);
  const out = attachExams(days, exams, timetable, "2026-09-14");
  assert.equal(out[1].exams[0].room, undefined);
  assert.equal(out[1].lessons[0].hasExam, undefined);
});

test("a cancelled lesson keeps its dot but lends no room or teacher", () => {
  const days = week({ "2026-09-15": [lesson(4, MA, { status: "cancelled" })] });
  const exams = examsFromNotes([note("2026-09-15", 4, MA)]);
  const out = attachExams(days, exams, timetable, "2026-09-14");
  assert.equal(out[1].lessons[0].hasExam, true);
  assert.equal(out[1].exams[0].room, undefined);
});

test("missing bell times leave the period alone", () => {
  const days = week({ "2026-09-15": [lesson(9, MA)] });
  const exams = examsFromNotes([note("2026-09-15", 9, MA)]);
  const [exam] = attachExams(days, exams, timetable, "2026-09-14")[1].exams;
  assert.equal(exam.timeLabel, "9. Stunde");
});

test("exams outside the shown week are ignored", () => {
  const exams = examsFromNotes([note("2026-09-21", 1, MA)]);
  const out = attachExams(week(), exams, timetable, "2026-09-14");
  assert.ok(out.every((d) => d.exams.length === 0));
});

test("each exam carries its countdown from today", () => {
  const exams = examsFromNotes([note("2026-09-14", 1, MA), note("2026-09-16", 1, EN), note("2026-09-18", 1, DE)]);
  const out = attachExams(week(), exams, timetable, "2026-09-16");
  assert.deepEqual(
    out.flatMap((d) => d.exams.map((e) => e.countdown)),
    ["Vor 2 Tagen", "Heute", "In 2 Tagen"]
  );
});

test("withExamDetails gives Anstehend's tests the sheet fields and leaves homework alone", () => {
  // Thu 2026-09-17: the plan moves the Englisch test from 218 to 206.
  const tt = {
    weeks: [],
    lessons: [{ weekday: 4, period: 3, weeks: [], ...EN, room: "218", roomList: ["218"], teacher: "Sandra Kaiser", teacherList: ["Sandra Kaiser"], from: "09:55", to: "10:40" }],
  };
  const dayPlans = [{
    date: "2026-09-17",
    lessons: [{ period: 3, status: "changed", ...EN, room: "206, 218", roomList: ["206", "218"], teacher: "Sandra Kaiser", teacherList: ["Sandra Kaiser"], notes: [] }],
  }];
  const notes = [
    note("2026-09-16", 2, DE, { typeCode: "HAU", typeName: "Hausaufgabe", text: "Gedicht lernen" }),
    note("2026-09-17", 3, EN, { typeCode: "LEI", typeName: "Leistungskontrolle", text: "Vokabeltest Unit 2" }),
  ];
  const [homework, exam] = withExamDetails(notes, dayPlans, tt, "2026-09-15");
  assert.equal(homework.timeLabel, undefined);
  assert.equal(homework.isExam, undefined);
  assert.equal(exam.isExam, true);
  assert.equal(exam.room, "206");
  assert.equal(exam.timeLabel, "3. Stunde · 09:55–10:40");
  assert.equal(exam.countdown, "In 2 Tagen");
});

test("countdownLabel wording", () => {
  assert.equal(countdownLabel(0), "Heute");
  assert.equal(countdownLabel(1), "Morgen");
  assert.equal(countdownLabel(3), "In 3 Tagen");
  assert.equal(countdownLabel(-1), "Gestern");
  assert.equal(countdownLabel(-3), "Vor 3 Tagen");
});

test("calendarDaysBetween counts calendar days across the October DST change", () => {
  // Clocks go back on 2026-10-25; a 25-hour day must still count as one.
  assert.equal(calendarDaysBetween("2026-10-23", "2026-10-26"), 3);
  assert.equal(calendarDaysBetween("2026-03-27", "2026-03-30"), 3);
  assert.equal(calendarDaysBetween("2026-09-18", "2026-09-16"), -2);
});

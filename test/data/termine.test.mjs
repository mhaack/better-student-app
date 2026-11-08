// Exams from Klassenbuch notes, and the day, cell, room, time and teacher
// they land on in the Stundenplan. Names like the real ones.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  examsFromNotes,
  attachExams,
  attachHomework,
  homeworkFromNotes,
  withBellTimes,
  withExamDetails,
  terminCategory,
  termineFromNotes,
  countByCategory,
  termineList,
  termineSubtitle,
  upcomingBlocks,
} from "../../public/js/data/termine.js";

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

describe("examsFromNotes", () => {
  test("keeps KLA/LEI only and merges a double period", () => {
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

  test("orders two exams on one day by period, not by note order", () => {
    const exams = examsFromNotes([
      note("2026-09-18", 6, EN, { text: "Test Unit 3" }),
      note("2026-09-18", 2, DE, { text: "Erörterung" }),
    ]);
    assert.deepEqual(exams.map((e) => e.subjectShort), ["DE", "EN"]);
  });
});

describe("attachExams", () => {
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
});

describe("withExamDetails", () => {
  test("gives Anstehend's tests the sheet fields and leaves homework alone", () => {
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
});

const hw = (date, period, subject, text = "S. 42, Aufgaben 3–5") =>
  note(date, period, subject, { typeCode: "HAU", typeName: "Hausaufgabe", text });
const test_ = (date, period, subject, text = "Unit 2") =>
  note(date, period, subject, { typeCode: "LEI", typeName: "Leistungskontrolle", text });
const topic = (date, period, subject) =>
  note(date, period, subject, { typeCode: "STU", typeName: "Stundenthema", text: "Wiederholung" });

describe("terminCategory", () => {
  test("files Klassenarbeiten and tests under one tab, homework under its own", () => {
    assert.equal(terminCategory({ typeCode: "KLA" }), "exam");
    assert.equal(terminCategory({ typeCode: "LEI" }), "exam");
    assert.equal(terminCategory({ typeCode: "HAU" }), "hw");
  });

  test("puts any other note type under Sonstiges", () => {
    assert.equal(terminCategory({ typeCode: "ELT" }), "other");
    assert.equal(terminCategory({ typeCode: undefined }), "other");
  });

  test("leaves out the Stundenthema, which looks back", () => {
    assert.equal(terminCategory({ typeCode: "STU" }), null);
  });
});

describe("termineFromNotes", () => {
  test("keeps exams, homework and other notes in date order, each with its tab", () => {
    const termine = termineFromNotes([
      hw("2026-09-22", 2, DE),
      note("2026-09-19", 5, MA),
      test_("2026-09-23", 2, EN),
      note("2026-09-25", 1, DE, { typeCode: "ELT", typeName: "Elternabend", text: "Aula, 19 Uhr" }),
    ]);
    assert.deepEqual(
      termine.map((t) => [t.date, t.category]),
      [
        ["2026-09-19", "exam"],
        ["2026-09-22", "hw"],
        ["2026-09-23", "exam"],
        ["2026-09-25", "other"],
      ]
    );
  });

  test("drops Stundenthemen and notes without text", () => {
    const termine = termineFromNotes([topic("2026-09-22", 1, DE), hw("2026-09-22", 2, DE, "")]);
    assert.deepEqual(termine, []);
  });
});

const herbst = { name: "Herbstferien", from: "2026-10-12", to: "2026-10-24", schoolDays: 10, isFerien: true };
const weihnacht = { name: "Weihnachtsferien", from: "2026-12-21", to: "2027-01-02", schoolDays: 9, isFerien: true };
const bussUndBettag = { name: "Buß- und Bettag", from: "2026-11-18", to: "2026-11-18", schoolDays: 1, isFerien: false };

describe("countByCategory", () => {
  test("counts every tab, keeping empty ones at zero", () => {
    const termine = termineFromNotes([
      note("2026-09-19", 5, MA),
      hw("2026-09-22", 2, DE),
      hw("2026-09-24", 3, MA),
      test_("2026-09-23", 2, EN),
    ]);
    assert.deepEqual(countByCategory(termine, 3), { all: 4, exam: 2, hw: 2, other: 0, ferien: 3 });
  });
});

describe("termineList", () => {
  const termine = termineFromNotes([
    note("2026-09-19", 5, MA),
    hw("2026-09-22", 2, DE),
    test_("2026-10-01", 1, EN),
    hw("2026-11-04", 3, MA),
    note("2027-01-14", 1, DE),
  ]);
  const winter = { name: "Winterferien", from: "2027-02-08", to: "2027-02-20", schoolDays: 10, isFerien: true };
  const options = { nextFerien: herbst, ferien: [herbst, weihnacht, winter], freieTage: [bussUndBettag] };
  const kinds = (items) => items.map((i) => (i.ferien ? i.ferien.name : `${i.termin.category} ${i.date}`));

  test("covers the whole year on Alle, with breaks and free days in between", () => {
    assert.deepEqual(kinds(termineList(termine, "all", options)), [
      "exam 2026-09-19",
      "hw 2026-09-22",
      "exam 2026-10-01",
      "Herbstferien",
      "hw 2026-11-04",
      "Buß- und Bettag",
      "Weihnachtsferien",
      "exam 2027-01-14",
    ]);
  });

  test("shows a tab's breaks only within its own entries", () => {
    assert.deepEqual(kinds(termineList(termine, "hw", options)), ["hw 2026-09-22", "Herbstferien", "hw 2026-11-04"]);
    assert.deepEqual(kinds(termineList(termine, "exam", options)), [
      "exam 2026-09-19",
      "exam 2026-10-01",
      "Herbstferien",
      "Buß- und Bettag",
      "Weihnachtsferien",
      "exam 2027-01-14",
    ]);
  });

  test("always ends Alle with the next break, even before it", () => {
    const early = termineFromNotes([note("2026-09-19", 5, MA)]);
    assert.deepEqual(kinds(termineList(early, "all", options)), ["exam 2026-09-19", "Herbstferien"]);
  });

  test("ends Alle with the last entry when no break is left", () => {
    const late = termineFromNotes([note("2027-07-01", 1, MA)]);
    assert.deepEqual(kinds(termineList(late, "all", { nextFerien: null, ferien: [], freieTage: [] })), [
      "exam 2027-07-01",
    ]);
  });

  test("leaves an empty tab empty", () => {
    assert.deepEqual(termineList(termine, "other", options), []);
  });

  test("lists the breaks and single free days by date on the Ferien tab", () => {
    assert.deepEqual(kinds(termineList(termine, "ferien", options)), [
      "Herbstferien",
      "Buß- und Bettag",
      "Weihnachtsferien",
      "Winterferien",
    ]);
  });
});

describe("upcomingBlocks", () => {
  const sommer = { name: "Sommerferien", from: "2026-07-09", to: "2026-08-19", isFerien: true };

  test("keeps breaks that haven't ended yet, including one under way", () => {
    assert.deepEqual(
      upcomingBlocks([sommer, herbst, weihnacht], "2026-10-14").map((b) => b.name),
      ["Herbstferien", "Weihnachtsferien"]
    );
  });

  test("drops a single free day once it is over", () => {
    assert.deepEqual(upcomingBlocks([bussUndBettag], "2026-11-19"), []);
  });
});

describe("termineSubtitle", () => {
  const termine = termineFromNotes([note("2026-09-19", 5, MA), hw("2026-09-22", 2, DE), hw("2026-09-24", 3, MA)]);
  const options = { nextFerien: herbst, scale: "grade_1_6" };

  test("counts the tab up to the next break", () => {
    assert.equal(termineSubtitle(termine, "all", options), "3 Termine bis zu den Herbstferien");
    assert.equal(termineSubtitle(termine, "hw", options), "2 Hausaufgaben bis zu den Herbstferien");
    assert.equal(termineSubtitle(termine, "other", options), "0 sonstige Termine bis zu den Herbstferien");
  });

  test("counts only what comes before the next break", () => {
    const later = termineFromNotes([hw("2026-09-22", 2, DE), hw("2026-11-04", 3, MA)]);
    assert.equal(termineSubtitle(later, "hw", options), "1 Hausaufgabe bis zu den Herbstferien");
  });

  test("counts exams and tests over the whole school year, in singular and plural", () => {
    assert.equal(termineSubtitle(termine, "exam", options), "1 Arbeit oder Test in diesem Schuljahr");
    const two = termineFromNotes([note("2026-09-19", 5, MA), test_("2027-01-14", 2, EN)]);
    assert.equal(termineSubtitle(two, "exam", options), "2 Arbeiten & Tests in diesem Schuljahr");
  });

  test("calls them Klausuren in the Oberstufe", () => {
    assert.equal(
      termineSubtitle(termine, "exam", { ...options, scale: "points_0_15" }),
      "1 Klausur oder Test in diesem Schuljahr"
    );
  });

  test("says the rest of the school year when no break is left", () => {
    assert.equal(termineSubtitle(termine, "all", { ...options, nextFerien: null }), "3 Termine in diesem Schuljahr");
  });

  test("counts breaks and free days on the Ferien tab", () => {
    const ferienOptions = { ...options, ferienCount: 5, freieTageCount: 3, yearLabel: "Schuljahr 2026/27" };
    assert.equal(termineSubtitle(termine, "ferien", ferienOptions), "5 Ferien und 3 freie Tage im Schuljahr 2026/27");
    assert.equal(
      termineSubtitle(termine, "ferien", { ...ferienOptions, freieTageCount: 1 }),
      "5 Ferien und 1 freier Tag im Schuljahr 2026/27"
    );
    assert.equal(
      termineSubtitle(termine, "ferien", { ...ferienOptions, freieTageCount: 0, yearLabel: "" }),
      "5 Ferien in diesem Schuljahr"
    );
  });
});

describe("homeworkFromNotes", () => {
  test("keeps HAU only and lists a double period's homework once", () => {
    const homework = homeworkFromNotes([
      hw("2026-09-16", 5, MA, "Arbeitsblatt Brüche"),
      hw("2026-09-16", 6, MA, "Arbeitsblatt Brüche"),
      test_("2026-09-16", 3, EN),
      topic("2026-09-16", 1, DE),
    ]);
    assert.deepEqual(
      homework.map((h) => [h.subjectShort, h.periods, h.text]),
      [["MA", [5, 6], "Arbeitsblatt Brüche"]]
    );
  });
});

describe("attachHomework", () => {
  test("rings both lessons of a double period with one entry each", () => {
    const days = week({ "2026-09-16": [lesson(5, MA), lesson(6, MA), lesson(7, DE)] });
    const homework = homeworkFromNotes([hw("2026-09-16", 5, MA), hw("2026-09-16", 6, MA)]);
    const wed = attachHomework(days, homework)[2];

    assert.equal(wed.homework.length, 1);
    assert.deepEqual(wed.lessons.map((l) => l.homework.length), [1, 1, 0]);
    assert.equal(wed.lessons[0].homework[0].text, "S. 42, Aufgaben 3–5");
  });

  test("a different subject in the homework's period gets no ring", () => {
    const days = week({ "2026-09-15": [lesson(4, DE)] });
    const out = attachHomework(days, homeworkFromNotes([hw("2026-09-15", 4, MA)]));
    assert.deepEqual(out[1].lessons[0].homework, []);
    assert.equal(out[1].homework.length, 1);
  });

  test("a cancelled lesson still shows the homework due in it", () => {
    const days = week({ "2026-09-14": [lesson(1, DE, { status: "cancelled" })] });
    const out = attachHomework(days, homeworkFromNotes([hw("2026-09-14", 1, DE)]));
    assert.equal(out[0].lessons[0].homework.length, 1);
  });

  test("two pieces of homework in one lesson both reach it", () => {
    const days = week({ "2026-09-17": [lesson(2, EN)] });
    const homework = homeworkFromNotes([hw("2026-09-17", 2, EN, "Workbook p. 12"), hw("2026-09-17", 2, EN, "Vokabeln Unit 3")]);
    const out = attachHomework(days, homework);
    assert.deepEqual(out[3].lessons[0].homework.map((h) => h.text), ["Workbook p. 12", "Vokabeln Unit 3"]);
  });

  test("homework outside the shown week is ignored", () => {
    const out = attachHomework(week(), homeworkFromNotes([hw("2026-09-21", 1, MA)]));
    assert.ok(out.every((d) => d.homework.length === 0));
  });
});

describe("withBellTimes", () => {
  test("gives each lesson its period's times from the timetable", () => {
    const [fifth, ninth] = withBellTimes([lesson(5, MA), lesson(9, DE)], timetable);
    assert.equal(fifth.timeLabel, "11:40–12:25");
    assert.equal(ninth.timeLabel, undefined);
  });
});

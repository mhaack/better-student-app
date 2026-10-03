// The school's fixed Klausur plan (public/data/klausuren_*.json) as a fallback
// exam source: which entries belong to the student, and that beste.schule's
// own tests always win. Kurs and teacher codes like the real ones.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  planFileName,
  klausurenForStudent,
  withPlannedKlausuren,
  fetchKlausurPlan,
} from "../public/js/data/klausuren.js";
import { examsFromNotes, attachExams, withExamDetails } from "../public/js/data/termine.js";

const MA = { id: 11, name: "Mathematik", short: "MA" };
const PH = { id: 14, name: "Physik", short: "PH" };
const LA = { id: 15, name: "Latein", short: "LA" };

const group = (localId, subjects = []) => ({ id: localId.length, localId, isClass: false, subjects });
const groups = [
  { id: 1, localId: "11BIO - Tutorenkurs", isClass: true, subjects: [] },
  group("11MA1", [MA]),
  group("11ph2", [PH]),
  group("11-12la1", [LA]),
  // The API returns some groups without subjects; the timetable still has one.
  group("11gh1"),
];

const BELL = { 1: ["07:30", "08:15"], 2: ["08:20", "09:05"], 3: ["09:25", "10:10"], 4: ["10:15", "11:00"] };
const ttLesson = (weekday, period, groupLocalId, subject, extra = {}) => ({
  weekday,
  period,
  weeks: [],
  groupLocalId,
  subjectId: subject.id,
  subject: subject.name,
  subjectShort: subject.short,
  room: "210",
  teacher: "Karl Klahr",
  teacherShortList: ["KLH"],
  from: BELL[period][0],
  to: BELL[period][1],
  ...extra,
});
const GH = { id: 16, name: "Geschichte", short: "GH" };
// Tuesday: MA1 in periods 3–4, ph2 in period 1. Thursday: gh1 in period 2.
const timetable = {
  weeks: [],
  lessons: [
    ttLesson(2, 3, "11MA1", { id: 11, name: "Mathematik", short: "MA" }),
    ttLesson(2, 4, "11MA1", { id: 11, name: "Mathematik", short: "MA" }),
    ttLesson(2, 1, "11ph2", { id: 14, name: "Physik", short: "PH" }, { teacherShortList: ["RCD"] }),
    ttLesson(4, 2, "11gh1", GH, { teacherShortList: ["GTH"] }),
  ],
};

const entry = (date, kurs, teacher = "KLH", duration = 90) => ({ date, kurs, teacher, duration });

let nextId = 5000;
const note = (date, period, subject, extra = {}) => ({
  id: nextId++,
  date,
  period,
  subject: subject.name,
  subjectShort: subject.short,
  subjectId: subject.id,
  text: "Klausur: Analysis",
  typeName: "Klassenarbeit/Klausur",
  typeCode: "KLA",
  teacher: "KLH",
  ...extra,
});

// --- which file -----------------------------------------------------------

test("planFileName picks the Jahrgang and school year", () => {
  const year = { from: "2026-08-08", to: "2027-07-16" };
  assert.equal(planFileName("11er", year), "klausuren_11_2026_27.json");
  assert.equal(planFileName("12er", year), "klausuren_12_2026_27.json");
  assert.equal(planFileName("Sek I", year), null);
  assert.equal(planFileName("11er", null), null);
});

// --- matching Kurse -------------------------------------------------------

test("MA1 matches 11MA1 and ma1 does not (LK and GK are different Kurse)", () => {
  const exams = klausurenForStudent(
    [entry("2026-11-03", "MA1"), entry("2026-11-03", "ma1", "SMM")],
    groups,
    timetable
  );
  assert.equal(exams.length, 1);
  assert.equal(exams[0].subject, "Mathematik");
  assert.equal(exams[0].subjectId, 11);
});

test("la1 matches the 11-12la1 group", () => {
  const [exam] = klausurenForStudent([entry("2026-11-17", "la1", "RAP")], groups, timetable);
  assert.equal(exam.subject, "Latein");
});

test("a Kurs the student doesn't take is ignored", () => {
  assert.deepEqual(klausurenForStudent([entry("2026-11-03", "bio1", "SCH")], groups, timetable), []);
});

test("a group without subjects takes its subject from the timetable", () => {
  const [exam] = klausurenForStudent([entry("2026-11-26", "gh1", "GTH")], groups, timetable);
  assert.equal(exam.subject, "Geschichte");
  assert.equal(exam.subjectId, 16);
});

test("a plan exam gets the Kurs's periods that day and the Dauer in its label", () => {
  const [exam] = klausurenForStudent([entry("2026-11-03", "MA1")], groups, timetable);
  assert.deepEqual(exam.periods, [3, 4]);
  assert.equal(exam.periodLabel, "3.–4. Stunde · 90 Min.");
  assert.equal(exam.typeName, "Klausur");
  assert.equal(exam.typeCode, "KLA");
  assert.equal(exam.text, "");
});

test("on a day without a lesson of the Kurs the label is the Dauer alone", () => {
  // Monday: MA1 has no lesson.
  const [exam] = klausurenForStudent([entry("2026-11-02", "MA1", "KLH", 180)], groups, timetable);
  assert.deepEqual(exam.periods, []);
  assert.equal(exam.periodLabel, "180 Min.");
});

// --- beste.schule wins ----------------------------------------------------

const planned = klausurenForStudent([entry("2026-11-03", "MA1"), entry("2026-11-03", "ph2", "RCD")], groups, timetable);

test("a KLA note on the same day and subject drops the file entry but takes its Dauer", () => {
  const noteExams = examsFromNotes([note("2026-11-03", 3, MA), note("2026-11-03", 4, MA)]);
  const before = structuredClone(noteExams);
  const exams = withPlannedKlausuren(noteExams, planned.filter((e) => e.subjectId === 11));
  assert.equal(exams.length, 1);
  assert.deepEqual(exams[0], {
    ...before[0],
    duration: 90,
    durationLabel: "90 Min.",
    periodLabel: "3.–4. Stunde · 90 Min.",
  });
});

test("a small LEI test on the same day and subject drops it without taking the Dauer", () => {
  const noteExams = examsFromNotes([
    note("2026-11-03", 1, PH, { typeCode: "LEI", typeName: "Leistungskontrolle", text: "Test Optik", teacher: "RCD" }),
  ]);
  const before = structuredClone(noteExams);
  const exams = withPlannedKlausuren(noteExams, planned);
  assert.deepEqual(
    exams.map((e) => [e.subject, e.typeCode, e.source]),
    [["Physik", "LEI", undefined], ["Mathematik", "KLA", "plan"]]
  );
  assert.deepEqual(exams[0], before[0]);
});

test("a note for another subject on that day keeps the file entry", () => {
  const exams = withPlannedKlausuren(examsFromNotes([note("2026-11-03", 3, PH, { teacher: "RCD" })]), planned);
  assert.equal(exams.filter((e) => e.source === "plan").length, 1);
  assert.equal(exams.find((e) => e.source === "plan").subject, "Mathematik");
});

test("a note for the same subject on another day keeps the file entry", () => {
  const exams = withPlannedKlausuren(examsFromNotes([note("2026-11-10", 3, MA)]), planned.slice(0, 1));
  assert.deepEqual(
    exams.map((e) => [e.date, e.source]),
    [["2026-11-03", "plan"], ["2026-11-10", undefined]]
  );
});

test("without a subjectId the teacher code decides", () => {
  const orphan = { ...planned[0], subjectId: undefined, teacherShort: "KLH" };
  const sameTeacher = examsFromNotes([note("2026-11-03", 3, { id: 99, name: "Mathe", short: "MA" }, { teacher: "KLH" })]);
  const otherTeacher = examsFromNotes([note("2026-11-03", 3, { id: 99, name: "Mathe", short: "MA" }, { teacher: "RTH" })]);
  assert.equal(withPlannedKlausuren(sameTeacher, [orphan]).length, 1);
  assert.equal(withPlannedKlausuren(otherTeacher, [orphan]).length, 2);
});

// --- in the grid ----------------------------------------------------------

const lesson = (period, subject, extra = {}) => ({
  period,
  status: "regular",
  subjectId: subject.id,
  subject: subject.name,
  room: "210",
  teacher: "Karl Klahr",
  ...extra,
});

test("a plan exam marks the Kurs's cells and shows the new room after a room change", () => {
  const [exam] = klausurenForStudent([entry("2026-11-03", "MA1")], groups, timetable);
  const [day] = attachExams(
    [
      {
        iso: "2026-11-03",
        lessons: [
          lesson(1, PH),
          lesson(3, MA, { status: "room_change", room: "206", previousRoom: "210" }),
          lesson(4, MA, { status: "room_change", room: "206", previousRoom: "210" }),
        ],
      },
    ],
    [exam],
    timetable,
    "2026-10-02"
  );
  assert.equal(day.exams.length, 1);
  assert.equal(day.exams[0].room, "206");
  assert.equal(day.exams[0].timeLabel, "3.–4. Stunde · 09:25–11:00 · 90 Min.");
  assert.deepEqual(day.lessons.map((l) => Boolean(l.hasExam)), [false, true, true]);
});

test("a day without a lesson of the Kurs keeps the exam but marks no cell", () => {
  const [exam] = klausurenForStudent([entry("2026-11-02", "MA1")], groups, timetable);
  const [day] = attachExams([{ iso: "2026-11-02", lessons: [lesson(1, PH)] }], [exam], timetable, "2026-10-02");
  assert.equal(day.exams.length, 1);
  assert.equal(day.exams[0].timeLabel, "90 Min.");
  assert.equal(day.exams[0].room, undefined);
  assert.equal(day.lessons.some((l) => l.hasExam), false);
});

test("a KLA note's sheet shows the Dauer from the plan", () => {
  const [day] = attachExams(
    [{ iso: "2026-11-03", lessons: [lesson(3, MA), lesson(4, MA)] }],
    withPlannedKlausuren(examsFromNotes([note("2026-11-03", 3, MA), note("2026-11-03", 4, MA)]), planned),
    timetable,
    "2026-10-02"
  );
  const ma = day.exams.find((e) => e.subjectId === 11);
  assert.equal(ma.text, "Klausur: Analysis");
  assert.equal(ma.timeLabel, "3.–4. Stunde · 09:25–11:00 · 90 Min.");
});

test("a note exam's timeLabel is unchanged", () => {
  const [day] = attachExams(
    [{ iso: "2026-11-03", lessons: [lesson(3, MA), lesson(4, MA)] }],
    examsFromNotes([note("2026-11-03", 3, MA), note("2026-11-03", 4, MA)]),
    timetable,
    "2026-10-02"
  );
  assert.equal(day.exams[0].timeLabel, "3.–4. Stunde · 09:25–11:00");
});

// --- Heute's Anstehend ----------------------------------------------------

test("withExamDetails adds uncovered plan exams with the sheet fields", () => {
  const notes = [note("2026-11-03", 1, PH, { typeCode: "LEI", typeName: "Leistungskontrolle", teacher: "RCD" })];
  const out = withExamDetails(notes, [], timetable, "2026-10-02", planned);
  assert.deepEqual(
    out.map((n) => [n.subject, n.isExam, n.source]),
    [["Physik", true, undefined], ["Mathematik", true, "plan"]]
  );
  const plan = out.find((n) => n.source === "plan");
  assert.equal(plan.timeLabel, "3.–4. Stunde · 09:25–11:00 · 90 Min.");
  assert.equal(plan.countdown, "In 32 Tagen");
});

test("withExamDetails without plan exams returns the notes as before", () => {
  const notes = [note("2026-11-03", 3, MA), { ...note("2026-11-03", 3, MA), typeCode: "STU", text: "Thema" }];
  assert.equal(withExamDetails(notes, [], timetable, "2026-10-02").length, 2);
});

// --- the file ---------------------------------------------------------------

test("a missing or broken file gives no exams", async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response("", { status: 404 });
    assert.deepEqual(await fetchKlausurPlan("klausuren_11_2030_31.json"), []);
    globalThis.fetch = async () => new Response("{not json", { status: 200 });
    assert.deepEqual(await fetchKlausurPlan("klausuren_12_2030_31.json"), []);
    globalThis.fetch = async () => {
      throw new TypeError("offline");
    };
    assert.deepEqual(await fetchKlausurPlan("klausuren_11_2031_32.json"), []);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the committed plans parse and every entry has the expected shape", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../public/data/", import.meta.url);
  const files = readdirSync(dir).filter((f) => /^klausuren_\d+_\d{4}_\d{2}\.json$/.test(f));
  assert.ok(files.length >= 1);
  for (const file of files) {
    for (const e of JSON.parse(readFileSync(new URL(file, dir), "utf8"))) {
      assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/, file);
      assert.match(e.kurs, /^[A-Za-z]+\d+$/, file);
      assert.match(e.teacher, /^[A-Z]{3}$/, file);
      assert.ok(Number.isInteger(e.duration) && e.duration > 0, file);
    }
  }
});

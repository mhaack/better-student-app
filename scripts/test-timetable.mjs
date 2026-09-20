// Tests for merging the published day plan with the base timetable.
// The room cases come from real plan data (Sept/Oct 2026): a relocated lesson
// lists the original room *and* the new one in one alphabetically sorted
// array, so the new room has to be derived by difference.
import assert from "node:assert/strict";
import { refineChangedLessons } from "../public/js/data/timetable.js";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

// Thursday 2026-09-24.
const THURSDAY = new Date(2026, 8, 24, 9, 0, 0);

const timetableWith = (roomList, extra = {}) => ({
  weeks: [],
  lessons: [{ weekday: 4, period: 7, weeks: [], subject: "Englisch", roomList, room: roomList.join(", "), teacher: "Frau A", teacherShort: "A", ...extra }],
});
const planLesson = (roomList, extra = {}) => ({
  period: 7, status: "changed", subject: "Englisch", subjectShort: "EN",
  roomList, room: roomList.join(", "), teacher: "Frau A", teacherShort: "A", notes: [], ...extra,
});

const refineOne = (base, plan, date = THURSDAY) => refineChangedLessons([plan], base, date)[0];

test("new room listed first: 218 -> 206", () => {
  const out = refineOne(timetableWith(["218"]), planLesson(["206", "218"]));
  assert.equal(out.status, "room_change");
  assert.equal(out.previousRoom, "218");
  assert.equal(out.room, "206");
});

test("new room listed second: 209 -> Home1", () => {
  const out = refineOne(timetableWith(["209"]), planLesson(["209", "Home1"]));
  assert.equal(out.previousRoom, "209");
  assert.equal(out.room, "Home1");
});

test("numeric-looking rooms sort oddly but still resolve: 204 -> 09", () => {
  const out = refineOne(timetableWith(["204"]), planLesson(["09", "204"]));
  assert.equal(out.previousRoom, "204");
  assert.equal(out.room, "09");
});

test("a room replaced outright, with no overlap", () => {
  const out = refineOne(timetableWith(["210"]), planLesson(["305"]));
  assert.equal(out.status, "room_change");
  assert.equal(out.previousRoom, "210");
  assert.equal(out.room, "305");
});

test("unchanged rooms are not a room change", () => {
  const out = refineOne(timetableWith(["210"]), planLesson(["210"]));
  assert.equal(out.status, "changed");
  assert.equal(out.previousRoom, undefined);
});

test("a cancelled lesson keeps its room and its status", () => {
  const out = refineOne(timetableWith(["210"]), planLesson(["210"], { status: "cancelled" }));
  assert.equal(out.status, "cancelled");
  assert.equal(out.room, "210");
});

test("a stand-in teacher outranks a room move", () => {
  const out = refineOne(
    timetableWith(["218"]),
    planLesson(["206", "218"], { teacher: "Herr B", teacherShort: "B" })
  );
  assert.equal(out.status, "substitution");
  assert.equal(out.previousTeacherShort, "A");
  assert.equal(out.teacherShort, "B");
});

test("no timetable entry to compare against: stays a plain change", () => {
  const out = refineOne({ weeks: [], lessons: [] }, planLesson(["206", "218"]));
  assert.equal(out.status, "changed");
  assert.equal(out.room, "206, 218"); // nothing known to subtract
});

test("lessons that weren't changed pass through untouched", () => {
  const plan = planLesson(["218"], { status: "regular" });
  assert.equal(refineOne(timetableWith(["218"]), plan), plan);
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) console.error("Some tests failed.");

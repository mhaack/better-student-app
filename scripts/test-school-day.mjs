// Plain-Node tests for the "which day does Heute show" rules.
import assert from "node:assert/strict";
import {
  resolveSchoolDay,
  schoolDayLabel,
  DEFAULT_CUTOFF_HOUR,
} from "../public/js/domain/school-day.js";

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

// 2026-09-14 is a Monday, so this week runs Mon 14th … Sun 20th.
const at = (day, hour, minute = 0) => new Date(2026, 8, day, hour, minute, 0);
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("the default cutoff is 17:00", () => {
  assert.equal(DEFAULT_CUTOFF_HOUR, 17);
});

test("before the cutoff on a school day: shows today", () => {
  assert.equal(iso(resolveSchoolDay(at(16, 7, 30))), "2026-09-16"); // Wed morning
  assert.equal(iso(resolveSchoolDay(at(16, 16, 59))), "2026-09-16"); // one minute before
});

test("at exactly the cutoff: already rolls forward", () => {
  assert.equal(iso(resolveSchoolDay(at(16, 17, 0))), "2026-09-17");
});

test("Mon-Thu after the cutoff: shows tomorrow", () => {
  assert.equal(iso(resolveSchoolDay(at(14, 18, 0))), "2026-09-15"); // Mon -> Tue
  assert.equal(iso(resolveSchoolDay(at(15, 18, 0))), "2026-09-16"); // Tue -> Wed
  assert.equal(iso(resolveSchoolDay(at(16, 18, 0))), "2026-09-17"); // Wed -> Thu
  assert.equal(iso(resolveSchoolDay(at(17, 18, 0))), "2026-09-18"); // Thu -> Fri
});

test("Friday after the cutoff: jumps the weekend to Monday", () => {
  assert.equal(iso(resolveSchoolDay(at(18, 17, 30))), "2026-09-21");
});

test("Friday before the cutoff: still Friday", () => {
  assert.equal(iso(resolveSchoolDay(at(18, 9, 0))), "2026-09-18");
});

test("Saturday: shows Monday, whatever the time", () => {
  assert.equal(iso(resolveSchoolDay(at(19, 6, 0))), "2026-09-21");
  assert.equal(iso(resolveSchoolDay(at(19, 23, 30))), "2026-09-21");
});

test("Sunday: shows Monday, whatever the time", () => {
  assert.equal(iso(resolveSchoolDay(at(20, 6, 0))), "2026-09-21");
  assert.equal(iso(resolveSchoolDay(at(20, 22, 0))), "2026-09-21");
});

test("a custom cutoff moves the rollover, and only the rollover", () => {
  assert.equal(iso(resolveSchoolDay(at(16, 16, 30), 16)), "2026-09-17"); // 16:00 cutoff
  assert.equal(iso(resolveSchoolDay(at(16, 16, 30), 17)), "2026-09-16");
  assert.equal(iso(resolveSchoolDay(at(16, 19, 30), 20)), "2026-09-16"); // 20:00 cutoff
  assert.equal(iso(resolveSchoolDay(at(16, 20, 0), 20)), "2026-09-17");
});

test("a custom cutoff doesn't change the weekend rule", () => {
  assert.equal(iso(resolveSchoolDay(at(19, 10, 0), 20)), "2026-09-21");
  assert.equal(iso(resolveSchoolDay(at(20, 10, 0), 16)), "2026-09-21");
});

test("the heading names the day it's actually showing", () => {
  const wedMorning = at(16, 8, 0);
  assert.equal(schoolDayLabel(resolveSchoolDay(wedMorning), wedMorning), "Heute");

  const wedEvening = at(16, 18, 0);
  assert.equal(schoolDayLabel(resolveSchoolDay(wedEvening), wedEvening), "Morgen");

  const sundayEvening = at(20, 18, 0); // Monday is tomorrow
  assert.equal(schoolDayLabel(resolveSchoolDay(sundayEvening), sundayEvening), "Morgen");

  const fridayEvening = at(18, 18, 0); // Monday is three days out
  assert.equal(schoolDayLabel(resolveSchoolDay(fridayEvening), fridayEvening), "Montag");

  const saturday = at(19, 12, 0);
  assert.equal(schoolDayLabel(resolveSchoolDay(saturday), saturday), "Montag");
});

console.log(`\n${passed} test(s) passed.`);
if (process.exitCode) console.error("Some tests failed.");

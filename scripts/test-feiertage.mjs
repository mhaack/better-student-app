// Plain-Node tests for the computed German public-holiday names.
import assert from "node:assert/strict";
import { easterSunday, holidayNames, feiertagName } from "../public/js/domain/feiertage.js";

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

const iso = (d) => d.toISOString().slice(0, 10);

test("Easter Sunday matches known dates", () => {
  assert.equal(iso(easterSunday(2026)), "2026-04-05");
  assert.equal(iso(easterSunday(2027)), "2027-03-28");
  assert.equal(iso(easterSunday(2024)), "2024-03-31");
  // A late-Easter year, to exercise the other branch of the algorithm.
  assert.equal(iso(easterSunday(2038)), "2038-04-25");
});

test("the Easter-relative holidays land on their real dates", () => {
  // Easter 2027 is 28 March.
  assert.equal(feiertagName("2027-03-26"), "Karfreitag");
  assert.equal(feiertagName("2027-03-29"), "Ostermontag");
  assert.equal(feiertagName("2027-05-06"), "Christi Himmelfahrt");
  assert.equal(feiertagName("2027-05-17"), "Pfingstmontag");
  assert.equal(feiertagName("2027-05-27"), "Fronleichnam");
  assert.equal(feiertagName("2027-02-08"), "Rosenmontag");
});

test("the fixed holidays are named", () => {
  assert.equal(feiertagName("2027-01-01"), "Neujahr");
  assert.equal(feiertagName("2027-05-01"), "Tag der Arbeit");
  assert.equal(feiertagName("2027-10-03"), "Tag der Deutschen Einheit");
  assert.equal(feiertagName("2027-12-26"), "2. Weihnachtsfeiertag");
});

test("Buß- und Bettag is the Wednesday before 23 November", () => {
  // 2026-11-23 is a Monday, so the Wednesday before is the 18th.
  assert.equal(feiertagName("2026-11-18"), "Buß- und Bettag");
  // 2027-11-23 is a Tuesday -> the 17th.
  assert.equal(feiertagName("2027-11-17"), "Buß- und Bettag");
});

test("when 23 November is itself a Wednesday, the holiday is the week before", () => {
  // 2033-11-23 is a Wednesday; the holiday must not be the 23rd itself.
  const names = holidayNames(2033);
  const day = Object.keys(names).find((k) => names[k] === "Buß- und Bettag");
  assert.equal(day, "2033-11-16");
});

test("an ordinary day has no name, rather than a guessed one", () => {
  assert.equal(feiertagName("2026-09-21"), undefined);
  assert.equal(feiertagName("2027-05-07"), undefined); // Brückentag, not a Feiertag
  assert.equal(feiertagName(""), undefined);
  assert.equal(feiertagName(null), undefined);
});

test("the two Feiertage this school actually closes for are both covered", () => {
  assert.equal(feiertagName("2026-11-18"), "Buß- und Bettag");
  assert.equal(feiertagName("2027-05-06"), "Christi Himmelfahrt");
});

console.log(`\n${passed} passed`);

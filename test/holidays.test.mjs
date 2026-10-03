// Plain-Node tests for grouping no_school_dates into named holiday blocks.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  holidayBlocks,
  nameBlocks,
  nextHoliday,
  heuristicName,
  ferienStem,
  MIN_FERIEN_SCHOOL_DAYS,
} from "../public/js/domain/holidays.js";

/** Every weekday from `from` to `to`, which is the shape no_school_dates has. */
function weekdaysBetween(from, to) {
  const out = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

test("an empty list yields no blocks", () => {
  assert.deepEqual(holidayBlocks([]), []);
  assert.deepEqual(holidayBlocks(undefined), []);
  assert.deepEqual(holidayBlocks(null), []);
});

test("a single closed day is one block of one school day", () => {
  assert.deepEqual(holidayBlocks(["2026-11-18"]), [
    { from: "2026-11-18", to: "2026-11-18", schoolDays: 1 },
  ]);
});

test("a two-week break bridges its weekend into ONE block", () => {
  // The 2026 autumn break must not split at the weekend.
  const blocks = holidayBlocks(weekdaysBetween("2026-10-12", "2026-10-23"));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].from, "2026-10-12");
  assert.equal(blocks[0].to, "2026-10-23");
  assert.equal(blocks[0].schoolDays, 10);
});

test("a school day between two closed days keeps them apart", () => {
  // Thu 2026-11-19 is not listed, so the 18th and 20th are separate.
  const blocks = holidayBlocks(["2026-11-18", "2026-11-20"]);
  assert.equal(blocks.length, 2);
});

test("duplicates and unsorted input are tolerated", () => {
  const blocks = holidayBlocks(["2026-10-13", "2026-10-12", "2026-10-13"]);
  assert.deepEqual(blocks, [{ from: "2026-10-12", to: "2026-10-13", schoolDays: 2 }]);
});

test("schoolDays counts weekdays, not calendar days", () => {
  const blocks = holidayBlocks(weekdaysBetween("2026-12-23", "2027-01-01"));
  const calendarDays =
    Math.round((new Date(blocks[0].to) - new Date(blocks[0].from)) / 86_400_000) + 1;
  assert.equal(calendarDays, 10);
  assert.equal(blocks[0].schoolDays, 8); // actual school days lost
});

test("a block crossing new year stays one block", () => {
  const blocks = holidayBlocks(weekdaysBetween("2026-12-23", "2027-01-01"));
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].from, "2026-12-23");
  assert.equal(blocks[0].to, "2027-01-01");
});

test("adjacent days of different kinds are not merged into one block", () => {
  // 6 May 2027 is Christi Himmelfahrt, 7 May Pfingstferien: keep them apart.
  const official = [{ name: "Pfingstferien", from: "2027-05-07", to: "2027-05-07" }];
  const blocks = holidayBlocks(["2027-05-06", "2027-05-07"], official);
  assert.equal(blocks.length, 2, "the official boundary must split the block");

  const named = nameBlocks(blocks, official);
  assert.deepEqual(named.map((b) => b.name), ["Christi Himmelfahrt", "Pfingstferien"]);
});

test("days inside the same official range still merge across a weekend", () => {
  const official = [{ name: "Pfingstferien", from: "2027-05-15", to: "2027-05-18" }];
  // 15/16 May 2027 are Sat/Sun and never listed; 17/18 are Mon/Tue.
  const blocks = holidayBlocks(["2027-05-17", "2027-05-18"], official);
  assert.equal(blocks.length, 1);
  assert.equal(nameBlocks(blocks, official)[0].name, "Pfingstferien");
});

test("without an official calendar, block grouping is unchanged", () => {
  assert.deepEqual(
    holidayBlocks(["2027-05-06", "2027-05-07"]),
    [{ from: "2027-05-06", to: "2027-05-07", schoolDays: 2 }]
  );
});

// --- naming -------------------------------------------------------------

test("an official range supplies the name AND replaces the block's dates", () => {
  // The school recorded only 15 of the 30 weekdays of the 2027 summer break.
  const blocks = holidayBlocks(weekdaysBetween("2027-07-12", "2027-07-30"));
  const named = nameBlocks(blocks, [
    { name: "Sommerferien", from: "2027-07-10", to: "2027-08-20" },
  ]);
  assert.equal(named[0].name, "Sommerferien");
  assert.equal(named[0].from, "2027-07-10");
  assert.equal(named[0].to, "2027-08-20");
  assert.equal(named[0].source, "official");
  assert.equal(named[0].isFerien, true);
  // The count follows the official range: 30 weekdays, not the 15 recorded.
  assert.equal(named[0].schoolDays, 30);
});

test("a gap in the school's list does not duplicate the official break", () => {
  // Wed 2027-07-21 missing: two school blocks, one official Sommerferien.
  const official = [{ name: "Sommerferien", from: "2027-07-10", to: "2027-08-20" }];
  const dates = [...weekdaysBetween("2027-07-12", "2027-07-20"), ...weekdaysBetween("2027-07-22", "2027-07-30")];
  const blocks = holidayBlocks(dates, official);
  assert.equal(blocks.length, 2, "precondition: the gap splits the school's blocks");
  const named = nameBlocks(blocks, official);
  assert.equal(named.length, 1);
  assert.equal(named[0].to, "2027-08-20");
});

test("a short official Ferien block is named, where the heuristic could not", () => {
  // Too short for the heuristic; only the official calendar names it.
  const blocks = holidayBlocks(["2027-05-07"]);
  assert.equal(heuristicName("2027-05-07", 1), null);
  const named = nameBlocks(blocks, [
    { name: "Pfingstferien", from: "2027-05-07", to: "2027-05-07" },
  ]);
  assert.equal(named[0].name, "Pfingstferien");
  assert.equal(named[0].isFerien, true);
});

test("a single day outside official Ferien falls back to the Feiertag name", () => {
  const named = nameBlocks(holidayBlocks(["2026-11-18"]), []);
  assert.equal(named[0].name, "Buß- und Bettag");
  assert.equal(named[0].source, "feiertag");
  // A Feiertag is not Ferien — it belongs in "Einzelne freie Tage".
  assert.equal(named[0].isFerien, false);
});

test("with no official calendar at all, the heuristic takes over", () => {
  const named = nameBlocks(holidayBlocks(weekdaysBetween("2026-10-12", "2026-10-23")), []);
  assert.equal(named[0].name, "Herbstferien");
  assert.equal(named[0].source, "derived");
});

test("an underivable block stays unnamed rather than guessing", () => {
  // Two days in May: not a Feiertag, too short for the Ferien threshold.
  const named = nameBlocks(holidayBlocks(["2027-05-18"]), []);
  assert.equal(named[0].name, null);
  assert.equal(named[0].source, "none");
});

test("the heuristic table", () => {
  assert.equal(heuristicName("2026-10-12", 10), "Herbstferien");
  assert.equal(heuristicName("2026-12-23", 8), "Weihnachtsferien");
  assert.equal(heuristicName("2027-02-08", 10), "Winterferien");
  assert.equal(heuristicName("2027-03-26", 6), "Osterferien");
  assert.equal(heuristicName("2027-07-12", 15), "Sommerferien");
  assert.equal(heuristicName("2026-08-03", 10), "Sommerferien");
  // June splits on length: a week is Pfingsten, six weeks is summer.
  assert.equal(heuristicName("2027-06-07", 5), "Pfingstferien");
  assert.equal(heuristicName("2027-06-07", 20), "Sommerferien");
  // Below the threshold nothing is named.
  assert.equal(heuristicName("2026-10-12", MIN_FERIEN_SCHOOL_DAYS - 1), null);
});

test("the G2 list uses the season name, not a suffix trim", () => {
  // Stripping "-ferien" would give "Weihnachts", "Oster", "Pfingst".
  assert.equal(ferienStem("Herbstferien"), "Herbst");
  assert.equal(ferienStem("Weihnachtsferien"), "Weihnachten");
  assert.equal(ferienStem("Winterferien"), "Winter");
  assert.equal(ferienStem("Osterferien"), "Ostern");
  assert.equal(ferienStem("Pfingstferien"), "Pfingsten");
  assert.equal(ferienStem("Sommerferien"), "Sommer");
  assert.equal(ferienStem("Buß- und Bettag"), "Buß- und Bettag");
  assert.equal(ferienStem("Bewegliche Ferientage"), "Bewegliche Ferientage");
  assert.equal(ferienStem(null), null);
});

test("nextHoliday skips unnamed blocks and anything already started", () => {
  const named = nameBlocks(
    holidayBlocks(["2026-09-25", ...weekdaysBetween("2026-10-12", "2026-10-23")]),
    []
  );
  // 2026-09-25 is a lone Friday: unnamed, so not an answer.
  assert.equal(nextHoliday(named, "2026-09-20").name, "Herbstferien");
  assert.equal(nextHoliday(named, "2026-10-12"), null); // already begun
  assert.equal(nextHoliday([], "2026-09-20"), null);
});

test("nextHoliday skips a named single Feiertag and waits for real Ferien", () => {
  // Buß- und Bettag is named but isn't a break to count down to.
  const named = nameBlocks(
    holidayBlocks(["2026-11-18", ...weekdaysBetween("2026-12-23", "2027-01-01")]),
    []
  );
  assert.equal(named[0].name, "Buß- und Bettag");
  assert.equal(nextHoliday(named, "2026-10-26").name, "Weihnachtsferien");
});

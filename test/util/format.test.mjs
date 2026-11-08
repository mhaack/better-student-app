// German dates, countdowns and the points unit.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  calendarDaysBetween,
  countdownLabel,
  formatFullDate,
  formatWeekday,
  formatWeekdayDate,
  scaleUnit,
} from "../../public/js/util/format.js";

describe("countdownLabel", () => {
  test("says Heute, Morgen, In n Tagen, Gestern, Vor n Tagen", () => {
    assert.equal(countdownLabel(0), "Heute");
    assert.equal(countdownLabel(1), "Morgen");
    assert.equal(countdownLabel(3), "In 3 Tagen");
    assert.equal(countdownLabel(-1), "Gestern");
    assert.equal(countdownLabel(-3), "Vor 3 Tagen");
  });
});

describe("calendarDaysBetween", () => {
  test("counts calendar days across the October DST change", () => {
    // Clocks go back on 2026-10-25; a 25-hour day must still count as one.
    assert.equal(calendarDaysBetween("2026-10-23", "2026-10-26"), 3);
    assert.equal(calendarDaysBetween("2026-03-27", "2026-03-30"), 3);
    assert.equal(calendarDaysBetween("2026-09-18", "2026-09-16"), -2);
  });
});

describe("formatFullDate", () => {
  test("shows the calendar day given, with a two-digit year", () => {
    assert.equal(formatFullDate("2026-11-03"), "03.11.26");
    assert.equal(formatFullDate("2026-09-01"), "01.09.26");
  });

  test("ignores a time of day after the date", () => {
    assert.equal(formatFullDate("2026-11-06 18:30:00"), "06.11.26");
  });

  test("returns an empty string for a missing date", () => {
    assert.equal(formatFullDate(undefined), "");
  });
});

// Date parsing is shared with formatFullDate; these only cover the wording.
describe("formatWeekday", () => {
  test("gives the short weekday without the trailing dot by default", () => {
    assert.equal(formatWeekday("2025-09-19"), "Fr");
  });

  test("gives the full weekday when asked", () => {
    assert.equal(formatWeekday("2025-09-19", "long"), "Freitag");
  });
});

describe("formatWeekdayDate", () => {
  test("puts the short weekday before the full date", () => {
    assert.equal(formatWeekdayDate("2025-09-19"), "Fr 19.09.25");
  });
});

describe("scaleUnit", () => {
  test("puts P after Oberstufe points", () => {
    assert.equal(scaleUnit("points_0_15", 14), " P");
    assert.equal(scaleUnit("points_0_15", 0), " P");
  });

  test("adds nothing to a Sek I grade", () => {
    assert.equal(scaleUnit("grade_1_6", 2.3), "");
  });

  test("adds nothing to a missing value, which shows as a dash", () => {
    assert.equal(scaleUnit("points_0_15", null), "");
    assert.equal(scaleUnit("points_0_15", undefined), "");
  });
});

// German dates, countdowns and the points unit.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import {
  calendarDaysBetween,
  countdownLabel,
  daysUntil,
  formatAverage,
  formatDayMonth,
  formatFullDate,
  formatMonthYear,
  formatOverallAverage,
  formatWeekday,
  formatWeekdayDate,
  periodLabel,
  scaleUnit,
  weekdayOrDate,
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

describe("formatDayMonth", () => {
  test("gives day and month without leading zeros, as in the grid", () => {
    assert.equal(formatDayMonth("2026-11-09"), "9.11.");
  });

  test("ignores a time after the date", () => {
    assert.equal(formatDayMonth("2026-03-05T23:30:00Z"), "5.3.");
  });

  test("is empty for no date", () => {
    assert.equal(formatDayMonth(undefined), "");
  });
});

describe("formatMonthYear", () => {
  test("names the month and year, for Termine's month headings", () => {
    assert.equal(formatMonthYear("2026-11-09"), "November 2026");
  });

  test("is empty for no date", () => {
    assert.equal(formatMonthYear(""), "");
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

describe("daysUntil", () => {
  // Sunday 2026-11-08, mid-morning local time.
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 8, 9, 30) }));
  afterEach(() => mock.timers.reset());

  test("counts whole days from today, negative looking back", () => {
    assert.equal(daysUntil("2026-11-08"), 0);
    assert.equal(daysUntil("2026-11-09"), 1);
    assert.equal(daysUntil("2026-11-06"), -2);
  });

  test("returns null without a date", () => {
    assert.equal(daysUntil(undefined), null);
  });
});

describe("weekdayOrDate", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 8, 9, 30) }));
  afterEach(() => mock.timers.reset());

  test("says Heute and Morgen for the next two days", () => {
    assert.equal(weekdayOrDate("2026-11-08"), "Heute");
    assert.equal(weekdayOrDate("2026-11-09"), "Morgen");
  });

  test("names the weekday for the rest of the coming week", () => {
    assert.equal(weekdayOrDate("2026-11-13"), "Freitag");
  });

  test("falls back to day and month from a week out, and looking back", () => {
    assert.equal(weekdayOrDate("2026-11-16"), "16.11.");
    assert.equal(weekdayOrDate("2026-11-05"), "05.11.");
  });

  test("returns an empty string without a date", () => {
    assert.equal(weekdayOrDate(""), "");
  });
});

describe("periodLabel", () => {
  test("names a single period", () => {
    assert.equal(periodLabel([3]), "3. Stunde");
  });

  test("joins a run of periods with a dash", () => {
    assert.equal(periodLabel([1, 2]), "1.–2. Stunde");
  });

  test("lists periods with a gap one by one", () => {
    assert.equal(periodLabel([1, 3]), "1., 3. Stunde");
  });

  test("is empty without periods", () => {
    assert.equal(periodLabel([]), "");
  });
});

describe("formatAverage", () => {
  test("shows Noten with one or two decimals", () => {
    assert.equal(formatAverage(2, "grade_1_6"), "2,0");
    assert.equal(formatAverage(2.25, "grade_1_6"), "2,25");
  });

  test("shows points with at most one decimal", () => {
    assert.equal(formatAverage(12, "points_0_15"), "12");
    assert.equal(formatAverage(12.4, "points_0_15"), "12,4");
  });

  test("shows a dash without a value", () => {
    assert.equal(formatAverage(null, "grade_1_6"), "–");
  });
});

describe("formatOverallAverage", () => {
  test("always shows two decimals for Noten", () => {
    assert.equal(formatOverallAverage(2.3, "grade_1_6"), "2,30");
  });

  test("shows points with at most one decimal", () => {
    assert.equal(formatOverallAverage(11.2, "points_0_15"), "11,2");
  });

  test("shows a dash without a value", () => {
    assert.equal(formatOverallAverage(undefined, "points_0_15"), "–");
  });
});

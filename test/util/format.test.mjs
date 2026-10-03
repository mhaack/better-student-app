// German date and countdown wording.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { calendarDaysBetween, countdownLabel } from "../../public/js/util/format.js";

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

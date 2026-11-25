// What the "Jetzt" display shows on Heute and the Stundenplan's today column.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { jetztState } from "../../public/js/domain/jetzt.js";

const BELL = {
  1: ["07:45", "08:30"],
  2: ["08:40", "09:25"],
  3: ["09:45", "10:30"],
  4: ["10:40", "11:25"],
  5: ["11:40", "12:25"],
  6: ["12:30", "13:15"],
};
const lesson = (period, status = "regular") => ({ period, status, from: BELL[period][0], to: BELL[period][1] });
const at = (hour, minute) => new Date(2025, 8, 18, hour, minute);

// Do 18.09.25: 2 Ma, 3 Ch (room change), 4 Sport entfällt, 5–6 De.
const DAY = [lesson(2), lesson(3, "room_change"), lesson(4, "cancelled"), lesson(5), lesson(6)];

describe("jetztState", () => {
  test("is off before the first lesson starts", () => {
    assert.deepEqual(jetztState(at(8, 39), DAY), { kind: "off" });
  });

  test("is off from the end of the last held lesson", () => {
    assert.deepEqual(jetztState(at(13, 15), DAY), { kind: "off" });
  });

  test("is off on a day without held lessons", () => {
    assert.deepEqual(jetztState(at(10, 0), [lesson(3, "cancelled")]), { kind: "off" });
    assert.deepEqual(jetztState(at(10, 0), []), { kind: "off" });
  });

  test("shows the running lesson with progress and minutes left", () => {
    const state = jetztState(at(10, 2), DAY);
    assert.equal(state.kind, "lesson");
    assert.equal(state.period, 3);
    assert.equal(state.from, "09:45");
    assert.equal(state.to, "10:30");
    assert.equal(state.restMin, 28);
    assert.equal(state.progress, 17 / 45);
    assert.deepEqual(state.past, [2]);
  });

  test("counts a lesson as running from its first minute", () => {
    const state = jetztState(at(8, 40), DAY);
    assert.equal(state.kind, "lesson");
    assert.equal(state.period, 2);
    assert.equal(state.progress, 0);
  });

  test("shows the next lesson in a break", () => {
    const state = jetztState(at(9, 35), DAY);
    assert.equal(state.kind, "gap");
    assert.equal(state.period, 3);
    assert.equal(state.from, "09:45");
    assert.equal(state.inMin, 10);
    assert.equal(state.free, false);
    assert.deepEqual(state.past, [2]);
  });

  test("calls the gap a Freistunde when a cancelled lesson lies in it", () => {
    const state = jetztState(at(10, 50), DAY);
    assert.equal(state.kind, "gap");
    assert.equal(state.period, 5);
    assert.equal(state.inMin, 50);
    assert.equal(state.free, true);
    assert.deepEqual(state.past, [2, 3]);
  });

  test("marks a cancelled lesson as past once its time is over", () => {
    assert.deepEqual(jetztState(at(11, 40), DAY).past, [2, 3, 4]);
  });

  test("ignores lessons without bell times", () => {
    const state = jetztState(at(10, 2), [{ period: 9, status: "regular" }, ...DAY]);
    assert.equal(state.period, 3);
  });

  test("reads unpadded times", () => {
    const state = jetztState(at(8, 0), [{ period: 1, status: "regular", from: "7:45", to: "8:30" }]);
    assert.equal(state.restMin, 30);
  });
});

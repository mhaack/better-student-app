// Device-local preferences; a broken or missing storage falls back to the defaults.
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import {
  getAccent,
  getGradeChart,
  getGradeUnit,
  setAccent,
  setGradeChart,
  setGradeUnit,
} from "../../public/js/state/settings.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

beforeEach(() => {
  globalThis.window = { localStorage: memoryStorage() };
});

afterEach(() => {
  delete globalThis.window;
});

describe("getGradeChart", () => {
  test("defaults to bars", () => {
    assert.equal(getGradeChart(), "bar");
  });

  test("ignores a stored value it doesn't offer", () => {
    window.localStorage.setItem("schulblick.gradeChart", "torte");
    assert.equal(getGradeChart(), "bar");
  });

  test("falls back to bars when storage throws", () => {
    globalThis.window = {
      get localStorage() {
        throw new Error("blocked");
      },
    };
    assert.equal(getGradeChart(), "bar");
  });
});

describe("setGradeChart", () => {
  test("remembers the donut", () => {
    setGradeChart("donut");
    assert.equal(getGradeChart(), "donut");
  });

  test("doesn't throw without storage", () => {
    globalThis.window = {
      get localStorage() {
        throw new Error("blocked");
      },
    };
    assert.doesNotThrow(() => setGradeChart("donut"));
  });
});

describe("getGradeUnit", () => {
  test("defaults to points", () => {
    assert.equal(getGradeUnit(), "points");
  });

  test("ignores a stored value it doesn't offer", () => {
    window.localStorage.setItem("schulblick.gradeUnit", "prozent");
    assert.equal(getGradeUnit(), "points");
  });
});

describe("setGradeUnit", () => {
  test("remembers the converted Noten", () => {
    setGradeUnit("notes");
    assert.equal(getGradeUnit(), "notes");
  });
});

describe("getAccent", () => {
  test("defaults to Rost", () => {
    assert.equal(getAccent(), "rost");
  });

  test("ignores a stored color it doesn't offer", () => {
    window.localStorage.setItem("schulblick.accent", "pink");
    assert.equal(getAccent(), "rost");
  });
});

describe("setAccent", () => {
  test("remembers Petrol", () => {
    setAccent("petrol");
    assert.equal(getAccent(), "petrol");
  });
});

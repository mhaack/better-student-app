// The bottom nav's dots: Noten for unseen grades, Mehr for unread Schulinformationen.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { setNavDot } from "../../public/js/components/bottom-nav.js";

/** Just enough of a <nav> for setNavDot: one item per path, with classes and attributes. */
function fakeNav(paths) {
  const items = new Map(
    paths.map((path) => {
      const classes = new Set();
      const attributes = new Map();
      const item = {
        classList: { toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), has: (n) => classes.has(n) },
        setAttribute: (name, value) => attributes.set(name, value),
        getAttribute: (name) => attributes.get(name),
      };
      return [path, item];
    })
  );
  return {
    items,
    querySelector: (selector) => items.get(selector.match(/data-path="([^"]+)"/)?.[1]) ?? null,
  };
}

describe("setNavDot", () => {
  test("puts a dot on the tab and names the reason for screen readers", () => {
    const nav = fakeNav(["/noten", "/mehr"]);
    setNavDot(nav, "/noten", "neue Noten");
    const item = nav.items.get("/noten");
    assert.equal(item.classList.has("nav-item--dot"), true);
    assert.equal(item.getAttribute("aria-label"), "Noten, neue Noten");
    assert.equal(nav.items.get("/mehr").classList.has("nav-item--dot"), false);
  });

  test("removes the dot and restores the plain tab label without a reason", () => {
    const nav = fakeNav(["/noten"]);
    setNavDot(nav, "/noten", "neue Noten");
    setNavDot(nav, "/noten", null);
    const item = nav.items.get("/noten");
    assert.equal(item.classList.has("nav-item--dot"), false);
    assert.equal(item.getAttribute("aria-label"), "Noten");
  });

  test("does nothing without a nav, as after logging out", () => {
    assert.doesNotThrow(() => setNavDot(null, "/noten", "neue Noten"));
  });
});

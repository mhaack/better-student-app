import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { rainbowMark } from "../../public/js/components/rainbow-mark.js";

const read = (path) => readFileSync(new URL(`../../public/${path}`, import.meta.url), "utf8");
const arcs = (html) =>
  [...html.matchAll(/<path class="rainbow-arc (rainbow-arc--\d)[^"]*"[^>]* d="([^"]+)"/g)].map(([, color, d]) => ({
    color,
    d,
  }));

describe("rainbowMark", () => {
  it("draws the same arcs as the splash in index.html", () => {
    const splash = arcs(read("index.html"));
    assert.equal(splash.length, 6);
    assert.deepEqual(arcs(rainbowMark("login-mark")), splash);
  });

  it("takes every arc colour from a token, none inline", () => {
    const tokens = read("css/tokens.css");
    const css = read("css/app.css");
    for (let n = 1; n <= 6; n++) {
      assert.match(tokens, new RegExp(`--rainbow-${n}: #[0-9A-F]{6};`, "i"));
      assert.match(css, new RegExp(`\\.rainbow-arc--${n} \\{[^}]*stroke: var\\(--rainbow-${n}\\)`));
    }
    assert.doesNotMatch(rainbowMark("login-mark"), /style=/);
    assert.doesNotMatch(read("index.html"), /stroke:#/);
  });

  it("scopes the clip path id to the class name", () => {
    const svg = rainbowMark("login-mark");
    assert.match(svg, /<clipPath id="login-mark-clip">/);
    assert.match(svg, /clip-path="url\(#login-mark-clip\)"/);
  });
});

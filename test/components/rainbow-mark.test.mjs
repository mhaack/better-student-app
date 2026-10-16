import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { rainbowMark } from "../../public/js/components/rainbow-mark.js";

const arcs = (html) => [...html.matchAll(/<path class="rainbow-arc[^"]*" style="([^"]*)"[^>]* d="([^"]+)"/g)].map(([, style, d]) => ({
  stroke: style.match(/stroke:(#[0-9A-F]+)/i)[1],
  d,
}));

describe("rainbowMark", () => {
  it("draws the same arcs as the splash in index.html", () => {
    const indexHtml = readFileSync(new URL("../../public/index.html", import.meta.url), "utf8");
    const splash = arcs(indexHtml);
    assert.equal(splash.length, 6);
    assert.deepEqual(arcs(rainbowMark("login-mark")), splash);
  });

  it("scopes the clip path id to the class name", () => {
    const svg = rainbowMark("login-mark");
    assert.match(svg, /<clipPath id="login-mark-clip">/);
    assert.match(svg, /clip-path="url\(#login-mark-clip\)"/);
  });
});

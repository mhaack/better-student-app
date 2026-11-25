// The progress bar of the "Jetzt" display.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { progressBar } from "../../public/js/components/jetzt.js";

describe("progressBar", () => {
  test("rounds the progress to a percentage for width and screen readers", () => {
    const html = progressBar(17 / 45, "now-progress", "Verlauf der Stunde");
    assert.ok(html.includes('aria-valuenow="38"'));
    assert.ok(html.includes("width:38%"));
    assert.ok(html.includes('class="now-progress" role="progressbar" aria-label="Verlauf der Stunde"'));
  });

  test("clamps values outside 0–1", () => {
    assert.ok(progressBar(1.2, "x", "y").includes('aria-valuenow="100"'));
    assert.ok(progressBar(-0.1, "x", "y").includes('aria-valuenow="0"'));
  });
});

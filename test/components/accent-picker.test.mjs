// The Akzentfarbe row under Mehr › Einstellungen: one round swatch per color, a radio group.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { accentPicker } from "../../public/js/components/accent-picker.js";

const OPTIONS = [
  { value: "rost", label: "Rost" },
  { value: "gruen", label: "Grün" },
];

describe("accentPicker", () => {
  test("checks only the current color and makes it the one tab stop", () => {
    const html = accentPicker(OPTIONS, "gruen");
    assert.ok(html.includes('data-accent="rost" aria-label="Rost" aria-checked="false" tabindex="-1"'));
    assert.ok(html.includes('data-accent="gruen" aria-label="Grün" aria-checked="true" tabindex="0"'));
  });

  test("names the current color next to the label", () => {
    const html = accentPicker(OPTIONS, "gruen");
    assert.ok(html.includes('<span class="accent-name" data-accent-name>Grün</span>'));
  });

  test("labels the radio group", () => {
    assert.ok(accentPicker(OPTIONS, "rost").includes('role="radiogroup" aria-label="Akzentfarbe"'));
  });
});

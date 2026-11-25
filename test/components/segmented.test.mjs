// The toggle row used for Übersicht | Diagramm, Balken | Kreis and 0–15 P | 1–6.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { segmented } from "../../public/js/components/segmented.js";

const OPTIONS = [
  { value: "bar", label: "Balken" },
  { value: "donut", label: "Kreis" },
];

describe("segmented", () => {
  test("presses only the current option", () => {
    const html = segmented(OPTIONS, "donut", { label: "Notendiagramm", attr: "data-grade-chart" });
    assert.ok(html.includes('data-grade-chart="bar" aria-pressed="false">Balken</button>'));
    assert.ok(html.includes('data-grade-chart="donut" aria-pressed="true">Kreis</button>'));
  });

  test("labels the group and adds the size modifier", () => {
    const html = segmented(OPTIONS, "bar", { label: "Notendiagramm", attr: "data-grade-chart", modifier: "small" });
    assert.ok(html.startsWith('<div class="segmented segmented--small" role="group" aria-label="Notendiagramm">'));
  });
});

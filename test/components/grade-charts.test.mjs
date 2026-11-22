// The Noten › Diagramme chart bodies: stacked bars, donut and table as HTML strings.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { barChart, distributionTable, donutChart } from "../../public/js/components/grade-charts.js";
import { gradeDistribution } from "../../public/js/domain/grade-distribution.js";

// The design's Sek I example: 27 Noten, 7/10/6/3/1/0 per Note.
const SEK1 = [
  [1, "ka", 2],
  [1, "sl", 5],
  [2, "ka", 3],
  [2, "sl", 7],
  [3, "ka", 2],
  [3, "sl", 4],
  [4, "ka", 1],
  [4, "sl", 2],
  [5, "sl", 1],
].flatMap(([value, kind, n]) => Array.from({ length: n }, () => ({ subjectId: 1, value, kind })));

const notes = (entries) => gradeDistribution(entries, { scale: "grade_1_6", unit: "notes" });
const points = (entries) => gradeDistribution(entries, { scale: "points_0_15", unit: "points" });
const entry = (value, kind = "sl") => ({ subjectId: 1, value, kind });
const count = (html, needle) => html.split(needle).length - 1;
const texts = (html, cls) => [...html.matchAll(new RegExp(`class="${cls}"[^>]*>([^<]*)<`, "g"))].map((m) => m[1]);

describe("barChart", () => {
  test("stacks Klassenarbeiten below Sonstige with one segment each", () => {
    const html = barChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.equal(count(html, "gc-bar gc-bar--ka"), 4);
    assert.equal(count(html, "gc-bar gc-bar--sl"), 5);
    assert.ok(html.indexOf("gc-bar--ka") < html.indexOf("gc-bar--sl"));
  });

  test("writes the total above every non-empty bar only", () => {
    const html = barChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.deepEqual(texts(html, "gc-total"), ["7", "10", "6", "3", "1"]);
  });

  test("labels the x axis with Note 1 to 6", () => {
    const html = barChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.deepEqual(texts(html, "gc-xlabel"), ["1", "2", "3", "4", "5", "6"]);
  });

  test("rounds the axis to 12 with ticks every 4 when the tallest bar is 10", () => {
    const html = barChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.deepEqual(texts(html, "gc-tick"), ["0", "4", "8", "12"]);
  });

  test("rounds the axis to 6 with ticks every 2 when the tallest bar is 5", () => {
    const entries = [15, 13, 13, 13, 13, 13].map((value) => entry(value));
    const html = barChart(points(entries), { kaLabel: "Klausuren" });
    assert.deepEqual(texts(html, "gc-tick"), ["0", "2", "4", "6"]);
  });

  test("draws 16 point bars from 15 to 0, labelling every third", () => {
    const entries = Array.from({ length: 16 }, (_, value) => entry(value, "ka"));
    const html = barChart(points(entries), { kaLabel: "Klausuren" });
    assert.equal(count(html, "gc-bar gc-bar--ka"), 16);
    assert.deepEqual(texts(html, "gc-xlabel gc-xlabel--dense"), ["15", "12", "9", "6", "3", "0"]);
  });

  test("rounds only the top segment of a stack", () => {
    const html = barChart(notes([entry(2, "ka"), entry(2, "sl"), entry(3, "ka")]), { kaLabel: "Klassenarbeiten" });
    const paths = [...html.matchAll(/class="gc-bar gc-bar--(ka|sl)" d="([^"]+)"/g)];
    const [stackedKa, stackedSl, loneKa] = paths.map((m) => m[2]);
    assert.ok(!stackedKa.includes("Q"));
    assert.ok(stackedSl.includes("Q"));
    assert.ok(loneKa.includes("Q"));
  });

  test("is an image whose label sums up each bar", () => {
    const html = barChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.ok(html.includes('role="img"'));
    assert.ok(html.includes('viewBox="0 0 306 220"'));
    assert.ok(html.includes("Balkendiagramm, 27 Noten je Note. Note 1: 7 (Klassenarbeiten 2, Sonstige 5);"));
    assert.ok(!html.includes("Note 6: 0"));
  });

  test("names points in the label of an Oberstufe chart", () => {
    const html = barChart(points([entry(14, "ka")]), { kaLabel: "Klausuren" });
    assert.ok(html.includes("Balkendiagramm, 1 Note je Punktzahl. 14 Punkte: 1 (Klausuren 1, Sonstige 0)"));
  });

  test("puts the KA label and Sonstige Leistungen in the legend", () => {
    const html = barChart(notes(SEK1), { kaLabel: "Klausuren" });
    assert.ok(html.includes('<span class="gc-swatch gc-swatch--ka" aria-hidden="true"></span>Klausuren</li>'));
    assert.ok(html.includes('<span class="gc-swatch gc-swatch--sl" aria-hidden="true"></span>Sonstige Leistungen</li>'));
  });

  test("escapes the KA label", () => {
    const html = barChart(notes(SEK1), { kaLabel: "<b>KA</b>" });
    assert.ok(!html.includes("<b>"));
  });
});

describe("donutChart", () => {
  test("draws one segment per non-empty Note in its sequence colour", () => {
    const html = donutChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.equal(count(html, 'class="gc-seg '), 5);
    assert.ok(html.includes("gc-seg gc-seq-1"));
    assert.ok(!html.includes("gc-seg gc-seq-6"));
  });

  test("shows the count and Noten in the centre", () => {
    const html = donutChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.ok(html.includes('class="gc-donut__count" x="95" y="99" text-anchor="middle">27</text>'));
    assert.ok(html.includes(">Noten</text>"));
    assert.ok(html.includes('aria-label="Kreisdiagramm, Anteil je Note, 27 Noten"'));
  });

  test("draws a full ring when all grades are the same Note", () => {
    const html = donutChart(notes([entry(2), entry(2)]), { kaLabel: "Klassenarbeiten" });
    assert.ok(html.includes('<circle class="gc-ring gc-seq-2"'));
    assert.ok(!html.includes("gc-seg"));
  });

  test("lists every Note with count and share, empty ones dashed", () => {
    const html = donutChart(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.equal(count(html, '<li class="gc-share'), 6);
    assert.ok(html.includes('<span class="gc-share__n">10×</span><span class="gc-share__pct">37 %</span>'));
    assert.ok(
      html.includes(
        '<li class="gc-share gc-share--empty"><span class="gc-swatch gc-swatch--empty" aria-hidden="true"></span><span>Note 6</span><span class="gc-share__n">0×</span><span class="gc-share__pct">0 %</span>',
      ),
    );
  });

  test("ends with the colour footnote naming the KA series", () => {
    const html = donutChart(notes(SEK1), { kaLabel: "Klausuren" });
    assert.ok(html.endsWith('<p class="gc-note">Note 1 kräftig → Note 6 blass. Klausuren und sonstige Leistungen zusammen.</p>'));
  });

  test("lists every point value 15 to 0 in the colour of its Note", () => {
    const html = donutChart(points([entry(14), entry(14), entry(8)]), { kaLabel: "Klausuren" });
    assert.equal((html.match(/<li /g) ?? []).length, 16);
    assert.ok(html.includes('<span class="gc-swatch gc-seq-1" aria-hidden="true"></span><span>14 P</span><span class="gc-share__n">2×</span>'));
    assert.ok(html.includes('<path class="gc-seg gc-seq-3"'));
    assert.ok(html.includes("Anteil je Punktzahl"));
    assert.ok(html.includes("gc-shares--points"));
  });

  test("explains the point colours in the footnote", () => {
    const html = donutChart(points([entry(14), entry(8)]), { kaLabel: "Klausuren" });
    assert.ok(html.includes('<p class="gc-note">15 P kräftig → 0 P blass, in den Farben der Noten. Klausuren und sonstige Leistungen zusammen.</p>'));
  });

  test("leaves the footnote out when asked to", () => {
    assert.ok(!donutChart(notes(SEK1), { kaLabel: "Klausuren", footnote: false }).includes("gc-note"));
  });
});

describe("distributionTable", () => {
  test("has a row per Note with KA, Sonstige and Gesamt", () => {
    const html = distributionTable(notes(SEK1), { kaLabel: "Klassenarbeiten" });
    assert.ok(
      html.includes(
        '<th scope="col">Note</th><th scope="col">Klassenarbeiten</th><th scope="col">Sonstige</th><th scope="col">Gesamt</th>',
      ),
    );
    assert.equal(count(html, '<th scope="row">'), 6);
    assert.ok(html.includes('<tr><th scope="row">2</th><td>3</td><td>7</td><td class="gc-table__total">10</td></tr>'));
    assert.ok(html.includes('<tr><th scope="row">6</th><td>0</td><td>0</td><td class="gc-table__total">0</td></tr>'));
  });

  test("heads the first column Punkte for an Oberstufe table", () => {
    const html = distributionTable(points([entry(14, "ka")]), { kaLabel: "Klausuren" });
    assert.ok(html.includes('<th scope="col">Punkte</th><th scope="col">Klausuren</th>'));
    assert.equal(count(html, '<th scope="row">'), 16);
  });
});

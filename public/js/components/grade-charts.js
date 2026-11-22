// The Noten › Diagramme charts as HTML strings: stacked bars, donut, table.
// They render the body only; the view owns the card, its title and toggles.
import { pointsToNote } from "../domain/grade-distribution.js";
import { escapeHtml } from "../util/dom.js";
import { formatPercent } from "../util/format.js";

const BAR_WIDTH = 306;
const BAR_HEIGHT = 220;
const AXIS_WIDTH = 24;
const PLOT_TOP = 8;
const PLOT_BOTTOM = 28;
const SEGMENT_GAP = 2;
const BAR_RADIUS = 4;
const MAX_TICK_INTERVALS = 4;
const TICK_STEPS = [1, 2, 4, 5, 10, 20, 25, 50, 100];
const POINT_LABEL_EVERY = 3;

const DONUT_SIZE = 190;
const DONUT_RING = 34;
const DONUT_GAP = (2 * Math.PI) / 180;
// "kräftig/blass", not "dunkel/hell": the dark theme flips the ramp so Note 1 stays strongest.
const DONUT_NOTE = { notes: "Note 1 kräftig → Note 6 blass.", points: "15 P kräftig → 0 P blass, in den Farben der Noten." };

const SL_LABEL = "Sonstige Leistungen";

const round = (value) => Math.round(value * 100) / 100;
const notenWord = (count) => (count === 1 ? "Note" : "Noten");

/**
 * A y axis ending just above the tallest bar, with at most four tick intervals:
 * max 10 → 0/4/8/12, max 5 → 0/2/4/6.
 */
function niceAxis(max) {
  const needed = Math.max(max, 1) + 0.5;
  for (const step of TICK_STEPS) {
    const top = Math.ceil(needed / step) * step;
    if (top / step <= MAX_TICK_INTERVALS) return { top, step };
  }
  const step = 10 ** Math.ceil(Math.log10(needed / MAX_TICK_INTERVALS));
  return { top: Math.ceil(needed / step) * step, step };
}

/** "Note 2", "14 Punkte"; `short` gives "14 P" as shown elsewhere in the app. */
function bucketName(unit, bucket, short = false) {
  if (unit !== "points") return `Note ${bucket.label}`;
  return `${bucket.label} ${short ? "P" : "Punkte"}`;
}

function barLabel(dist, kaLabel) {
  const parts = dist.buckets
    .filter((bucket) => bucket.total)
    .map((bucket) => `${bucketName(dist.unit, bucket)}: ${bucket.total} (${kaLabel} ${bucket.ka}, Sonstige ${bucket.sl})`);
  const per = dist.unit === "points" ? "je Punktzahl" : "je Note";
  return `Balkendiagramm, ${dist.count} ${notenWord(dist.count)} ${per}${parts.length ? `. ${parts.join("; ")}` : ""}`;
}

/** A bar segment from y0 (bottom) up to y1, with rounded top corners when it's the topmost. */
function segmentPath(x, width, y0, y1, rounded) {
  const r = rounded ? Math.min(BAR_RADIUS, width / 2, y0 - y1) : 0;
  if (!r) return `M${round(x)},${round(y0)}V${round(y1)}H${round(x + width)}V${round(y0)}Z`;
  return (
    `M${round(x)},${round(y0)}V${round(y1 + r)}Q${round(x)},${round(y1)} ${round(x + r)},${round(y1)}` +
    `H${round(x + width - r)}Q${round(x + width)},${round(y1)} ${round(x + width)},${round(y1 + r)}V${round(y0)}Z`
  );
}

function legend(items) {
  const rows = items
    .map(([kind, label]) => `<li><span class="gc-swatch gc-swatch--${kind}" aria-hidden="true"></span>${escapeHtml(label)}</li>`)
    .join("");
  return `<ul class="gc-legend">${rows}</ul>`;
}

/** Stacked bars per Note (1–6) or per point (15 → 0): Klassenarbeiten/Klausuren below, Sonstige on top. */
export function barChart(dist, { kaLabel }) {
  const { buckets } = dist;
  const dense = buckets.length > 8;
  const plotWidth = BAR_WIDTH - AXIS_WIDTH;
  const plotHeight = BAR_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const slot = plotWidth / buckets.length;
  const barWidth = Math.min(30, dense ? slot - 6 : slot * 0.5);
  const { top, step } = niceAxis(Math.max(0, ...buckets.map((bucket) => bucket.total)));
  const y = (value) => PLOT_TOP + plotHeight * (1 - value / top);
  const base = y(0);

  let grid = "";
  for (let tick = 0; tick <= top; tick += step) {
    grid +=
      `<line class="gc-grid" x1="${AXIS_WIDTH}" x2="${BAR_WIDTH}" y1="${round(y(tick))}" y2="${round(y(tick))}"/>` +
      `<text class="gc-tick" x="${AXIS_WIDTH - 6}" y="${round(y(tick) + 4)}" text-anchor="end">${tick}</text>`;
  }

  const bars = buckets
    .map((bucket, i) => {
      const cx = AXIS_WIDTH + slot * i + slot / 2;
      const x = cx - barWidth / 2;
      let out = "";
      if (bucket.ka) out += `<path class="gc-bar gc-bar--ka" d="${segmentPath(x, barWidth, base, y(bucket.ka), !bucket.sl)}"/>`;
      if (bucket.sl) {
        const bottom = bucket.ka ? Math.max(y(bucket.ka) - SEGMENT_GAP, y(bucket.total)) : base;
        out += `<path class="gc-bar gc-bar--sl" d="${segmentPath(x, barWidth, bottom, y(bucket.total), true)}"/>`;
      }
      if (bucket.total) {
        out += `<text class="gc-total" x="${round(cx)}" y="${round(y(bucket.total) - 5)}" text-anchor="middle">${bucket.total}</text>`;
      }
      if (!dense || i % POINT_LABEL_EVERY === 0) {
        const cls = dense ? "gc-xlabel gc-xlabel--dense" : "gc-xlabel";
        out += `<text class="${cls}" x="${round(cx)}" y="${BAR_HEIGHT - 8}" text-anchor="middle">${escapeHtml(bucket.label)}</text>`;
      }
      return out;
    })
    .join("");

  const baseline = `<line class="gc-baseline" x1="${AXIS_WIDTH}" x2="${BAR_WIDTH}" y1="${round(base)}" y2="${round(base)}"/>`;
  const svg = `<svg class="gc-bars" viewBox="0 0 ${BAR_WIDTH} ${BAR_HEIGHT}" role="img" aria-label="${escapeHtml(barLabel(dist, kaLabel))}">${grid}${bars}${baseline}</svg>`;
  return `<div class="gc-chart">${svg}</div>${legend([
    ["ka", kaLabel],
    ["sl", SL_LABEL],
  ])}`;
}

function polar(radius, angle) {
  const c = DONUT_SIZE / 2;
  return `${round(c + radius * Math.cos(angle))},${round(c + radius * Math.sin(angle))}`;
}

function ringSegment(start, end) {
  const outer = DONUT_SIZE / 2 - 2;
  const inner = outer - DONUT_RING;
  const large = end - start > Math.PI ? 1 : 0;
  return (
    `M${polar(outer, start)}A${outer},${outer} 0 ${large} 1 ${polar(outer, end)}` +
    `L${polar(inner, end)}A${inner},${inner} 0 ${large} 0 ${polar(inner, start)}Z`
  );
}

/** Points take the colour of their Note, so the ramp stays six steps. */
function seqClass(bucket, unit) {
  return `gc-seq-${unit === "points" ? pointsToNote(bucket.value) : bucket.value}`;
}

function donutSegments(buckets, count, unit) {
  const filled = buckets.filter((bucket) => bucket.total);
  // An arc can't start and end on the same point, so a lone Note is a full circle.
  if (filled.length === 1) {
    const radius = DONUT_SIZE / 2 - 2 - DONUT_RING / 2;
    const c = DONUT_SIZE / 2;
    return `<circle class="gc-ring ${seqClass(filled[0], unit)}" cx="${c}" cy="${c}" r="${radius}" stroke-width="${DONUT_RING}"/>`;
  }
  let angle = -Math.PI / 2;
  return filled
    .map((bucket) => {
      const end = angle + 2 * Math.PI * (bucket.total / count);
      const path = `<path class="gc-seg ${seqClass(bucket, unit)}" d="${ringSegment(angle + DONUT_GAP / 2, end - DONUT_GAP / 2)}"/>`;
      angle = end;
      return path;
    })
    .join("");
}

/**
 * Share per Note 1–6 (or per point 15–0) as a donut with the count inside, and
 * a list of every value below. The colour footnote is left out under a
 * subject filter, as in the design.
 */
export function donutChart(dist, { kaLabel, footnote = true }) {
  const { buckets, count, unit } = dist;
  const per = unit === "points" ? "Punktzahl" : "Note";
  const c = DONUT_SIZE / 2;
  const svg =
    `<svg class="gc-donut" viewBox="0 0 ${DONUT_SIZE} ${DONUT_SIZE}" role="img" aria-label="Kreisdiagramm, Anteil je ${per}, ${count} ${notenWord(count)}">` +
    donutSegments(buckets, count, unit) +
    `<text class="gc-donut__count" x="${c}" y="${c + 4}" text-anchor="middle">${count}</text>` +
    `<text class="gc-donut__unit" x="${c}" y="${c + 24}" text-anchor="middle">${notenWord(count)}</text></svg>`;
  const rows = buckets
    .map((bucket) => {
      const swatch = bucket.total ? `gc-swatch ${seqClass(bucket, unit)}` : "gc-swatch gc-swatch--empty";
      return (
        `<li class="gc-share${bucket.total ? "" : " gc-share--empty"}"><span class="${swatch}" aria-hidden="true"></span>` +
        `<span>${escapeHtml(bucketName(unit, bucket, true))}</span><span class="gc-share__n">${bucket.total}×</span>` +
        `<span class="gc-share__pct">${formatPercent(bucket.share)}</span></li>`
      );
    })
    .join("");
  return `<div class="gc-pie">${svg}<ul class="gc-shares${unit === "points" ? " gc-shares--points" : ""}">${rows}</ul></div>${footnote ? `<p class="gc-note">${DONUT_NOTE[unit]} ${escapeHtml(kaLabel)} und sonstige Leistungen zusammen.</p>` : ""}`;
}

/** The same numbers as a table; the accessible alternative to both charts. */
export function distributionTable(dist, { kaLabel }) {
  const head = dist.unit === "points" ? "Punkte" : "Note";
  const rows = dist.buckets
    .map(
      (bucket) =>
        `<tr><th scope="row">${escapeHtml(bucket.label)}</th><td>${bucket.ka}</td><td>${bucket.sl}</td><td class="gc-table__total">${bucket.total}</td></tr>`,
    )
    .join("");
  return (
    `<table class="gc-table"><thead><tr><th scope="col">${head}</th><th scope="col">${escapeHtml(kaLabel)}</th>` +
    `<th scope="col">Sonstige</th><th scope="col">Gesamt</th></tr></thead><tbody>${rows}</tbody></table>`
  );
}

// The Noten › Diagramm charts as HTML strings: stacked bars, donut, table.
// They render the body only; the view owns the card, its title and toggles.
import { pointsToNote } from "../domain/grade-distribution.js";
import { escapeHtml } from "../util/dom.js";

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

const DONUT_WIDTH = 306;
const DONUT_OUTER = 64;
const DONUT_INNER = 38;
const DONUT_GAP = 0.035;
// Labels sit in a column left and right of the ring, at least one line apart.
const LABEL_LINE = 20;
const LABEL_EDGE = 14;
const LEADER_OUT = 12;
const LABEL_COLUMN = 26;
// "Kräftiger", not the design's "Dunkel": the dark theme flips the ramp so Note 1 stays strongest.
const DONUT_NOTE = { notes: "Kräftiger = besser.", points: "Kräftiger = besser (Farbe je Notenstufe)." };

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

/** "Note 2", "14 Punkte"; `short` is for the donut labels: "2", "14 P". */
function bucketName(unit, bucket, short = false) {
  if (unit !== "points") return short ? bucket.label : `Note ${bucket.label}`;
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

/** Points take the colour of their Note, so the ramp stays six steps. */
function seqClass(bucket, unit) {
  return `gc-seq-${unit === "points" ? pointsToNote(bucket.value) : bucket.value}`;
}

/** Each non-empty bucket as an arc, clockwise from the top, best value first. */
function donutSegments(buckets, count) {
  let angle = -Math.PI / 2;
  return buckets
    .filter((bucket) => bucket.total)
    .map((bucket) => {
      const start = angle;
      angle += (2 * Math.PI * bucket.total) / count;
      return { bucket, start, end: angle, mid: (start + angle) / 2 };
    });
}

/** Spreads one column's labels to at least LABEL_LINE apart, inside the box. */
function placeLabels(segments, cy, height) {
  for (const s of segments) s.labelY = cy + (DONUT_OUTER + 14) * Math.sin(s.mid);
  segments.sort((a, b) => a.labelY - b.labelY);
  segments.forEach((s, k) => {
    s.labelY = Math.max(s.labelY, k ? segments[k - 1].labelY + LABEL_LINE : LABEL_EDGE);
  });
  for (let k = segments.length - 1; k >= 0; k--) {
    const limit = k < segments.length - 1 ? segments[k + 1].labelY - LABEL_LINE : height - LABEL_EDGE;
    segments[k].labelY = Math.min(segments[k].labelY, limit);
  }
}

/**
 * Share per Note 1–6 (or per point 15–0) as a donut with the count inside.
 * Each segment has a hairline to a "10× 2" / "3× 14 P" label; no percentages, by design.
 */
export function donutChart(dist, { kaLabel }) {
  const { buckets, count, unit } = dist;
  const segments = donutSegments(buckets, count);
  const right = segments.filter((s) => Math.cos(s.mid) >= 0);
  const left = segments.filter((s) => Math.cos(s.mid) < 0);
  // The card grows with the taller label column.
  const height = Math.max(2 * DONUT_OUTER + 48, Math.max(right.length, left.length) * LABEL_LINE + 24);
  const cx = DONUT_WIDTH / 2;
  const cy = height / 2;
  placeLabels(right, cy, height);
  placeLabels(left, cy, height);
  const at = (radius, angle) => [round(cx + radius * Math.cos(angle)), round(cy + radius * Math.sin(angle))];

  const marks = segments
    .map((s) => {
      const color = seqClass(s.bucket, unit);
      let shape;
      if (segments.length === 1) {
        // An arc can't start and end on the same point, so a lone value is a full circle.
        shape = `<circle class="gc-ring ${color}" cx="${cx}" cy="${round(cy)}" r="${(DONUT_OUTER + DONUT_INNER) / 2}" stroke-width="${DONUT_OUTER - DONUT_INNER}"/>`;
      } else {
        const a = s.start + DONUT_GAP / 2;
        const b = s.end - DONUT_GAP / 2;
        const large = b - a > Math.PI ? 1 : 0;
        shape =
          `<path class="gc-seg ${color}" d="M${at(DONUT_OUTER, a)}A${DONUT_OUTER},${DONUT_OUTER} 0 ${large} 1 ${at(DONUT_OUTER, b)}` +
          `L${at(DONUT_INNER, b)}A${DONUT_INNER},${DONUT_INNER} 0 ${large} 0 ${at(DONUT_INNER, a)}Z"/>`;
      }
      const side = Math.cos(s.mid) >= 0 ? 1 : -1;
      const columnX = cx + side * (DONUT_OUTER + LABEL_COLUMN);
      const y = round(s.labelY);
      const leader =
        `<polyline class="gc-leader" points="${at(DONUT_OUTER + 3, s.mid)} ${at(DONUT_OUTER + LEADER_OUT, s.mid)} ` +
        `${columnX},${y} ${columnX + side * 4},${y}"/>`;
      const label =
        `<text class="gc-label" x="${columnX + side * 7}" y="${round(y + 4)}" text-anchor="${side > 0 ? "start" : "end"}">` +
        `<tspan class="gc-label__n">${s.bucket.total}×</tspan> <tspan class="gc-label__value">${escapeHtml(bucketName(unit, s.bucket, true))}</tspan></text>`;
      return shape + leader + label;
    })
    .join("");

  const per = unit === "points" ? "Punktzahl" : "Note";
  const summary = segments.map((s) => `${s.bucket.total}-mal ${bucketName(unit, s.bucket)}`).join("; ");
  const svg =
    `<svg class="gc-donut" viewBox="0 0 ${DONUT_WIDTH} ${height}" role="img" ` +
    `aria-label="${escapeHtml(`Kreisdiagramm, Anteil je ${per}, ${count} ${notenWord(count)}${summary ? `. ${summary}` : ""}`)}">` +
    marks +
    `<text class="gc-donut__count" x="${cx}" y="${round(cy + 6)}" text-anchor="middle">${count}</text>` +
    `<text class="gc-donut__unit" x="${cx}" y="${round(cy + 22)}" text-anchor="middle">${notenWord(count)}</text></svg>`;
  return `<div class="gc-chart">${svg}</div><p class="gc-note">${DONUT_NOTE[unit]} ${escapeHtml(kaLabel)} und sonstige Leistungen zusammen.</p>`;
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

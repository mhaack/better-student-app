import { ensureContext } from "../state/session.js";
import { getFerienData } from "../data/ferien.js";
import { ferienStem } from "../domain/holidays.js";
import { escapeHtml } from "../util/dom.js";
import { formatFullDate, formatWeekdayDate } from "../util/format.js";
import { renderSkeleton, renderErrorState, bindErrorState, renderEmptyState } from "../components/states.js";
import { nextCard, relativeDays } from "../components/next-card.js";

/** "Mo 06.10.25 – Fr 17.10.25 · 10 Schultage frei" */
export function ferienRangeLabel(block) {
  const days = block.schoolDays ? ` · ${block.schoolDays} Schultage frei` : "";
  return `${formatWeekdayDate(block.from)} – ${formatWeekdayDate(block.to)}${days}`;
}

function ferienListRow(block) {
  const range =
    block.from === block.to ? formatFullDate(block.from) : `${formatFullDate(block.from)} – ${formatFullDate(block.to)}`;
  return `
    <div class="ferien-row">
      <div class="ferien-row-name">${escapeHtml(ferienStem(block.name))}</div>
      <div class="ferien-row-range">${escapeHtml(range)}</div>
    </div>`;
}

function freierTagRow(block) {
  const range =
    block.from === block.to
      ? formatWeekdayDate(block.from)
      : `${formatWeekdayDate(block.from)} – ${formatWeekdayDate(block.to)}`;
  return `
    <div class="ferien-row">
      <div class="ferien-row-name">${escapeHtml(block.name || "Schulfrei")}</div>
      <div class="ferien-row-range">${escapeHtml(range)}</div>
    </div>`;
}

function ferienBody(ferien) {
  if (!ferien.ferien.length && !ferien.freieTage.length) {
    return renderEmptyState("Keine Ferientermine hinterlegt.");
  }

  const next = ferien.next
    ? nextCard(
        "Als nächstes",
        ferien.next.name,
        relativeDays(ferien.next.from),
        `<div class="next-card-meta">${escapeHtml(ferienRangeLabel(ferien.next))}</div>`
      )
    : "";

  const ferienList = ferien.ferien.length
    ? `<div class="eyebrow">Ferien</div>
       ${ferien.ferien.map(ferienListRow).join("")}`
    : "";

  const freieTage = ferien.freieTage.length
    ? `<div class="eyebrow freie-tage-title">Einzelne freie Tage</div>
       ${ferien.freieTage.map(freierTagRow).join("")}`
    : "";

  return `${next}<div class="ferien-list">${ferienList}${freieTage}</div>`;
}

/** Sub-page of Mehr: the next break and the whole school year's breaks and free days. */
export async function renderFerien(container) {
  container.innerHTML = `
    <div class="view view--detail">
      <a class="back-link" href="#/mehr">‹ Mehr</a>
      <div>
        <h1 class="view-title">Ferien</h1>
        <div class="view-subtitle" id="ferien-subtitle"></div>
      </div>
      <div id="ferien-body" class="view-body">${renderSkeleton()}</div>
    </div>`;

  const body = container.querySelector("#ferien-body");
  try {
    const ferien = await getFerienData(await ensureContext());
    container.querySelector("#ferien-subtitle").textContent = ferien.yearLabel;
    body.innerHTML = ferienBody(ferien);
  } catch (err) {
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

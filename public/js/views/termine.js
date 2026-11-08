import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import {
  countByCategory,
  getTermineData,
  termineList,
  termineSubtitle,
  upcomingBlocks,
} from "../data/termine.js";
import { getFerienData } from "../data/ferien.js";
import { escapeHtml } from "../util/dom.js";
import { formatMonthYear, formatWeekday, formatWeekdayDate } from "../util/format.js";
import { renderSkeleton, renderErrorState, bindErrorState, renderEmptyState } from "../components/states.js";
import { openDetailSheet, bindActivate, markTruncatedRows } from "../components/detail-sheet.js";
import { nextCard, relativeDays } from "../components/next-card.js";

const TABS = [
  ["all", "Alle"],
  ["exam", "Arbeiten & Tests"],
  ["hw", "Hausaufgaben"],
  ["ferien", "Ferien"],
  ["other", "Sonstiges"],
];

function examNextCard(exam) {
  const line = [formatWeekdayDate(exam.date), exam.typeName, exam.periodLabel].filter(Boolean).join(" · ");
  return nextCard(
    "Als nächstes",
    exam.subject ?? exam.subjectShort ?? "",
    relativeDays(exam.date),
    `<div class="next-card-meta">${escapeHtml(line)}</div>
     ${exam.text ? `<div class="next-card-body">${escapeHtml(exam.text)}</div>` : ""}`
  );
}

/** "19." over "Fr": the left column of every list row. */
function dayColumn(iso) {
  return `
    <div class="date-row-day">
      <div class="date-row-number">${Number(iso.slice(8, 10))}.</div>
      <div class="date-row-weekday">${escapeHtml(formatWeekday(iso))}</div>
    </div>`;
}

/** Title (and label), then the kind ("Klassenarbeit · 5.–6. Stunde"), then the clamped detail. */
function rowBody(title, kind, detail, tag = "") {
  return `
    <div class="date-row-body">
      <div class="date-row-head">
        <div class="date-row-title">${escapeHtml(title)}</div>
        ${tag ? `<span class="frei-tag">${escapeHtml(tag)}</span>` : ""}
      </div>
      ${kind ? `<div class="date-row-detail">${escapeHtml(kind)}</div>` : ""}
      ${detail ? `<div class="date-row-note">${escapeHtml(detail)}</div>` : ""}
    </div>`;
}

function terminRow(termin, index) {
  const kind = [termin.typeName, termin.periodLabel].filter(Boolean).join(" · ");
  return `
    <div class="date-row" data-termin-index="${index}">
      ${dayColumn(termin.date)}
      ${rowBody(termin.subject ?? termin.subjectShort ?? "", kind, termin.text)}
    </div>`;
}

/** A break or single free day: a peach card labelled FERIEN or FREI. */
function ferienRow(block) {
  const kind = block.isFerien
    ? `Ferien · bis ${formatWeekdayDate(block.to)}`
    : block.from === block.to
      ? "Freier Tag"
      : `Freie Tage · bis ${formatWeekdayDate(block.to)}`;
  const detail = block.isFerien ? (block.schoolDays ? `${block.schoolDays} Schultage frei` : "") : "kein Unterricht";
  return `
    <div class="date-row date-row--frei">
      ${dayColumn(block.from)}
      ${rowBody(block.name || "Schulfrei", kind, detail, block.isFerien ? "Ferien" : "Frei")}
    </div>`;
}

/** The full entry behind a row whose Klassenbuch text was clamped. */
function openTerminDetail(container, termin) {
  openDetailSheet(container, {
    eyebrow: termin.typeName,
    title: termin.subject ?? termin.subjectShort ?? "",
    subtitle: [formatWeekdayDate(termin.date), termin.periodLabel].filter(Boolean).join(" · "),
    note: termin.text,
  });
}

/** Second level under the dark card; empty tabs are left out, Alle always stays. */
function filterTabs(active, counts, scale) {
  const buttons = TABS.filter(([key]) => key === "all" || counts[key] > 0).map(([key, label]) => {
    const text = key === "exam" && scale === "points_0_15" ? "Klausuren & Tests" : label;
    return `<button type="button" class="termine-tab" data-filter="${key}" aria-pressed="${key === active}">${escapeHtml(text)}<span class="termine-tab-count">${counts[key]}</span></button>`;
  }).join("");
  return `<div class="termine-tabs-wrap"><div class="termine-tabs" role="group" aria-label="Filter">${buttons}</div></div>`;
}

/** Scrolls the active tab fully clear of the right-hand fade. */
function revealActiveTab(body) {
  const tabs = body.querySelector(".termine-tabs");
  const active = tabs?.querySelector('[aria-pressed="true"]');
  if (!active) return;
  tabs.scrollLeft = Math.max(0, active.offsetLeft + active.offsetWidth + 40 - tabs.clientWidth);
}

/** @param {Array<{ date: string, termin?: object, ferien?: object }>} items */
function termineBody(nextExam, counts, items, filter, scale, emptyText) {
  let currentMonth = "";
  const rows = items
    .map((item, index) => {
      const label = formatMonthYear(item.date);
      const heading = label === currentMonth ? "" : `<div class="eyebrow">${escapeHtml(label)}</div>`;
      currentMonth = label;
      return heading + (item.ferien ? ferienRow(item.ferien) : terminRow(item.termin, index));
    })
    .join("");

  // The next exam stays in the list too, by design.
  return `${nextExam ? examNextCard(nextExam) : ""}
    ${filterTabs(filter, counts, scale)}
    ${rows ? `<div class="date-list">${rows}</div>` : renderEmptyState(emptyText)}`;
}

export async function renderTermine(container) {
  // Deliberately not persisted.
  let filter = "all";

  container.innerHTML = `
    <div class="view">
      <div>
        <h1 class="view-title">Termine</h1>
        <div class="view-subtitle" id="termine-subtitle">…</div>
      </div>
      <div id="termine-body" class="view-body">${renderSkeleton()}</div>
    </div>`;

  const subtitle = container.querySelector("#termine-subtitle");
  const body = container.querySelector("#termine-body");
  let items = [];
  let render = () => {};

  // Bound once: #termine-body survives re-renders.
  bindActivate(body, "[data-termin-index]", (row) => {
    const termin = items[Number(row.dataset.terminIndex)]?.termin;
    if (termin) openTerminDetail(container, termin);
  });
  body.addEventListener("click", (event) => {
    const target = event.target.closest("[data-filter]");
    if (!target || target.dataset.filter === filter) return;
    filter = target.dataset.filter;
    render();
  });

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();
    const [termine, ferien] = await Promise.all([
      getTermineData(studentId, { yearEnd: context.year?.to }),
      getFerienData(context),
    ]);

    const { scale } = context;
    const nextFerien = ferien.next ?? null;
    // Every tab covers the whole school year; the subtitles look closer.
    const { entries } = termine;
    // The Ferien tab looks ahead only.
    const ferienAhead = upcomingBlocks(ferien.ferien, termine.today);
    const freieTageAhead = upcomingBlocks(ferien.freieTage, termine.today);
    const counts = countByCategory(entries, ferienAhead.length + freieTageAhead.length);
    const listOptions = { nextFerien, ferien: ferienAhead, freieTage: freieTageAhead };
    const emptyText = nextFerien ? `Nichts eingetragen bis zu den ${nextFerien.name}.` : "Nichts eingetragen.";
    const subtitleOptions = {
      nextFerien,
      scale,
      ferienCount: ferienAhead.length,
      freieTageCount: freieTageAhead.length,
      yearLabel: ferien.yearLabel,
    };

    render = () => {
      items = termineList(entries, filter, listOptions);
      subtitle.textContent = termineSubtitle(entries, filter, subtitleOptions);
      body.innerHTML = termineBody(termine.nextExam, counts, items, filter, scale, emptyText);
      markTruncatedRows(body, "[data-termin-index]", ".date-row-note");
      revealActiveTab(body);
    };

    render();
  } catch (err) {
    subtitle.textContent = "";
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getTermineData } from "../data/termine.js";
import { getFerienData } from "../data/ferien.js";
import { ferienStem } from "../domain/holidays.js";
import { escapeHtml } from "../util/dom.js";
import { daysUntil } from "../util/format.js";
import { renderSkeleton, renderErrorState, bindErrorState, renderEmptyState } from "../components/states.js";

const WEEKDAY_SHORT = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

/** "Fr 19.9." — the design's compact date. */
function shortDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return `${WEEKDAY_SHORT.format(date).replace(".", "")} ${date.getDate()}.${date.getMonth() + 1}.`;
}

/** "6.10." within the current year, "6.1.2027" once it crosses over. */
function numericDate(iso, includeYear) {
  const date = new Date(`${iso}T00:00:00`);
  const base = `${date.getDate()}.${date.getMonth() + 1}.`;
  return includeYear ? `${base}${date.getFullYear()}` : base;
}

/** "heute" / "morgen" / "in 2 Tagen" — the dark card's right-hand note. */
function relativeDays(iso) {
  const days = daysUntil(iso);
  if (days === null) return "";
  if (days < 0) return "vorbei";
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

function nextCard(eyebrow, title, meta, body) {
  return `
    <div class="next-card">
      <div class="next-card-eyebrow">${escapeHtml(eyebrow)}</div>
      <div class="next-card-head">
        <div class="next-card-title">${escapeHtml(title)}</div>
        <div class="next-card-when">${escapeHtml(meta)}</div>
      </div>
      ${body}
    </div>`;
}

function examNextCard(exam) {
  const line = [shortDate(exam.date), exam.periodLabel, exam.typeName].filter(Boolean).join(" · ");
  return nextCard(
    "Als nächstes",
    exam.subject ?? exam.subjectShort ?? "",
    relativeDays(exam.date),
    `<div class="next-card-meta">${escapeHtml(line)}</div>
     ${exam.text ? `<div class="next-card-body">${escapeHtml(exam.text)}</div>` : ""}`
  );
}

function examRow(exam) {
  const date = new Date(`${exam.date}T00:00:00`);
  const detail = [exam.typeName, exam.periodLabel].filter(Boolean).join(" · ");
  return `
    <div class="date-row">
      <div class="date-row-day">
        <div class="date-row-number">${date.getDate()}.</div>
        <div class="date-row-weekday">${escapeHtml(WEEKDAY_SHORT.format(date).replace(".", ""))}</div>
      </div>
      <div class="date-row-body">
        <div class="date-row-title">${escapeHtml(exam.subject ?? exam.subjectShort ?? "")}</div>
        ${detail ? `<div class="date-row-detail">${escapeHtml(detail)}</div>` : ""}
        ${exam.text ? `<div class="date-row-note">${escapeHtml(exam.text)}</div>` : ""}
      </div>
    </div>`;
}

/** The greyed-out Ferien row that closes the Termine list. */
function ferienRow(block) {
  const date = new Date(`${block.from}T00:00:00`);
  return `
    <div class="date-row date-row--muted">
      <div class="date-row-day">
        <div class="date-row-number">${date.getDate()}.</div>
        <div class="date-row-weekday">${escapeHtml(WEEKDAY_SHORT.format(date).replace(".", ""))}</div>
      </div>
      <div class="date-row-body">
        <div class="date-row-title">${escapeHtml(block.name)}</div>
        <div class="date-row-detail">bis ${escapeHtml(shortDate(block.to))}</div>
      </div>
    </div>`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("de-DE", { month: "long" });

/**
 * Exams and holidays share one chronological stream. The design puts the
 * break in the list as an orientation point ("this Klausur is the week after
 * Herbstferien"), which only reads correctly if it sits in date order rather
 * than being appended at the end.
 */
function termineBody(termine, ferien) {
  if (!termine.count) {
    return renderEmptyState("Keine Klassenarbeiten oder Tests eingetragen.");
  }

  const lastExam = termine.exams.at(-1)?.date ?? "";
  const entries = [
    ...termine.exams.map((exam) => ({ date: exam.date, html: examRow(exam) })),
    // Only breaks the exam list actually spans; a holiday after the last exam
    // would dangle with nothing to orient.
    ...(ferien?.ferien ?? [])
      .filter((block) => block.from > termine.exams[0].date && block.from < lastExam)
      .map((block) => ({ date: block.from, html: ferienRow(block) })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  let currentMonth = "";
  const rows = entries
    .map((entry) => {
      const label = MONTH_FORMAT.format(new Date(`${entry.date}T00:00:00`));
      const heading = label === currentMonth ? "" : `<div class="eyebrow">${escapeHtml(label)}</div>`;
      currentMonth = label;
      return heading + entry.html;
    })
    .join("");

  // The design keeps the next exam in the list as well as in the card above,
  // so this is a repeat, not a move.
  return `${examNextCard(termine.exams[0])}<div class="date-list">${rows}</div>`;
}

function ferienListRow(block) {
  // A one-day break ("Pfingsten 7.5.2027") must not read as a range.
  // The year is shown on the end date, and on the start only when the two
  // differ — a break crossing New Year has to say so on both sides.
  const crossesYear = block.from.slice(0, 4) !== block.to.slice(0, 4);
  const range =
    block.from === block.to
      ? numericDate(block.to, true)
      : `${numericDate(block.from, crossesYear)} – ${numericDate(block.to, true)}`;
  return `
    <div class="ferien-row">
      <div class="ferien-row-name">${escapeHtml(ferienStem(block.name))}</div>
      <div class="ferien-row-range">${escapeHtml(range)}</div>
    </div>`;
}

function freierTagRow(block) {
  const label = block.name || "Schulfrei";
  const range =
    block.from === block.to
      ? shortDate(block.from)
      : `${shortDate(block.from)} – ${shortDate(block.to)}`;
  return `
    <div class="ferien-row ferien-row--small">
      <div class="ferien-row-name">${escapeHtml(label)}</div>
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
        `<div class="next-card-meta">${escapeHtml(
          `${shortDate(ferien.next.from)} – ${shortDate(ferien.next.to)} · ${ferien.next.schoolDays} Schultage frei`
        )}</div>`
      )
    : "";

  const ferienList = ferien.ferien.length
    ? `<div class="eyebrow">Ferien</div>
       ${ferien.ferien.map(ferienListRow).join("")}`
    : "";

  const freieTage = ferien.freieTage.length
    ? `<div class="eyebrow" style="padding-top:3px">Einzelne freie Tage</div>
       ${ferien.freieTage.map(freierTagRow).join("")}`
    : "";

  return `${next}<div class="ferien-list">${ferienList}${freieTage}</div>`;
}

function segmentedControl(active) {
  const tab = (id, label) => `
    <button type="button" role="tab" class="segment${active === id ? " segment--active" : ""}"
            data-segment="${id}" aria-selected="${active === id}">${label}</button>`;
  return `
    <div class="segmented" role="tablist" aria-label="Ansicht">
      ${tab("termine", "Termine")}${tab("ferien", "Ferien")}
    </div>`;
}

export async function renderTermine(container) {
  // View-local, deliberately not persisted: which segment you looked at last
  // is a glance, not a preference.
  let segment = "termine";

  container.innerHTML = `
    <div class="view">
      <div>
        <h1 class="view-title">Termine</h1>
        <div class="view-subtitle" id="termine-subtitle">…</div>
      </div>
      <div id="termine-segments"></div>
      <div id="termine-body" class="view-body">${renderSkeleton()}</div>
    </div>`;

  const subtitle = container.querySelector("#termine-subtitle");
  const segments = container.querySelector("#termine-segments");
  const body = container.querySelector("#termine-body");

  try {
    const studentId = getSelectedStudentId();
    const context = await ensureContext();

    // Both segments load once, in parallel — switching never hits the network.
    const [termine, ferien] = await Promise.all([
      getTermineData(studentId, { yearEnd: context.year?.to }),
      getFerienData(context),
    ]);

    const render = () => {
      segments.innerHTML = segmentedControl(segment);
      if (segment === "termine") {
        // "4 Termine bis zu den Herbstferien" counts the exams before that
        // break, not every exam on file — the phrase has to be true.
        const upTo = ferien.next
          ? termine.exams.filter((e) => e.date < ferien.next.from).length
          : termine.count;
        const until = ferien.next ? ` bis zu den ${ferien.next.name}` : " in diesem Schuljahr";
        subtitle.textContent = termine.count
          ? `${upTo} ${upTo === 1 ? "Termin" : "Termine"}${until}`
          : "Keine Termine";
        body.innerHTML = termineBody(termine, ferien);
      } else {
        subtitle.textContent = ferien.yearLabel || "Ferien";
        body.innerHTML = ferienBody(ferien);
      }

      for (const button of segments.querySelectorAll("[data-segment]")) {
        button.addEventListener("click", () => {
          if (segment === button.dataset.segment) return;
          segment = button.dataset.segment;
          render();
        });
      }
    };

    render();
  } catch (err) {
    segments.innerHTML = "";
    subtitle.textContent = "";
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

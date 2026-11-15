import { getSelectedStudentId } from "../state/auth-store.js";
import { ensureContext } from "../state/session.js";
import { getNotificationsData } from "../data/notifications.js";
import { escapeHtml } from "../util/dom.js";
import { formatFullDate, formatWeekdayDate } from "../util/format.js";
import { noticeCapsule, gradeValue } from "../components/grade-capsule.js";
import { ICONS } from "../components/icons.js";
import { renderSkeleton, renderErrorState, bindErrorState, renderEmptyState } from "../components/states.js";

const CARD_LABEL = { new: "Neue Note", changed: "Note geändert" };

const joinParts = (parts) => parts.filter(Boolean).join(" · ");

/** A link when the entry has a target, otherwise a plain block with the same look. */
function linkOrBlock(href, className, inner, label = "") {
  if (!href) return `<div class="${className}">${inner}</div>`;
  const aria = label ? ` aria-label="${escapeHtml(label)}"` : "";
  return `<a class="${className}" href="${escapeHtml(href)}"${aria}>${inner}</a>`;
}

function infoCard(item) {
  const label = joinParts(["Schulinfo", item.sender]);
  const inner = `
    <span class="nt-info-icon" aria-hidden="true">${ICONS.megaphone}</span>
    <span class="nt-card__text">
      <span class="nt-card__label">${escapeHtml(label)}</span>
      <span class="nt-card__subject">${escapeHtml(item.title ?? "")}</span>
    </span>
    <span class="nt-chevron" aria-hidden="true">›</span>`;
  return linkOrBlock(item.href, "nt-card", inner);
}

function gradeMeta(item) {
  const { grade } = item;
  if (item.kind === "new") return escapeHtml(joinParts([item.collectionName, grade?.teacher]));
  const previous = grade?.previous ? `vorher <s>${escapeHtml(gradeValue(grade.previous))}</s>` : "";
  const given = grade?.givenAt ? `Note vom ${formatFullDate(grade.givenAt)}` : "";
  return joinParts([escapeHtml(item.collectionName ?? ""), given, previous]);
}

function gradeCard(item) {
  const { grade } = item;
  const value = grade ? gradeValue(grade) : "";
  const previous = item.kind === "changed" && grade?.previous ? `vorher ${gradeValue(grade.previous)}` : "";
  const label = joinParts([CARD_LABEL[item.kind], item.subjectName, item.collectionName]);
  const inner = `
    <span class="nt-card__text">
      <span class="nt-card__label nt-card__label--${item.kind}">${CARD_LABEL[item.kind]}</span>
      <span class="nt-card__subject">${escapeHtml(item.subjectName ?? "")}</span>
      <span class="nt-card__meta">${gradeMeta(item)}</span>
    </span>
    ${grade ? noticeCapsule(grade, item.kind) : ""}`;
  return linkOrBlock(item.href, "nt-card", inner, [label + (value ? `: ${value}` : ""), previous].filter(Boolean).join(", "));
}

function readRow(item) {
  const [name, kind] = item.kind === "info" ? [item.title, item.sender] : [item.subjectName, item.collectionName];
  const value =
    item.kind === "info"
      ? '<span class="nt-row__info">Info</span>'
      : `<span class="nt-row__value">${escapeHtml(item.grade ? gradeValue(item.grade) : "")}</span>`;
  const inner = `
    <span class="nt-row__text">${escapeHtml(name ?? "")}${kind ? ` <span class="nt-row__kind">· ${escapeHtml(kind)}</span>` : ""}</span>
    <span class="nt-row__date">${escapeHtml(formatWeekdayDate(item.createdAt))}</span>
    ${value}`;
  return linkOrBlock(item.href, "nt-row", inner);
}

function unreadZone(unread) {
  if (unread.length === 0) return "";
  return `
    <section class="nt-zone">
      <h2 class="eyebrow nt-eyebrow--unread">Ungelesen · ${unread.length}</h2>
      ${unread.map((item) => (item.kind === "info" ? infoCard(item) : gradeCard(item))).join("")}
    </section>`;
}

function readZone(read) {
  if (read.length === 0) return "";
  return `
    <section class="nt-zone">
      <h2 class="eyebrow">Gelesen</h2>
      <div class="nt-rows">${read.map(readRow).join("")}</div>
    </section>`;
}

export async function renderBenachrichtigungen(container) {
  container.innerHTML = `
    <div class="view view--detail">
      <a class="back-link" href="#/heute">‹ Heute</a>
      <div>
        <h1 class="view-title nt-title">Benachrichtigungen</h1>
        <div class="nt-subrow">
          <span class="nt-count" id="nt-count"></span>
          <button type="button" class="nt-all-read" id="nt-all-read" disabled>Alle als gelesen markieren</button>
        </div>
      </div>
      <div id="nt-body" class="view-body">${renderSkeleton()}</div>
    </div>`;

  const body = container.querySelector("#nt-body");
  try {
    const { scale } = await ensureContext();
    const { unread, read, unreadCount } = await getNotificationsData(getSelectedStudentId(), scale);
    container.querySelector("#nt-count").textContent = unreadCount ? `${unreadCount} ungelesen` : "Alles gelesen";
    // Enabled but inert for now: marking read comes with a later step.
    container.querySelector("#nt-all-read").disabled = unreadCount === 0;
    body.innerHTML =
      unread.length + read.length === 0
        ? renderEmptyState("Keine Benachrichtigungen.")
        : `${unreadZone(unread)}${readZone(read)}`;
  } catch (err) {
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

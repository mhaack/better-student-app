import { getMitteilungenData } from "../data/mitteilungen.js";
import { respondToAnnouncement } from "../data/repository.js";
import { renderMessage } from "../domain/markdown.js";
import { escapeHtml } from "../util/dom.js";
import { formatFullDate } from "../util/format.js";
import { ICONS } from "../components/icons.js";
import { renderSkeleton, renderErrorState, bindErrorState, renderEmptyState } from "../components/states.js";

/** One tappable announcement row — shared by this list and Heute's section. */
export function mitteilungRow(item, dateLabel = formatFullDate(item.date)) {
  const meta = [dateLabel, item.type].filter(Boolean).map(escapeHtml).join(" · ");
  return `
    <a class="mt-row" href="#/mehr/mitteilungen/${item.id}">
      <span class="${item.read ? "mt-dot mt-dot--read" : "mt-dot"}" ${item.read ? 'aria-hidden="true"' : 'role="img" aria-label="ungelesen"'}></span>
      <div class="mt-text">
        <div class="${item.read ? "mt-title" : "mt-title mt-title--unread"}">${escapeHtml(item.title)}</div>
        ${item.preview ? `<div class="mt-preview">${escapeHtml(item.preview)}</div>` : ""}
        <div class="mt-meta">
          ${meta}
          ${item.attachments.length ? `<span class="mt-clip" role="img" aria-label="mit Anhang">${ICONS.paperclip}</span>` : ""}
        </div>
      </div>
    </a>`;
}

export async function renderMitteilungen(container) {
  container.innerHTML = `
    <div class="view view--detail">
      <a class="back-link" href="#/mehr">‹ Mehr</a>
      <h1 class="view-title">Mitteilungen</h1>
      <div id="mt-body" class="view-body">${renderSkeleton()}</div>
    </div>`;

  const body = container.querySelector("#mt-body");
  try {
    const { items } = await getMitteilungenData();
    body.innerHTML = items.length
      ? `<div class="mt-list">${items.map((item) => mitteilungRow(item)).join("")}</div>`
      : renderEmptyState("Keine Mitteilungen.");
  } catch (err) {
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

function attachmentRow(attachment) {
  // A plain navigation to beste.schule's web route: the app can't fetch the
  // file itself (the S3 bucket behind the API sends no CORS headers — see
  // docs/plans/mitteilungen.md), and a navigation needs no CSP change.
  return `
    <a class="card mt-attachment" href="${escapeHtml(attachment.url)}" target="_blank" rel="noopener noreferrer">
      <span class="mt-attachment-icon">${ICONS.fileText}</span>
      <div class="mt-text">
        <div class="mt-attachment-name">${escapeHtml(attachment.name)}</div>
        <div class="mt-meta">Öffnet in beste.schule</div>
      </div>
      <span class="mt-chevron" aria-hidden="true">›</span>
    </a>`;
}

/** Where a letter lives on beste.schule — the fallback whenever we can't confirm in-app. */
function webUrl(id) {
  return `https://beste.schule/school/announcements/${id}`;
}

/**
 * The Lesebestätigung block above the letter: ours to send, already sent, or —
 * when `/api/me` didn't answer and we don't know which role we'd be confirming
 * as — a pointer to beste.schule, which is what this screen did before it
 * could write. Nothing at all when the letter asks for no confirmation.
 */
function confirmCard(item) {
  if (item.canConfirm) {
    return `
      <div class="card card--accent mt-confirm" id="mt-confirm">
        <div>Für diese Mitteilung wird eine Lesebestätigung erwartet.</div>
        <button type="button" class="button-primary" id="mt-confirm-button">Gelesen bestätigen</button>
      </div>`;
  }
  if (!item.needsConfirmation) return "";
  if (item.read) {
    return `<div class="card mt-confirm mt-confirm--done">✓ Lesebestätigung gesendet.</div>`;
  }
  return `
    <div class="card card--accent mt-confirm">
      <a href="${webUrl(item.id)}" target="_blank" rel="noopener noreferrer">Lesebestätigung in beste.schule</a>
    </div>`;
}

/**
 * Sends the confirmation and re-renders from the refetched list.
 *
 * A rejection isn't predicted client-side. `write_from`/`write_to` looked
 * like the window in which responding is allowed, but a confirmation sent a
 * week after one closed still returned 200 — so we know what those dates
 * aren't, not what they are. Any failure falls back to the beste.schule link.
 */
function bindConfirm(container, body, item) {
  const button = body.querySelector("#mt-confirm-button");
  if (!button) return;

  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Wird gesendet…";
    try {
      await respondToAnnouncement(item.id);
      await renderMitteilung(container, { id: item.id });
    } catch {
      const card = body.querySelector("#mt-confirm");
      if (!card) return;
      card.innerHTML = `
        <div>Die Bestätigung konnte nicht gesendet werden.</div>
        <a href="${webUrl(item.id)}" target="_blank" rel="noopener noreferrer">In beste.schule bestätigen</a>`;
    }
  });
}

export async function renderMitteilung(container, { id }) {
  container.innerHTML = `
    <div class="view view--detail">
      <a class="back-link" href="#/mehr/mitteilungen">‹ Mitteilungen</a>
      <div id="mt-detail" class="view-body">${renderSkeleton(8)}</div>
    </div>`;

  const body = container.querySelector("#mt-detail");
  try {
    const { items } = await getMitteilungenData();
    const item = items.find((i) => i.id === Number(id));
    if (!item) {
      // The API only lists announcements inside their visibility window, so
      // an old link (e.g. from a bookmark) can point at one that's gone.
      body.innerHTML = renderEmptyState("Diese Mitteilung ist nicht mehr verfügbar.");
      return;
    }

    const meta = [formatFullDate(item.date), item.type, item.author].filter(Boolean).map(escapeHtml).join(" · ");
    body.innerHTML = `
      <div>
        <h1 class="mt-detail-title">${escapeHtml(item.title)}</h1>
        <div class="view-subtitle">${meta}</div>
      </div>
      ${confirmCard(item)}
      <div class="mt-message">${renderMessage(item.body)}</div>
      ${
        item.attachments.length
          ? `<div class="section" style="gap:10px">
               <div class="eyebrow">${item.attachments.length === 1 ? "Anhang" : "Anhänge"}</div>
               ${item.attachments.map(attachmentRow).join("")}
             </div>`
          : ""
      }`;

    bindConfirm(container, body, item);
  } catch (err) {
    body.innerHTML = renderErrorState(escapeHtml(err.message));
    bindErrorState(container);
  }
}

// The small Markdown subset beste.schule announcement bodies actually use
// (docs/api-notes.md): paragraphs, line breaks, **bold** and links — links
// often relative to beste.schule. Everything else stays literal text.
//
// Safety model: nothing from the API is ever parsed as HTML. The raw text is
// split into tokens first, every piece of text is escaped on its own, and
// the only tags emitted are the fixed ones built here. A link survives only
// if it resolves to http(s); anything else is shown as the literal text.
import { escapeHtml } from "../util/dom.js";

const BASE_URL = "https://beste.schule";
const LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
// One pass over the inline syntax: [text](href) | **bold** | bare URL.
const INLINE = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+?)\*\*|(https?:\/\/[^\s<>"'()[\]]+)/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const ATTACHMENT_PATH = /^\/attachments\/(\d+)$/;
const SALUTATION = /^(liebe|lieber|sehr geehrte|hallo|guten tag)\b.*,$/i;
const PREVIEW_LENGTH = 160;

/** The absolute URL for an http(s) link, relative ones against beste.schule; null for anything else. */
function safeUrl(href) {
  try {
    const url = new URL(href, BASE_URL);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function linkHtml(url, textHtml) {
  return `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener noreferrer">${textHtml}</a>`;
}

function renderInline(text) {
  let html = "";
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const [whole, linkText, href, bold, bareUrl] = match;
    html += escapeHtml(text.slice(last, match.index));
    last = match.index + whole.length;

    if (linkText !== undefined) {
      const url = safeUrl(href);
      html += url ? linkHtml(url, renderInline(linkText)) : escapeHtml(whole);
    } else if (bold !== undefined) {
      html += `<strong>${renderInline(bold)}</strong>`;
    } else {
      // "…/info." — the sentence's full stop isn't part of the URL.
      const trailing = bareUrl.match(TRAILING_PUNCTUATION)?.[0] ?? "";
      const urlText = bareUrl.slice(0, bareUrl.length - trailing.length);
      const url = safeUrl(urlText);
      html += (url ? linkHtml(url, escapeHtml(urlText)) : escapeHtml(urlText)) + escapeHtml(trailing);
    }
  }
  return html + escapeHtml(text.slice(last));
}

function paragraphs(markdown) {
  return String(markdown ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Announcement Markdown → safe HTML: <p>, <br>, <strong> and vetted <a> only. */
export function renderMessage(markdown) {
  return paragraphs(markdown)
    .map((p) => `<p>${p.split(/[ \t]*\n/).map(renderInline).join("<br>")}</p>`)
    .join("");
}

/**
 * Attachments aren't a field of their own — they're links to
 * /attachments/:id inside the body. Pull them out so the detail screen can
 * show them as rows instead of a link in the middle of the letter.
 */
export function splitAttachments(markdown) {
  const attachments = [];
  const body = String(markdown ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(LINK, (whole, text, href) => {
      const url = safeUrl(href);
      const id = url?.origin === BASE_URL ? url.pathname.match(ATTACHMENT_PATH)?.[1] : null;
      if (!id) return whole;
      if (!attachments.some((a) => a.id === Number(id))) {
        attachments.push({ id: Number(id), name: text, url: `${BASE_URL}/attachments/${id}` });
      }
      return "";
    })
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { body, attachments };
}

/**
 * One line of plain text for list rows. Letters open with "Liebe Eltern," —
 * true of nearly all of them, so it says nothing; the preview starts after it.
 */
export function messagePreview(markdown) {
  const parts = paragraphs(markdown).map((p) =>
    p.replace(LINK, "$1").replace(/\*\*([^*\n]+?)\*\*/g, "$1").replace(/\s+/g, " ").trim()
  );
  if (parts.length > 1 && SALUTATION.test(parts[0])) parts.shift();
  const text = parts.join(" ");
  return text.length > PREVIEW_LENGTH ? text.slice(0, PREVIEW_LENGTH - 1).trimEnd() + "…" : text;
}

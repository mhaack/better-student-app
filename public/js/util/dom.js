const ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/**
 * Escapes text that came from the API (subject/teacher names, homework text,
 * announcement bodies, ...) before it goes into innerHTML. Design requirement
 * (docs/plan.md §5/§6): render API free text as plain text only, never HTML.
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

export function el(id) {
  return document.getElementById(id);
}

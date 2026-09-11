import { getStudents, getSelectedStudentId, setSelectedStudentId, clearSession } from "../state/auth-store.js";
import { resetContext } from "../state/session.js";
import { clearCache } from "../data/cache.js";
import { escapeHtml } from "../util/dom.js";
import { navigate } from "../router.js";

export function renderMehr(container) {
  const students = getStudents();
  const selectedId = getSelectedStudentId();

  const switcher =
    students.length > 1
      ? `
      <div class="section">
        <div class="eyebrow">Schüler:in</div>
        <select id="student-switcher" class="interval-picker" style="border:1px solid var(--border);appearance:none">
          ${students
            .map(
              (s) =>
                `<option value="${s.id}" ${s.id === selectedId ? "selected" : ""}>${escapeHtml(s.firstName)} ${escapeHtml(s.lastName)}</option>`
            )
            .join("")}
        </select>
      </div>`
      : "";

  const current = students.find((s) => s.id === selectedId);

  container.innerHTML = `
    <div class="view">
      <h1 class="view-title">Mehr</h1>
      ${
        current
          ? `<div class="card">
               <div style="font-size:16px;font-weight:500;color:var(--text-primary)">${escapeHtml(current.firstName)} ${escapeHtml(current.lastName)}</div>
               <div style="font-size:13px;color:var(--text-muted);margin-top:4px">${escapeHtml(current.schoolName ?? "")}</div>
             </div>`
          : ""
      }
      ${switcher}
      <div class="empty-state" style="padding-top:24px">
        Hausaufgabenübersicht, Fehlzeiten, Mitteilungen und Einstellungen kommen in einer späteren Version.
      </div>
      <button id="logout-button" class="button-primary" style="background:transparent;color:var(--accent);border:1px solid var(--accent-border)">Abmelden</button>
      <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:8px">
        Schulblick ist eine inoffizielle App und nicht mit beste.schule verbunden.
      </div>
    </div>`;

  container.querySelector("#student-switcher")?.addEventListener("change", (e) => {
    setSelectedStudentId(Number(e.target.value));
    resetContext();
    clearCache();
    navigate("/heute");
  });

  container.querySelector("#logout-button").addEventListener("click", () => {
    clearSession();
    resetContext();
    clearCache();
    navigate("/heute");
  });
}

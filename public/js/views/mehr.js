import { getStudents, getSelectedStudentId, setSelectedStudentId, clearSession } from "../state/auth-store.js";
import { resetContext } from "../state/session.js";
import { clearCache } from "../data/cache.js";
import { fetchSchool } from "../data/repository.js";
import { getThemePreference, setThemePreference } from "../state/theme.js";
import { escapeHtml } from "../util/dom.js";
import { navigate } from "../router.js";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

export async function renderMehr(container) {
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
               <div style="font-size:13px;color:var(--text-muted);margin-top:4px" id="mehr-school">${escapeHtml(current.className ?? "")}</div>
             </div>`
          : ""
      }
      ${switcher}
      <div class="section">
        <div class="eyebrow">Darstellung</div>
        <select id="theme-picker" class="interval-picker" style="border:1px solid var(--border);appearance:none">
          ${THEME_OPTIONS.map(
            (o) => `<option value="${o.value}" ${o.value === getThemePreference() ? "selected" : ""}>${o.label}</option>`
          ).join("")}
        </select>
      </div>
      <div class="empty-state" style="padding-top:24px">
        Hausaufgabenübersicht, Fehlzeiten und Mitteilungen kommen in einer späteren Version.
      </div>
      <button id="logout-button" class="button-primary" style="background:transparent;color:var(--accent);border:1px solid var(--accent-border)">Abmelden</button>
      <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:8px">
        Bestere Schule ist eine inoffizielle App und nicht mit beste.schule verbunden.
      </div>
    </div>`;

  container.querySelector("#theme-picker").addEventListener("change", (e) => {
    setThemePreference(e.target.value);
  });

  container.querySelector("#student-switcher")?.addEventListener("change", (e) => {
    setSelectedStudentId(Number(e.target.value));
    resetContext();
    clearCache();
    navigate("/heute");
  });

  fetchSchool()
    .then((school) => {
      const target = container.querySelector("#mehr-school");
      if (!target || !school?.name) return;
      const klasse = current?.className ? `${current.className} · ` : "";
      target.textContent = `${klasse}${school.name}`;
    })
    .catch(() => {
      // The school name is decoration; the class from the student record is enough.
    });

  container.querySelector("#logout-button").addEventListener("click", () => {
    clearSession();
    resetContext();
    clearCache();
    navigate("/heute");
  });
}

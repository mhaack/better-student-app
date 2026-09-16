import { getStudents, getSelectedStudentId, setSelectedStudentId, clearSession } from "../state/auth-store.js";
import { resetContext } from "../state/session.js";
import { clearCache } from "../data/cache.js";
import { fetchSchool } from "../data/repository.js";
import { getThemePreference, setThemePreference } from "../state/theme.js";
import { canInstall, promptInstall, isStandalone, isIos } from "../state/install.js";
import { getCutoffHour, setCutoffHour } from "../state/settings.js";
import { CUTOFF_HOUR_OPTIONS } from "../domain/school-day.js";
import { escapeHtml } from "../util/dom.js";
import { navigate } from "../router.js";

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
];

/**
 * Four cases, because "install this app" means something different in each:
 * already installed, a browser that offered us a prompt, iOS (which never
 * does and needs the manual steps), and everything else — where the honest
 * answer is to show nothing rather than a button that can't work.
 */
function installSection() {
  if (isStandalone()) {
    return `
      <div class="section">
        <div class="eyebrow">App</div>
        <div style="font-size:14px;color:var(--text-secondary)">Bessere Schule ist auf diesem Gerät installiert.</div>
      </div>`;
  }

  if (canInstall()) {
    return `
      <div class="section">
        <div class="eyebrow">App</div>
        <button type="button" id="install-button" class="button-primary">Zum Home-Bildschirm hinzufügen</button>
      </div>`;
  }

  if (isIos()) {
    return `
      <div class="section">
        <div class="eyebrow">App</div>
        <div class="card" style="font-size:14px;line-height:1.5;color:var(--text-secondary)">
          Zum Home-Bildschirm hinzufügen: in Safari auf <strong>Teilen</strong>
          tippen und dann <strong>Zum Home-Bildschirm</strong> wählen.
        </div>
      </div>`;
  }

  // Desktop Firefox and friends: no install path, so no dead end.
  return "";
}

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
        <div class="eyebrow">Tageswechsel</div>
        <select id="cutoff-picker" class="interval-picker" style="border:1px solid var(--border);appearance:none">
          ${CUTOFF_HOUR_OPTIONS.map(
            (h) => `<option value="${h}" ${h === getCutoffHour() ? "selected" : ""}>ab ${h}:00 Uhr</option>`
          ).join("")}
        </select>
        <div style="font-size:12px;line-height:1.5;color:var(--text-muted)">
          Ab dieser Uhrzeit zeigt „Heute" schon den nächsten Schultag —
          freitags abends und am Wochenende den Montag.
        </div>
      </div>
      <div class="section">
        <div class="eyebrow">Darstellung</div>
        <select id="theme-picker" class="interval-picker" style="border:1px solid var(--border);appearance:none">
          ${THEME_OPTIONS.map(
            (o) => `<option value="${o.value}" ${o.value === getThemePreference() ? "selected" : ""}>${o.label}</option>`
          ).join("")}
        </select>
      </div>
      ${installSection()}
      <div class="empty-state" style="padding-top:24px">
        Hausaufgabenübersicht, Fehlzeiten und Mitteilungen kommen in einer späteren Version.
      </div>
      <button id="logout-button" class="button-primary" style="background:transparent;color:var(--accent);border:1px solid var(--accent-border)">Abmelden</button>
      <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:8px">
        Bessere Schule ist eine inoffizielle App und nicht mit beste.schule verbunden.
      </div>
    </div>`;

  container.querySelector("#install-button")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      // The section can't re-evaluate to "installed" until the app is next
      // opened standalone, so say so rather than leaving a dead button.
      button.replaceWith(
        Object.assign(document.createElement("div"), {
          style: "font-size:14px;color:var(--text-secondary)",
          textContent: "Installiert — zu finden auf dem Home-Bildschirm.",
        })
      );
      return;
    }
    // Dismissed: the event is spent, so a retry needs a fresh page load.
    button.disabled = false;
    button.textContent = "Zum Home-Bildschirm hinzufügen";
  });

  container.querySelector("#cutoff-picker").addEventListener("change", (e) => {
    setCutoffHour(Number(e.target.value));
    // Heute is rendered from this on its next mount; nothing to refresh here.
  });

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

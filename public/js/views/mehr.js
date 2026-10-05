import { getStudents, getSelectedStudentId, setSelectedStudentId, clearSession } from "../state/auth-store.js";
import { resetContext } from "../state/session.js";
import { clearCache } from "../data/cache.js";
import { fetchSchool } from "../data/repository.js";
import { getMitteilungenData } from "../data/mitteilungen.js";
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

/** Installed, prompt available, iOS (manual steps), or nothing at all. */
function installSection() {
  if (isStandalone()) {
    return `
      <div class="section">
        <div class="eyebrow">App</div>
        <div style="font-size:14px;color:var(--text-secondary)">bessere.schule ist auf diesem Gerät installiert.</div>
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

  // e.g. desktop Firefox: no install path.
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
      <a class="card card-row" href="#/mehr/mitteilungen" style="min-height:52px">
        <span style="font-size:16px;color:var(--text-primary)">Mitteilungen</span>
        <span style="display:flex;align-items:center;gap:10px">
          <span id="mehr-unread"></span>
          <span class="mt-chevron" aria-hidden="true">›</span>
        </span>
      </a>
      <div class="section" style="gap:10px">
        <div class="eyebrow">Einstellungen</div>
        <div class="card settings-group">
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-label">Tageswechsel</span>
              <span class="settings-hint">
                Ab dieser Uhrzeit zeigt „Heute" schon den nächsten Schultag —
                freitags abends und am Wochenende den Montag.
              </span>
            </span>
            <select id="cutoff-picker" class="interval-picker">
              ${CUTOFF_HOUR_OPTIONS.map(
                (h) => `<option value="${h}" ${h === getCutoffHour() ? "selected" : ""}>ab ${h}:00 Uhr</option>`
              ).join("")}
            </select>
          </label>
          <label class="settings-row">
            <span class="settings-text">
              <span class="settings-label">Darstellung</span>
            </span>
            <select id="theme-picker" class="interval-picker">
              ${THEME_OPTIONS.map(
                (o) => `<option value="${o.value}" ${o.value === getThemePreference() ? "selected" : ""}>${o.label}</option>`
              ).join("")}
            </select>
          </label>
        </div>
      </div>
      ${installSection()}
      <button id="logout-button" class="button-primary button-primary--ghost">Abmelden</button>
      <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-top:8px">
        bessere.schule ist eine inoffizielle App und nicht mit beste.schule verbunden.
        <br><a class="legal-link" href="#/mehr/rechtliches">Impressum &amp; Datenschutz</a>
      </div>
    </div>`;

  container.querySelector("#install-button")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      // Shows "installed" only once opened standalone; say so meanwhile.
      button.replaceWith(
        Object.assign(document.createElement("div"), {
          style: "font-size:14px;color:var(--text-secondary)",
          textContent: "Installiert — zu finden auf dem Home-Bildschirm.",
        })
      );
      return;
    }
    // Dismissed: the event is spent until the next page load.
    button.disabled = false;
    button.textContent = "Zum Home-Bildschirm hinzufügen";
  });

  container.querySelector("#cutoff-picker").addEventListener("change", (e) => {
    setCutoffHour(Number(e.target.value));
    // Heute reads it on its next mount.
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
      // The class from the student record is enough.
    });

  getMitteilungenData()
    .then(({ unreadCount }) => {
      const target = container.querySelector("#mehr-unread");
      if (!target || unreadCount === 0) return;
      target.outerHTML = `<span class="pill pill--room">${unreadCount} ungelesen</span>`;
    })
    .catch(() => {
      // The list shows its own error.
    });

  container.querySelector("#logout-button").addEventListener("click", () => {
    clearSession();
    resetContext();
    clearCache();
    navigate("/heute");
  });
}

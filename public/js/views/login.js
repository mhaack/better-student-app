import { setStudents, setSelectedStudentId } from "../state/auth-store.js";
import { fetchStudents } from "../data/repository.js";
import { beginLogin } from "../auth/oauth.js";
import { isOAuthConfigured } from "../auth/oauth-config.js";
import { escapeHtml } from "../util/dom.js";

/**
 * Everything that has to happen once credentials are accepted: find the
 * student(s) this account can see and pick one.
 */
export async function establishSession() {
  const students = await fetchStudents();
  if (students.length === 0) throw new Error("Zu diesem Konto wurde kein Schüler-Zugang gefunden.");
  setStudents(students);
  setSelectedStudentId(students[0].id);
}

export function renderLogin(container, { error: initialError = "" } = {}) {
  container.innerHTML = `
    <div class="login-view">
      <div>
        <div class="view-title" style="font-size:32px">Anmelden</div>
        <div class="view-subtitle">Mit deinem beste.schule-Konto</div>
      </div>
      ${
        isOAuthConfigured()
          ? `<div class="section" style="gap:14px">
               <button type="button" id="oauth-login" class="button-primary">Mit beste.schule anmelden</button>
               <label class="login-checkbox">
                 <input id="remember" type="checkbox" style="width:20px;height:20px" />
                 Angemeldet bleiben
               </label>
             </div>`
          : `<div class="login-error" role="alert">
               Diese Installation hat keine OAuth-Client-ID hinterlegt, deshalb
               ist keine Anmeldung möglich. Siehe js/auth/oauth-config.js.
             </div>`
      }
      <div id="login-error" class="login-error" role="alert" hidden></div>
      <div class="login-help">
        Die Anmeldung läuft direkt über beste.schule — Bessere Schule bekommt
        dein Passwort nie zu sehen. Bessere Schule ist eine inoffizielle App
        und nicht mit beste.schule verbunden.
      </div>
    </div>
  `;

  const errorBox = container.querySelector("#login-error");

  if (initialError) {
    errorBox.textContent = initialError;
    errorBox.hidden = false;
  }

  container.querySelector("#oauth-login")?.addEventListener("click", () => {
    beginLogin({ remember: container.querySelector("#remember").checked }).catch((err) => {
      errorBox.textContent = err.message || "Anmeldung fehlgeschlagen.";
      errorBox.hidden = false;
    });
  });
}

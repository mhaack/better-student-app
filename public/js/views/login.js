import { setToken, setStudents, setSelectedStudentId, clearSession } from "../state/auth-store.js";
import { fetchStudents } from "../data/repository.js";
import { AuthError } from "../api/client.js";
import { escapeHtml } from "../util/dom.js";
import { navigate } from "../router.js";

export function renderLogin(container) {
  container.innerHTML = `
    <div class="login-view">
      <div>
        <div class="view-title" style="font-size:32px">Anmelden</div>
        <div class="view-subtitle">Mit deinem beste.schule-Konto</div>
      </div>
      <form id="login-form" class="section" novalidate>
        <div class="login-field">
          <label for="token">Persönlicher Zugriffsschlüssel</label>
          <input id="token" name="token" type="password" autocomplete="off" required
                 placeholder="Von beste.schule kopiert" />
        </div>
        <label class="login-checkbox">
          <input id="remember" type="checkbox" style="width:20px;height:20px" />
          Angemeldet bleiben
        </label>
        <div id="login-error" class="login-error" role="alert" hidden></div>
        <button type="submit" id="login-submit" class="button-primary">Anmelden</button>
      </form>
      <div class="login-help">
        So bekommst du einen Zugriffsschlüssel: auf beste.schule unter
        <strong>Benutzerkonto → API → Personal Access Token erstellen</strong>.
        Bestere Schule ist eine inoffizielle App und nicht mit beste.schule verbunden.
      </div>
    </div>
  `;

  const form = container.querySelector("#login-form");
  const errorBox = container.querySelector("#login-error");
  const submitButton = container.querySelector("#login-submit");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const token = container.querySelector("#token").value.trim();
    const remember = container.querySelector("#remember").checked;
    if (!token) return;

    errorBox.hidden = true;
    submitButton.disabled = true;
    submitButton.textContent = "Prüfe …";

    setToken(token, remember);
    try {
      const students = await fetchStudents();
      if (students.length === 0) throw new Error("Kein Schüler-Konto mit diesem Zugriffsschlüssel gefunden.");
      setStudents(students);
      setSelectedStudentId(students[0].id);
      navigate("/heute");
    } catch (err) {
      clearSession();
      errorBox.textContent =
        err instanceof AuthError
          ? "Der Zugriffsschlüssel wurde abgelehnt. Bitte prüfe, ob er korrekt kopiert wurde."
          : escapeHtml(err.message || "Anmeldung fehlgeschlagen. Bitte erneut versuchen.");
      errorBox.hidden = false;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Anmelden";
    }
  });
}

// Registers the beforeinstallprompt listener at boot; Chromium fires it once, early.
import "./state/install.js";
import { isAuthenticated, onAuthChange, clearSession, getSelectedStudentId } from "./state/auth-store.js";
import { route, startRouter, currentBasePath, navigate } from "./router.js";
import { isCallback, completeLogin } from "./auth/oauth.js";
import { NAV_DOTS_STALE, renderBottomNav, setNavDot } from "./components/bottom-nav.js";
import { initSplash } from "./components/splash.js";
import { renderLogin, establishSession } from "./views/login.js";
import { renderHeute } from "./views/heute.js";
import { renderBenachrichtigungen } from "./views/benachrichtigungen.js";
import { renderNoten } from "./views/noten.js";
import { renderFachDetail } from "./views/fach-detail.js";
import { renderStundenplan } from "./views/stundenplan.js";
import { renderTermine } from "./views/termine.js";
import { renderMehr } from "./views/mehr.js";
import { renderFerien } from "./views/ferien.js";
import { renderMitteilungen, renderMitteilung } from "./views/mitteilungen.js";
import { renderRechtliches } from "./views/rechtliches.js";
import { getMitteilungenData } from "./data/mitteilungen.js";
import { hasNewGrades } from "./data/noten.js";
import { ensureContext } from "./state/session.js";

const app = document.getElementById("app");

initSplash();

// Set when an OAuth callback fails, so the login screen can say why.
let loginError = "";

function ensureShell() {
  if (app.querySelector("#view-container")) return;
  app.innerHTML = `
    <div id="view-container" class="view-container"></div>
    <div id="nav-container"></div>`;
}

/** Both cached for a minute and shared with their screens; a failure just leaves no dot. */
function updateNavDots(navContainer) {
  getMitteilungenData()
    .then(({ unreadCount }) => setNavDot(navContainer, "/mehr", unreadCount > 0 && "ungelesene Schulinformationen"))
    .catch(() => {});
  ensureContext()
    .then((context) => hasNewGrades(getSelectedStudentId(), context))
    .then((hasNew) => setNavDot(navContainer, "/noten", hasNew && "neue Noten"))
    .catch(() => {});
}

function withShell(viewFn) {
  return async (params) => {
    if (!isAuthenticated()) {
      app.innerHTML = "";
      renderLogin(app, { error: loginError });
      loginError = "";
      return;
    }
    ensureShell();
    const navContainer = app.querySelector("#nav-container");
    navContainer.innerHTML = renderBottomNav(currentBasePath());
    updateNavDots(navContainer);
    await viewFn(app.querySelector("#view-container"), params);
  };
}

window.addEventListener(NAV_DOTS_STALE, () => updateNavDots(app.querySelector("#nav-container")));

route(/^\/heute$/, withShell(renderHeute));
// Under /heute so the Heute tab stays highlighted.
route(/^\/heute\/benachrichtigungen$/, withShell(renderBenachrichtigungen));
route(/^\/noten$/, withShell(renderNoten));
route(/^\/noten\/(?<subjectId>\d+)$/, withShell((container, params) => renderFachDetail(container, params)));
route(/^\/stundenplan$/, withShell(renderStundenplan));
route(/^\/termine$/, withShell(renderTermine));
route(/^\/mehr$/, withShell(renderMehr));
// Under /mehr so the Mehr tab stays highlighted.
route(/^\/mehr\/mitteilungen$/, withShell(renderMitteilungen));
route(/^\/mehr\/ferien$/, withShell(renderFerien));
route(/^\/mehr\/mitteilungen\/(?<id>\d+)$/, withShell((container, params) => renderMitteilung(container, params)));
// The Impressum must be reachable without logging in, so it skips withShell's login gate.
route(/^\/mehr\/rechtliches$/, (params) => {
  if (isAuthenticated()) return withShell(renderRechtliches)(params);
  app.innerHTML = "";
  renderRechtliches(app);
});

onAuthChange(() => {
  if (!isAuthenticated()) {
    app.innerHTML = "";
    renderLogin(app, { error: loginError });
    loginError = "";
  } else {
    navigate("/heute");
  }
});

/** Finishes an OAuth redirect (?code=…) before the router checks the login. */
async function boot() {
  if (isCallback()) {
    app.innerHTML = `<div class="view"><div class="empty-state">Anmeldung wird abgeschlossen …</div></div>`;
    try {
      await completeLogin();
      await establishSession();
      location.hash = "#/heute";
    } catch (err) {
      clearSession();
      loginError = err.message || "Anmeldung fehlgeschlagen.";
    }
  }
  startRouter();
}

boot();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline shell caching is optional.
    });
  });
}

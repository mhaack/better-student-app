// Side-effect import: registers the beforeinstallprompt listener at boot.
// Chromium fires that event once and early — too late if we wait for the
// Mehr view to be opened.
import "./state/install.js";
import { isAuthenticated, onAuthChange, clearSession } from "./state/auth-store.js";
import { route, startRouter, currentBasePath, navigate } from "./router.js";
import { isCallback, completeLogin } from "./auth/oauth.js";
import { renderBottomNav, setMehrDot } from "./components/bottom-nav.js";
import { renderLogin, establishSession } from "./views/login.js";
import { renderHeute } from "./views/heute.js";
import { renderNoten } from "./views/noten.js";
import { renderFachDetail } from "./views/fach-detail.js";
import { renderStundenplan } from "./views/stundenplan.js";
import { renderTermine } from "./views/termine.js";
import { renderMehr } from "./views/mehr.js";
import { renderMitteilungen, renderMitteilung } from "./views/mitteilungen.js";
import { getMitteilungenData } from "./data/mitteilungen.js";

const app = document.getElementById("app");

// Set when an OAuth callback fails, so the login screen can say why instead
// of silently showing an empty form.
let loginError = "";

function ensureShell() {
  if (app.querySelector("#view-container")) return;
  app.innerHTML = `
    <div id="view-container" style="flex:1;display:flex;flex-direction:column;min-height:0"></div>
    <div id="nav-container"></div>`;
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
    // Cached for a minute, so this doesn't refetch on every tab switch.
    getMitteilungenData()
      .then(({ unreadCount }) => setMehrDot(navContainer, unreadCount > 0))
      .catch(() => {});
    await viewFn(app.querySelector("#view-container"), params);
  };
}

route(/^\/heute$/, withShell(renderHeute));
route(/^\/noten$/, withShell(renderNoten));
route(/^\/noten\/(?<subjectId>\d+)$/, withShell((container, params) => renderFachDetail(container, params)));
route(/^\/stundenplan$/, withShell(renderStundenplan));
route(/^\/termine$/, withShell(renderTermine));
route(/^\/mehr$/, withShell(renderMehr));
// Nested under /mehr so the Mehr tab stays highlighted (currentBasePath()
// only looks at the first segment), same as /noten/:subjectId.
route(/^\/mehr\/mitteilungen$/, withShell(renderMitteilungen));
route(/^\/mehr\/mitteilungen\/(?<id>\d+)$/, withShell((container, params) => renderMitteilung(container, params)));

onAuthChange(() => {
  if (!isAuthenticated()) {
    app.innerHTML = "";
    renderLogin(app, { error: loginError });
    loginError = "";
  } else {
    navigate("/heute");
  }
});

/**
 * An OAuth redirect lands back on the app with ?code=… in the URL, so the
 * exchange has to finish before the router decides whether we're logged in.
 */
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
      // Offline app-shell caching is a nice-to-have; ignore registration failures.
    });
  });
}

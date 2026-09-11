import { isAuthenticated, onAuthChange } from "./state/auth-store.js";
import { route, startRouter, currentBasePath, navigate } from "./router.js";
import { renderBottomNav } from "./components/bottom-nav.js";
import { renderLogin } from "./views/login.js";
import { renderHeute } from "./views/heute.js";
import { renderNoten } from "./views/noten.js";
import { renderFachDetail } from "./views/fach-detail.js";
import { renderStundenplan } from "./views/stundenplan.js";
import { renderMehr } from "./views/mehr.js";

const app = document.getElementById("app");

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
      renderLogin(app);
      return;
    }
    ensureShell();
    app.querySelector("#nav-container").innerHTML = renderBottomNav(currentBasePath());
    await viewFn(app.querySelector("#view-container"), params);
  };
}

route(/^\/heute$/, withShell(renderHeute));
route(/^\/noten$/, withShell(renderNoten));
route(/^\/noten\/(?<subjectId>\d+)$/, withShell((container, params) => renderFachDetail(container, params)));
route(/^\/stundenplan$/, withShell(renderStundenplan));
route(/^\/mehr$/, withShell(renderMehr));

onAuthChange(() => {
  if (!isAuthenticated()) {
    app.innerHTML = "";
    renderLogin(app);
  } else {
    navigate("/heute");
  }
});

startRouter();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Offline app-shell caching is a nice-to-have; ignore registration failures.
    });
  });
}

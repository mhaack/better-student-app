import { ICONS } from "./icons.js";

const TABS = [
  { path: "/heute", label: "Heute", icon: ICONS.house },
  { path: "/noten", label: "Noten", icon: ICONS.graduationCap },
  { path: "/stundenplan", label: "Stundenplan", icon: ICONS.calendarDays },
  { path: "/mehr", label: "Mehr", icon: ICONS.ellipsis },
];

export function renderBottomNav(activeBasePath) {
  const items = TABS.map((tab) => {
    const isActive = tab.path === activeBasePath;
    // The icon+label pair switches color for the active tab (see
    // .nav-item[aria-current="page"] in app.css) — that's the only active
    // marker now, so no separate indicator element is needed.
    return `
      <a class="nav-item" href="#${tab.path}" ${isActive ? 'aria-current="page"' : ""}>
        ${tab.icon}
        <span>${tab.label}</span>
      </a>`;
  }).join("");

  return `<nav class="bottom-nav" aria-label="Hauptnavigation">${items}</nav>`;
}

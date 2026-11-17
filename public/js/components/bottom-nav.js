import { ICONS } from "./icons.js";

// "Stundenplan" doesn't fit five tabs at 390px, so the tab says "Plan".
const TABS = [
  { path: "/heute", label: "Heute", icon: ICONS.house },
  { path: "/noten", label: "Noten", icon: ICONS.graduationCap },
  { path: "/stundenplan", label: "Plan", icon: ICONS.calendarDays },
  { path: "/termine", label: "Termine", icon: ICONS.calendarCheck },
  { path: "/mehr", label: "Mehr", icon: ICONS.ellipsis },
];

// Fired on window when a screen changed what a dot counts, so the shell redraws the dots.
export const NAV_DOTS_STALE = "navdotsstale";

export function renderBottomNav(activeBasePath) {
  const items = TABS.map((tab) => {
    const isActive = tab.path === activeBasePath;
    // aria-current colors the active tab (app.css); no extra indicator.
    return `
      <a class="nav-item" href="#${tab.path}" data-path="${tab.path}" ${isActive ? 'aria-current="page"' : ""}>
        ${tab.icon}
        <span>${tab.label}</span>
      </a>`;
  }).join("");

  return `<nav class="bottom-nav" aria-label="Hauptnavigation">${items}</nav>`;
}

/**
 * A dot on a tab for something waiting further in (unseen grades, unread
 * Schulinformationen); `reason` also goes into its label. Falsy removes it.
 */
export function setNavDot(nav, path, reason) {
  const item = nav?.querySelector(`[data-path="${path}"]`);
  if (!item) return;
  const label = TABS.find((tab) => tab.path === path)?.label ?? "";
  item.classList.toggle("nav-item--dot", Boolean(reason));
  item.setAttribute("aria-label", reason ? `${label}, ${reason}` : label);
}

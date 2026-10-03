import { ICONS } from "./icons.js";

// "Stundenplan" doesn't fit five tabs at 390px, so the tab says "Plan".
const TABS = [
  { path: "/heute", label: "Heute", icon: ICONS.house },
  { path: "/noten", label: "Noten", icon: ICONS.graduationCap },
  { path: "/stundenplan", label: "Plan", icon: ICONS.calendarDays },
  { path: "/termine", label: "Termine", icon: ICONS.calendarCheck },
  { path: "/mehr", label: "Mehr", icon: ICONS.ellipsis },
];

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

/** A dot on Mehr for unread announcements older than Heute shows. Needs a fetch. */
export function setMehrDot(nav, hasUnread) {
  const item = nav?.querySelector('[data-path="/mehr"]');
  if (!item) return;
  item.classList.toggle("nav-item--dot", hasUnread);
  item.setAttribute("aria-label", hasUnread ? "Mehr, ungelesene Mitteilungen" : "Mehr");
}

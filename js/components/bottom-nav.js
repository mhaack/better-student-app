const TABS = [
  { path: "/heute", label: "Heute" },
  { path: "/noten", label: "Noten" },
  { path: "/stundenplan", label: "Stundenplan" },
  { path: "/mehr", label: "Mehr" },
];

export function renderBottomNav(activeBasePath) {
  const items = TABS.map((tab) => {
    const isActive = tab.path === activeBasePath;
    // Only the active tab carries the indicator bar; inactive labels sit
    // centred in the tab, as in direction 2a.
    return `
      <a class="nav-item" href="#${tab.path}" ${isActive ? 'aria-current="page"' : ""}>
        ${isActive ? '<span class="nav-item-indicator"></span>' : ""}
        <span>${tab.label}</span>
      </a>`;
  }).join("");

  return `<nav class="bottom-nav" aria-label="Hauptnavigation">${items}</nav>`;
}

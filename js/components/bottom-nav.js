const TABS = [
  { path: "/heute", label: "Heute" },
  { path: "/noten", label: "Noten" },
  { path: "/stundenplan", label: "Stundenplan" },
  { path: "/mehr", label: "Mehr" },
];

export function renderBottomNav(activeBasePath) {
  const items = TABS.map((tab) => {
    const isActive = tab.path === activeBasePath;
    return `
      <a class="nav-item" href="#${tab.path}" ${isActive ? 'aria-current="page"' : ""}>
        <span class="nav-item-indicator"></span>
        <span>${tab.label}</span>
      </a>`;
  }).join("");

  return `<nav class="bottom-nav" aria-label="Hauptnavigation">${items}</nav>`;
}

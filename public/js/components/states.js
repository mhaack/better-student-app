export function renderSkeleton(lineCount = 6) {
  const lines = Array.from(
    { length: lineCount },
    (_, i) => `<div class="skeleton${i % 3 === 0 ? " skeleton--tall" : ""}"></div>`
  ).join("");
  return `<div class="section" aria-busy="true" aria-label="Lädt …">${lines}</div>`;
}

export function renderErrorState(message) {
  return `
    <div class="empty-state">
      <div class="error-title">Das hat nicht geklappt</div>
      <div>${message}</div>
      <button class="button-primary button-primary--inline error-reload" data-reload>Neu laden</button>
    </div>`;
}

/** Call after inserting renderErrorState's HTML; CSP blocks inline onclick. */
export function bindErrorState(container) {
  container.querySelector("[data-reload]")?.addEventListener("click", () => location.reload());
}

export function renderEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

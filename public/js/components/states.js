export function renderSkeleton(lineCount = 6) {
  const lines = Array.from(
    { length: lineCount },
    (_, i) => `<div class="skeleton" style="height:${i % 3 === 0 ? 48 : 20}px;border-radius:8px"></div>`
  ).join("");
  return `<div class="section" aria-busy="true" aria-label="Lädt …">${lines}</div>`;
}

export function renderErrorState(message) {
  return `
    <div class="empty-state">
      <div style="font-family:var(--font-serif);font-size:22px;color:var(--text-primary)">Das hat nicht geklappt</div>
      <div>${message}</div>
      <button class="button-primary" style="margin-top:8px;padding:0 20px" data-reload>Neu laden</button>
    </div>`;
}

/** Call once after inserting renderErrorState's HTML — CSP blocks inline onclick. */
export function bindErrorState(container) {
  container.querySelector("[data-reload]")?.addEventListener("click", () => location.reload());
}

export function renderEmptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

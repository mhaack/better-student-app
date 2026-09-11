export function renderStundenplan(container) {
  container.innerHTML = `
    <div class="view">
      <h1 class="view-title">Stundenplan</h1>
      <div class="empty-state" style="padding-top:80px">
        <div style="font-family:var(--font-serif);font-size:22px;color:var(--text-primary)">Bald verfügbar</div>
        <div>Der Wochen-Stundenplan ist noch nicht Teil dieser Version. Vertretungen und der Tagesplan stehen schon unter „Heute".</div>
      </div>
    </div>`;
}

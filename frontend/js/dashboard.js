// Student dashboard: list elections grouped by status.
(async function () {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("greeting").textContent =
    "Hi " + user.name.split(" ")[0] + " 👋";
  document.getElementById("userChip").textContent =
    user.name + (user.department ? " · " + user.department : "");

  const content = document.getElementById("content");

  function electionCard(e) {
    const isActive = e.status === "active";
    const actionLabel = isActive ? "Vote now" : "View results";
    const actionHref = isActive
      ? `/vote.html?id=${e.id}`
      : `/results.html?id=${e.id}`;
    const actionClass = isActive ? "btn-primary" : "btn-outline";
    return `
      <div class="election-card fade-in">
        <div class="top">
          ${statusBadge(e.status)}
          <span class="muted" style="font-size:13px">${e.candidate_count} candidate${e.candidate_count === 1 ? "" : "s"}</span>
        </div>
        <h3>${esc(e.title)}</h3>
        <p>${esc(e.description) || "No description provided."}</p>
        <div class="election-meta">
          <span><b>${e.vote_count}</b> votes cast</span>
        </div>
        <a href="${actionHref}" class="btn ${actionClass} btn-block">${actionLabel}</a>
      </div>`;
  }

  try {
    const elections = await API.elections();
    if (!elections.length) {
      content.innerHTML = `<div class="empty"><div class="ic">🗳️</div><h3>No elections yet</h3><p>Check back soon — elections will appear here once published.</p></div>`;
      return;
    }
    const active = elections.filter((e) => e.status === "active");
    const others = elections.filter((e) => e.status !== "active");

    let html = "";
    if (active.length) {
      html += `<h3 class="muted" style="margin:0 0 14px">Active now</h3>`;
      html += `<div class="election-grid">${active.map(electionCard).join("")}</div>`;
    }
    if (others.length) {
      html += `<h3 class="muted" style="margin:34px 0 14px">Closed & upcoming</h3>`;
      html += `<div class="election-grid">${others.map(electionCard).join("")}</div>`;
    }
    content.innerHTML = html;
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="ic">⚠️</div><p>${esc(err.message)}</p></div>`;
  }
})();

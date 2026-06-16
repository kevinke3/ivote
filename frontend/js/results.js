// Results page: animated progress bars, live auto-refresh for active elections.
(function () {
  const params = new URLSearchParams(location.search);
  const electionId = params.get("id");
  const content = document.getElementById("content");
  let timer = null;

  if (!electionId) {
    location.href = "/dashboard.html";
    return;
  }

  function resultRow(c, index, leading) {
    const isLead = leading && c.vote_count > 0;
    return `
      <div class="result-row ${isLead ? "lead" : ""}">
        <div class="rt">
          <span class="nm">
            ${isLead ? '<span class="crown">👑</span>' : ""}
            <span class="avatar" style="width:34px;height:34px;font-size:14px;display:inline-grid;border-radius:50%;background:var(--blue-50);color:var(--blue-700);place-items:center;font-weight:700">${initials(c.name)}</span>
            ${esc(c.name)}
            <small class="muted" style="font-weight:500">· ${esc(c.position) || "Candidate"}</small>
          </span>
          <span class="vc"><b>${c.vote_count}</b> · ${c.percentage}%</span>
        </div>
        <div class="bar"><span data-w="${c.percentage}"></span></div>
      </div>`;
  }

  function render(data) {
    document.getElementById("title").textContent = data.election.title + " — Results";
    document.getElementById("desc").textContent = data.election.description || "";
    document.getElementById("statusBadge").innerHTML = statusBadge(data.election.status);

    const totalCandidates = data.candidates.length;
    const leadVotes = data.candidates.length ? data.candidates[0].vote_count : 0;

    document.getElementById("summary").innerHTML = `
      <div class="stat-card"><div class="ic">🗳️</div><div class="val">${data.total_votes}</div><div class="lbl">Total votes</div></div>
      <div class="stat-card"><div class="ic">👥</div><div class="val">${totalCandidates}</div><div class="lbl">Candidates</div></div>
      <div class="stat-card"><div class="ic">🏆</div><div class="val">${data.candidates[0] ? esc(data.candidates[0].name.split(" ")[0]) : "—"}</div><div class="lbl">${data.election.status === "closed" ? "Winner" : "Leading"}</div></div>`;

    if (!data.candidates.length) {
      content.innerHTML = `<div class="empty"><div class="ic">📊</div><p>No candidates to show yet.</p></div>`;
      return;
    }
    if (data.total_votes === 0) {
      content.innerHTML =
        `<div class="empty"><div class="ic">⏳</div><h3>No votes yet</h3><p>Results will appear here as students cast their ballots.</p></div>`;
      return;
    }

    content.innerHTML = data.candidates
      .map((c, i) => resultRow(c, i, i === 0 && c.vote_count === leadVotes))
      .join("");

    // Animate bars after paint.
    requestAnimationFrame(() => {
      content.querySelectorAll(".bar > span").forEach((bar) => {
        bar.style.width = bar.dataset.w + "%";
      });
    });

    // Live refresh only while active.
    if (data.election.status === "active") {
      document.getElementById("liveDot").innerHTML =
        '<span class="badge dot badge-active" style="font-size:11px">Live</span>';
      if (!timer) timer = setInterval(load, 5000);
    } else {
      document.getElementById("liveDot").textContent = "Final results";
      if (timer) clearInterval(timer);
    }
  }

  async function load() {
    try {
      render(await API.results(electionId));
    } catch (err) {
      content.innerHTML = `<div class="empty"><div class="ic">⚠️</div><p>${esc(err.message)}</p></div>`;
      if (timer) clearInterval(timer);
    }
  }

  load();
})();

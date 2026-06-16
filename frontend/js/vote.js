// Voting page: pick a candidate card and confirm.
(async function () {
  const user = await requireAuth();
  if (!user) return;

  const params = new URLSearchParams(location.search);
  const electionId = params.get("id");
  const content = document.getElementById("content");

  if (!electionId) {
    location.href = "/dashboard.html";
    return;
  }

  let selected = null;

  function candidateCard(c) {
    const avatar = c.photo_url
      ? `<div class="avatar"><img src="${esc(c.photo_url)}" alt="${esc(c.name)}"></div>`
      : `<div class="avatar">${initials(c.name)}</div>`;
    return `
      <div class="candidate-card" data-id="${c.id}">
        <div class="pick"></div>
        ${avatar}
        <h3>${esc(c.name)}</h3>
        <div class="pos">${esc(c.position) || "Candidate"}</div>
        <p class="manifesto">${esc(c.manifesto) || ""}</p>
      </div>`;
  }

  function render(election) {
    document.getElementById("title").textContent = election.title;
    document.getElementById("desc").textContent = election.description || "";
    document.getElementById("statusBadge").innerHTML = statusBadge(election.status);

    if (election.has_voted) {
      content.innerHTML = `
        <div class="empty fade-in">
          <div class="ic">✅</div>
          <h3>You've already voted in this election</h3>
          <p>Thank you for participating. You can follow the live results below.</p>
          <a href="/results.html?id=${election.id}" class="btn btn-primary mt-2">View live results</a>
        </div>`;
      return;
    }

    if (election.status !== "active") {
      content.innerHTML = `
        <div class="empty fade-in">
          <div class="ic">🔒</div>
          <h3>This election is not open for voting</h3>
          <p>Voting is only available while an election is active.</p>
          <a href="/results.html?id=${election.id}" class="btn btn-outline mt-2">View results</a>
        </div>`;
      return;
    }

    if (!election.candidates.length) {
      content.innerHTML = `<div class="empty"><div class="ic">🗳️</div><p>No candidates have been added yet.</p></div>`;
      return;
    }

    content.innerHTML = `
      <div class="candidate-grid fade-in">
        ${election.candidates.map(candidateCard).join("")}
      </div>
      <div class="center mt-4">
        <button class="btn btn-primary" id="confirmBtn" disabled>Confirm vote</button>
        <p class="muted mt-2" style="font-size:13.5px">Your vote is final and cannot be changed.</p>
      </div>`;

    const cards = content.querySelectorAll(".candidate-card");
    cards.forEach((card) => {
      card.addEventListener("click", () => {
        cards.forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selected = card.dataset.id;
        document.getElementById("confirmBtn").disabled = false;
      });
    });

    document.getElementById("confirmBtn").addEventListener("click", async () => {
      if (!selected) return;
      const btn = document.getElementById("confirmBtn");
      btn.disabled = true;
      btn.textContent = "Recording…";
      try {
        await API.vote(election.id, Number(selected));
        toast("Your vote has been recorded!", "success");
        setTimeout(() => (location.href = `/results.html?id=${election.id}`), 800);
      } catch (err) {
        toast(err.message, "error");
        btn.disabled = false;
        btn.textContent = "Confirm vote";
      }
    });
  }

  try {
    render(await API.election(electionId));
  } catch (err) {
    content.innerHTML = `<div class="empty"><div class="ic">⚠️</div><p>${esc(err.message)}</p></div>`;
  }
})();

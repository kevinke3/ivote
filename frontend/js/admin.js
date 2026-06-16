// Admin dashboard: stats, election CRUD, candidate CRUD, status control.
(async function () {
  const user = await requireAuth({ admin: true });
  if (!user) return;
  document.getElementById("adminChip").textContent = user.name;

  const electionsList = document.getElementById("electionsList");
  const electionModal = document.getElementById("electionModal");
  const candidateModal = document.getElementById("candidateModal");
  let expanded = new Set();

  // ---------- Modal helpers ----------
  function openModal(m) {
    m.classList.add("open");
  }
  function closeModal(m) {
    m.classList.remove("open");
  }
  document.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", (e) =>
      closeModal(e.target.closest(".modal-backdrop"))
    )
  );
  [electionModal, candidateModal].forEach((m) =>
    m.addEventListener("click", (e) => {
      if (e.target === m) closeModal(m);
    })
  );

  // ---------- Stats ----------
  async function loadStats() {
    try {
      const s = await API.stats();
      document.getElementById("sStudents").textContent = s.students;
      document.getElementById("sElections").textContent = s.elections;
      document.getElementById("sActive").textContent = s.active_elections;
      document.getElementById("sVotes").textContent = s.total_votes;
    } catch (_) {}
  }

  // ---------- Elections + candidates ----------
  async function loadElections() {
    try {
      const elections = await API.elections();
      if (!elections.length) {
        electionsList.innerHTML = `<div class="empty"><div class="ic">🗳️</div><h3>No elections yet</h3><p>Create your first election to get started.</p></div>`;
        return;
      }
      electionsList.innerHTML = elections.map(electionRow).join("");
      bindElectionRows();
      // Re-render expanded candidate panels.
      for (const id of Array.from(expanded)) {
        await renderCandidates(id);
      }
    } catch (err) {
      electionsList.innerHTML = `<div class="empty"><div class="ic">⚠️</div><p>${esc(err.message)}</p></div>`;
    }
  }

  function electionRow(e) {
    const isOpen = expanded.has(String(e.id));
    return `
      <div class="election-admin" data-id="${e.id}" style="border-bottom:1px solid var(--line)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;flex-wrap:wrap">
          <div style="min-width:240px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
              <b style="font-size:16px">${esc(e.title)}</b> ${statusBadge(e.status)}
            </div>
            <div class="muted" style="font-size:13.5px">${e.candidate_count} candidate${e.candidate_count === 1 ? "" : "s"} · ${e.vote_count} vote${e.vote_count === 1 ? "" : "s"}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <select class="select status-select" data-id="${e.id}" style="width:auto;padding:8px 12px;font-size:13.5px">
              <option value="draft" ${e.status === "draft" ? "selected" : ""}>Draft</option>
              <option value="active" ${e.status === "active" ? "selected" : ""}>Active</option>
              <option value="closed" ${e.status === "closed" ? "selected" : ""}>Closed</option>
            </select>
            <button class="btn btn-ghost btn-sm toggle-cands" data-id="${e.id}">${isOpen ? "Hide" : "Candidates"}</button>
            <a class="btn btn-outline btn-sm" href="/results.html?id=${e.id}">Results</a>
            <button class="btn btn-outline btn-sm edit-election" data-id="${e.id}">Edit</button>
            <button class="btn btn-danger btn-sm del-election" data-id="${e.id}">Delete</button>
          </div>
        </div>
        <div class="cands-panel" id="cands-${e.id}" style="display:${isOpen ? "block" : "none"};padding:0 22px 20px"></div>
      </div>`;
  }

  function bindElectionRows() {
    electionsList.querySelectorAll(".status-select").forEach((sel) =>
      sel.addEventListener("change", async () => {
        try {
          await API.updateElection(sel.dataset.id, { status: sel.value });
          toast("Election status updated", "success");
          await Promise.all([loadStats(), loadElections()]);
        } catch (err) {
          toast(err.message, "error");
        }
      })
    );
    electionsList.querySelectorAll(".edit-election").forEach((btn) =>
      btn.addEventListener("click", () => openElectionModal(btn.dataset.id))
    );
    electionsList.querySelectorAll(".del-election").forEach((btn) =>
      btn.addEventListener("click", () => deleteElection(btn.dataset.id))
    );
    electionsList.querySelectorAll(".toggle-cands").forEach((btn) =>
      btn.addEventListener("click", () => toggleCandidates(btn.dataset.id))
    );
  }

  async function toggleCandidates(id) {
    const panel = document.getElementById("cands-" + id);
    if (expanded.has(id)) {
      expanded.delete(id);
      panel.style.display = "none";
    } else {
      expanded.add(id);
      panel.style.display = "block";
      await renderCandidates(id);
    }
    await loadElections();
  }

  async function renderCandidates(id) {
    const panel = document.getElementById("cands-" + id);
    if (!panel) return;
    panel.innerHTML = `<div class="spinner" style="margin:20px auto"></div>`;
    try {
      const election = await API.election(id);
      const rows = election.candidates
        .map(
          (c) => `
        <tr>
          <td>
            <div style="display:flex;align-items:center;gap:12px">
              <span class="avatar" style="width:38px;height:38px;font-size:14px">${initials(c.name)}</span>
              <div><b>${esc(c.name)}</b><div class="muted" style="font-size:13px">${esc(c.position) || "Candidate"}</div></div>
            </div>
          </td>
          <td class="muted" style="max-width:320px">${esc(c.manifesto) || "—"}</td>
          <td class="actions">
            <button class="btn btn-outline btn-sm edit-cand" data-id="${c.id}">Edit</button>
            <button class="btn btn-danger btn-sm del-cand" data-id="${c.id}">Delete</button>
          </td>
        </tr>`
        )
        .join("");

      panel.innerHTML = `
        <div class="panel" style="box-shadow:none;border-color:var(--line)">
          <div class="panel-head" style="padding:14px 18px">
            <h3 style="font-size:15px">Candidates</h3>
            <button class="btn btn-primary btn-sm add-cand" data-id="${id}">＋ Add candidate</button>
          </div>
          ${
            election.candidates.length
              ? `<table class="table"><thead><tr><th>Candidate</th><th>Manifesto</th><th></th></tr></thead><tbody>${rows}</tbody></table>`
              : `<div class="empty" style="padding:30px"><p>No candidates yet. Add one to build the ballot.</p></div>`
          }
        </div>`;

      panel.querySelector(".add-cand").addEventListener("click", () =>
        openCandidateModal(id, null)
      );
      panel.querySelectorAll(".edit-cand").forEach((btn) =>
        btn.addEventListener("click", () =>
          openCandidateModal(id, election.candidates.find((c) => c.id == btn.dataset.id))
        )
      );
      panel.querySelectorAll(".del-cand").forEach((btn) =>
        btn.addEventListener("click", () => deleteCandidate(btn.dataset.id, id))
      );
    } catch (err) {
      panel.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    }
  }

  // ---------- Election modal ----------
  document.getElementById("newElectionBtn").addEventListener("click", () =>
    openElectionModal(null)
  );

  async function openElectionModal(id) {
    document.getElementById("electionId").value = id || "";
    document.getElementById("electionModalTitle").textContent = id
      ? "Edit election"
      : "New election";
    if (id) {
      const e = await API.election(id);
      document.getElementById("eTitle").value = e.title;
      document.getElementById("eDesc").value = e.description;
      document.getElementById("eStatus").value = e.status;
    } else {
      document.getElementById("eTitle").value = "";
      document.getElementById("eDesc").value = "";
      document.getElementById("eStatus").value = "draft";
    }
    openModal(electionModal);
  }

  document.getElementById("saveElection").addEventListener("click", async () => {
    const id = document.getElementById("electionId").value;
    const payload = {
      title: document.getElementById("eTitle").value.trim(),
      description: document.getElementById("eDesc").value.trim(),
      status: document.getElementById("eStatus").value,
    };
    if (!payload.title) return toast("Title is required", "error");
    try {
      if (id) await API.updateElection(id, payload);
      else await API.createElection(payload);
      closeModal(electionModal);
      toast("Election saved", "success");
      await Promise.all([loadStats(), loadElections()]);
    } catch (err) {
      toast(err.message, "error");
    }
  });

  async function deleteElection(id) {
    if (!confirm("Delete this election and all its votes? This cannot be undone."))
      return;
    try {
      await API.deleteElection(id);
      expanded.delete(id);
      toast("Election deleted", "success");
      await Promise.all([loadStats(), loadElections()]);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---------- Candidate modal ----------
  function openCandidateModal(electionId, candidate) {
    document.getElementById("candidateElectionId").value = electionId;
    document.getElementById("candidateId").value = candidate ? candidate.id : "";
    document.getElementById("candidateModalTitle").textContent = candidate
      ? "Edit candidate"
      : "Add candidate";
    document.getElementById("cName").value = candidate ? candidate.name : "";
    document.getElementById("cPosition").value = candidate ? candidate.position : "";
    document.getElementById("cManifesto").value = candidate ? candidate.manifesto : "";
    document.getElementById("cPhoto").value = candidate ? candidate.photo_url : "";
    openModal(candidateModal);
  }

  document.getElementById("saveCandidate").addEventListener("click", async () => {
    const electionId = document.getElementById("candidateElectionId").value;
    const id = document.getElementById("candidateId").value;
    const payload = {
      name: document.getElementById("cName").value.trim(),
      position: document.getElementById("cPosition").value.trim(),
      manifesto: document.getElementById("cManifesto").value.trim(),
      photo_url: document.getElementById("cPhoto").value.trim(),
    };
    if (!payload.name) return toast("Candidate name is required", "error");
    try {
      if (id) await API.updateCandidate(id, payload);
      else await API.addCandidate(electionId, payload);
      closeModal(candidateModal);
      toast("Candidate saved", "success");
      await renderCandidates(electionId);
      await Promise.all([loadStats(), loadElections()]);
    } catch (err) {
      toast(err.message, "error");
    }
  });

  async function deleteCandidate(id, electionId) {
    if (!confirm("Remove this candidate?")) return;
    try {
      await API.deleteCandidate(id);
      toast("Candidate removed", "success");
      await renderCandidates(electionId);
      await Promise.all([loadStats(), loadElections()]);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // ---------- Init + live refresh ----------
  await Promise.all([loadStats(), loadElections()]);
  setInterval(loadStats, 8000);
})();

// Tiny fetch wrapper for the ElectroVote JSON API.
const API = {
  async request(method, path, body) {
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    if (!res.ok) {
      const message = (data && data.error) || "Something went wrong";
      throw new Error(message);
    }
    return data;
  },
  get(path) {
    return this.request("GET", path);
  },
  post(path, body) {
    return this.request("POST", path, body);
  },
  put(path, body) {
    return this.request("PUT", path, body);
  },
  del(path) {
    return this.request("DELETE", path);
  },

  // Domain helpers
  me: () => API.get("/api/me"),
  login: (identifier, password) => API.post("/api/login", { identifier, password }),
  register: (payload) => API.post("/api/register", payload),
  logout: () => API.post("/api/logout"),

  elections: (status) =>
    API.get("/api/elections" + (status ? `?status=${status}` : "")),
  election: (id) => API.get(`/api/elections/${id}`),
  createElection: (payload) => API.post("/api/elections", payload),
  updateElection: (id, payload) => API.put(`/api/elections/${id}`, payload),
  deleteElection: (id) => API.del(`/api/elections/${id}`),

  addCandidate: (electionId, payload) =>
    API.post(`/api/elections/${electionId}/candidates`, payload),
  updateCandidate: (id, payload) => API.put(`/api/candidates/${id}`, payload),
  deleteCandidate: (id) => API.del(`/api/candidates/${id}`),

  vote: (electionId, candidateId) =>
    API.post(`/api/elections/${electionId}/vote`, { candidate_id: candidateId }),
  results: (electionId) => API.get(`/api/elections/${electionId}/results`),

  stats: () => API.get("/api/admin/stats"),
};

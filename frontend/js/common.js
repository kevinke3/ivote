// Shared UI helpers: toast, escaping, initials, auth guards, nav.
function toast(message, type = "") {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.className = "toast " + type;
  el.textContent = message;
  // force reflow so re-triggering animates
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2800);
}

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initials(name) {
  return String(name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function statusBadge(status) {
  const map = {
    active: ["badge-active", "Active"],
    draft: ["badge-draft", "Draft"],
    closed: ["badge-closed", "Closed"],
  };
  const [cls, label] = map[status] || ["badge-closed", status];
  return `<span class="badge dot ${cls}">${label}</span>`;
}

// Returns the current user object or null.
async function getUser() {
  try {
    const { user } = await API.me();
    return user;
  } catch (_) {
    return null;
  }
}

// Guard a page: ensures a user is logged in (and optionally an admin).
async function requireAuth({ admin = false } = {}) {
  const user = await getUser();
  if (!user) {
    window.location.href = "/login.html";
    return null;
  }
  if (admin && user.role !== "admin") {
    window.location.href = "/dashboard.html";
    return null;
  }
  if (!admin && user.role === "admin") {
    // Admins use the admin dashboard.
    window.location.href = "/admin.html";
    return null;
  }
  return user;
}

async function doLogout() {
  try {
    await API.logout();
  } finally {
    window.location.href = "/";
  }
}

// Mobile nav toggle for the landing page.
function initNavToggle() {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }
}

document.addEventListener("DOMContentLoaded", initNavToggle);

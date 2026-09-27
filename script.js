// CodeCraftHub Dashboard
// Plain JavaScript frontend for the CodeCraftHub Flask REST API.
// Every create, read, update, and delete goes through fetch() to the API below.

// Where the Flask backend is running. Change this if you run it elsewhere.
const API_BASE = "http://127.0.0.1:5000";

const STATUSES = ["Not Started", "In Progress", "Completed"];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let allCourses = [];   // Latest list from GET /api/courses
let editingId = null;  // ID of the course being edited, or null when adding
let deletingId = null; // ID of the course waiting for delete confirmation

// ---------------------------------------------------------------------------
// Page elements
// ---------------------------------------------------------------------------

const courseGrid = document.getElementById("courseGrid");
const emptyState = document.getElementById("emptyState");
const loadingState = document.getElementById("loadingState");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const apiBanner = document.getElementById("apiBanner");
const apiBannerText = document.getElementById("apiBannerText");
const modalOverlay = document.getElementById("modalOverlay");
const deleteModalOverlay = document.getElementById("deleteModalOverlay");
const courseForm = document.getElementById("courseForm");
const modalTitle = document.getElementById("modalTitle");
const formError = document.getElementById("formError");
const submitBtn = document.getElementById("submitBtn");
const toast = document.getElementById("toast");

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

// Thrown when the server can't be reached at all (not running, blocked by CORS).
class ConnectionError extends Error {}

/**
 * Call the API and return the parsed JSON.
 * - If the server answers with an error status, throws an Error carrying the
 *   API's own {"error": "..."} message, so validation messages reach the user.
 * - If the server can't be reached, throws a ConnectionError.
 */
async function api(path, options = {}) {
  // Only requests with a JSON body need the Content-Type header. Leaving it
  // off GET and DELETE avoids an extra CORS "preflight" request for each call.
  const headers = options.body ? { "Content-Type": "application/json" } : {};

  let response;
  try {
    response = await fetch(API_BASE + path, { ...options, headers });
  } catch (err) {
    throw new ConnectionError("Cannot connect to the API. Is the Flask server running on port 5000?");
  }

  let data = null;
  try {
    data = await response.json();
  } catch (err) {
    // Response had no JSON body; leave data as null
  }

  if (!response.ok) {
    const message = (data && data.error) || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.className = "toast";
  }, 3000);
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

// "2026-12-31" -> "Dec 31, 2026". Built from parts so the date doesn't shift
// by a day because of time zones.
function formatDate(isoDate) {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isOverdue(course) {
  return course.status !== "Completed" && course.target_date < todayIso();
}

function statusClass(status) {
  return "status-" + status.toLowerCase().replace(/\s+/g, "-");
}

function showApiBanner(message) {
  apiBannerText.textContent = message;
  apiBanner.classList.add("show");
}

function hideApiBanner() {
  apiBanner.classList.remove("show");
}

// ---------------------------------------------------------------------------
// READ: load courses and stats
// ---------------------------------------------------------------------------

async function loadDashboard() {
  loadingState.style.display = "flex";
  courseGrid.style.display = "none";
  emptyState.style.display = "none";

  try {
    // GET /api/courses returns a plain array; /stats returns counts per status
    const [courses, stats] = await Promise.all([
      api("/api/courses"),
      api("/api/courses/stats"),
    ]);
    hideApiBanner();
    allCourses = Array.isArray(courses) ? courses : [];
    renderStats(stats);
    renderCourses();
  } catch (err) {
    allCourses = [];
    renderStats(null);
    renderCourses();
    if (err instanceof ConnectionError) {
      showApiBanner("Is the Flask server running on port 5000? Start it with: python app.py");
    } else {
      showApiBanner(err.message);
    }
  } finally {
    loadingState.style.display = "none";
  }
}

function renderStats(stats) {
  const byStatus = (stats && stats.by_status) || {};
  document.getElementById("totalCourses").textContent = (stats && stats.total_courses) || 0;
  document.getElementById("notStartedCount").textContent = byStatus["Not Started"] || 0;
  document.getElementById("inProgressCount").textContent = byStatus["In Progress"] || 0;
  document.getElementById("completedCount").textContent = byStatus["Completed"] || 0;
}

function renderCourses() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedStatus = statusFilter.value;

  let filtered = allCourses.filter((course) => {
    const matchesSearch =
      !searchTerm ||
      (course.name || "").toLowerCase().includes(searchTerm) ||
      (course.description || "").toLowerCase().includes(searchTerm);
    const matchesStatus = !selectedStatus || course.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Soonest target date first
  filtered = filtered.slice().sort((a, b) => a.target_date.localeCompare(b.target_date));

  courseGrid.innerHTML = "";

  if (allCourses.length === 0) {
    courseGrid.style.display = "none";
    emptyState.style.display = apiBanner.classList.contains("show") ? "none" : "flex";
    return;
  }

  emptyState.style.display = "none";

  if (filtered.length === 0) {
    courseGrid.style.display = "block";
    courseGrid.innerHTML = `
      <div class="empty-state">
        <h2>No matching courses</h2>
        <p>Try adjusting your search or status filter.</p>
      </div>`;
    return;
  }

  courseGrid.style.display = "grid";

  filtered.forEach((course) => {
    const overdue = isOverdue(course);
    const card = document.createElement("div");
    card.className = "course-card";
    card.innerHTML = `
      <div class="course-card-top">
        <h3>${escapeHtml(course.name)}</h3>
      </div>
      <p class="description">${escapeHtml(course.description)}</p>
      <div class="course-card-meta">
        <span class="meta-tag ${statusClass(course.status)}">${escapeHtml(course.status)}</span>
        <span class="meta-tag ${overdue ? "overdue" : "date"}">
          ${overdue ? "Overdue: " : "Target: "}${escapeHtml(formatDate(course.target_date))}
        </span>
      </div>
      <span class="course-created">Added ${escapeHtml(formatDate((course.created_at || "").slice(0, 10)))}</span>
      <div class="course-actions">
        <button class="icon-btn edit" data-action="edit" data-id="${course.id}" aria-label="Edit ${escapeHtml(course.name)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button class="icon-btn delete" data-action="delete" data-id="${course.id}" aria-label="Delete ${escapeHtml(course.name)}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    `;
    courseGrid.appendChild(card);
  });
}

// ---------------------------------------------------------------------------
// CREATE and UPDATE: the add/edit modal
// ---------------------------------------------------------------------------

function openModal(course = null) {
  editingId = course ? course.id : null;
  modalTitle.textContent = course ? "Edit Course" : "New Course";
  submitBtn.textContent = course ? "Update Course" : "Save Course";
  formError.textContent = "";

  if (course) {
    document.getElementById("name").value = course.name;
    document.getElementById("description").value = course.description;
    document.getElementById("target_date").value = course.target_date;
    document.getElementById("status").value = course.status;
  } else {
    courseForm.reset();
    document.getElementById("status").value = "Not Started";
  }

  modalOverlay.classList.add("active");
  setTimeout(() => document.getElementById("name").focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove("active");
  editingId = null;
  formError.textContent = "";
}

async function handleSubmit(event) {
  event.preventDefault();
  formError.textContent = "";

  const payload = {
    name: document.getElementById("name").value.trim(),
    description: document.getElementById("description").value.trim(),
    target_date: document.getElementById("target_date").value, // already YYYY-MM-DD
    status: document.getElementById("status").value,
  };

  // Quick checks before calling the API. The API validates too, and any
  // error it returns is shown below.
  if (!payload.name || !payload.description || !payload.target_date) {
    formError.textContent = "Please fill in the name, description, and target date.";
    return;
  }

  const wasEditing = editingId !== null;
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    if (wasEditing) {
      await api(`/api/courses/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/courses", { method: "POST", body: JSON.stringify(payload) });
    }
    closeModal();
    showToast(wasEditing ? "Course updated" : "Course added");
    await loadDashboard();
  } catch (err) {
    formError.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = wasEditing ? "Update Course" : "Save Course";
  }
}

// ---------------------------------------------------------------------------
// DELETE: confirmation modal
// ---------------------------------------------------------------------------

function openDeleteModal(course) {
  deletingId = course.id;
  document.getElementById("deleteCourseName").textContent = course.name;
  deleteModalOverlay.classList.add("active");
}

function closeDeleteModal() {
  deleteModalOverlay.classList.remove("active");
  deletingId = null;
}

async function handleDelete() {
  if (deletingId === null) return;

  const deleteBtn = document.getElementById("deleteConfirmBtn");
  deleteBtn.disabled = true;
  deleteBtn.textContent = "Deleting...";

  try {
    await api(`/api/courses/${deletingId}`, { method: "DELETE" });
    showToast("Course deleted");
    closeDeleteModal();
    await loadDashboard();
  } catch (err) {
    showToast(err.message, "error");
    closeDeleteModal();
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = "Delete";
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

document.getElementById("addCourseBtn").addEventListener("click", () => openModal());
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("cancelBtn").addEventListener("click", closeModal);
document.getElementById("deleteCancelBtn").addEventListener("click", closeDeleteModal);
document.getElementById("deleteConfirmBtn").addEventListener("click", handleDelete);
document.getElementById("retryBtn").addEventListener("click", loadDashboard);
courseForm.addEventListener("submit", handleSubmit);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

deleteModalOverlay.addEventListener("click", (e) => {
  if (e.target === deleteModalOverlay) closeDeleteModal();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (modalOverlay.classList.contains("active")) closeModal();
    if (deleteModalOverlay.classList.contains("active")) closeDeleteModal();
  }
});

// Edit and delete buttons live inside dynamically created cards,
// so one listener on the grid handles all of them.
courseGrid.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = Number(btn.dataset.id); // API IDs are numbers; dataset values are strings
  const course = allCourses.find((c) => c.id === id);
  if (!course) return;

  if (btn.dataset.action === "edit") openModal(course);
  if (btn.dataset.action === "delete") openDeleteModal(course);
});

searchInput.addEventListener("input", renderCourses);
statusFilter.addEventListener("change", renderCourses);

// Initial load
loadDashboard();

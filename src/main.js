import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

let allCourses = [];
let editingId = null;
let deletingId = null;

const courseGrid = document.getElementById('courseGrid');
const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const searchInput = document.getElementById('searchInput');
const levelFilter = document.getElementById('levelFilter');
const categoryFilter = document.getElementById('categoryFilter');
const modalOverlay = document.getElementById('modalOverlay');
const deleteModalOverlay = document.getElementById('deleteModalOverlay');
const courseForm = document.getElementById('courseForm');
const modalTitle = document.getElementById('modalTitle');
const formError = document.getElementById('formError');
const toast = document.getElementById('toast');

function showToast(message, type = 'success') {
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function updateStats(courses) {
  document.getElementById('totalCourses').textContent = courses.length;
  document.getElementById('beginnerCount').textContent = courses.filter(c => c.level === 'Beginner').length;
  document.getElementById('intermediateCount').textContent = courses.filter(c => c.level === 'Intermediate').length;
  document.getElementById('advancedCount').textContent = courses.filter(c => c.level === 'Advanced').length;
}

function updateCategoryFilter(courses) {
  const categories = [...new Set(courses.map(c => c.category).filter(Boolean))].sort();
  const currentValue = categoryFilter.value;
  categoryFilter.innerHTML = '<option value="">All Categories</option>';
  categories.forEach(cat => {
    const option = document.createElement('option');
    option.value = cat;
    option.textContent = cat;
    categoryFilter.appendChild(option);
  });
  categoryFilter.value = currentValue;
}

function renderCourses() {
  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedLevel = levelFilter.value;
  const selectedCategory = categoryFilter.value;

  let filtered = allCourses;

  if (searchTerm) {
    filtered = filtered.filter(c =>
      (c.title || '').toLowerCase().includes(searchTerm) ||
      (c.instructor || '').toLowerCase().includes(searchTerm) ||
      (c.category || '').toLowerCase().includes(searchTerm)
    );
  }

  if (selectedLevel) {
    filtered = filtered.filter(c => c.level === selectedLevel);
  }

  if (selectedCategory) {
    filtered = filtered.filter(c => c.category === selectedCategory);
  }

  courseGrid.innerHTML = '';

  if (filtered.length === 0) {
    courseGrid.style.display = 'none';
    if (allCourses.length === 0) {
      emptyState.style.display = 'flex';
    } else {
      emptyState.style.display = 'none';
      const noResults = document.createElement('div');
      noResults.className = 'empty-state';
      noResults.style.display = 'flex';
      noResults.innerHTML = `
        <h2>No matching courses</h2>
        <p>Try adjusting your search or filters.</p>
      `;
      courseGrid.style.display = 'block';
      courseGrid.appendChild(noResults);
    }
    return;
  }

  emptyState.style.display = 'none';
  courseGrid.style.display = 'grid';

  filtered.forEach(course => {
    const levelClass = (course.level || '').toLowerCase();
    const card = document.createElement('div');
    card.className = 'course-card';
    card.innerHTML = `
      <div class="course-card-top">
        <h3>${escapeHtml(course.title)}</h3>
      </div>
      ${course.description ? `<p class="description">${escapeHtml(course.description)}</p>` : ''}
      <div class="course-card-meta">
        ${course.level ? `<span class="meta-tag level-${levelClass}">${escapeHtml(course.level)}</span>` : ''}
        ${course.category ? `<span class="meta-tag category">${escapeHtml(course.category)}</span>` : ''}
        ${course.duration_weeks ? `<span class="meta-tag duration">${escapeHtml(String(course.duration_weeks))} weeks</span>` : ''}
      </div>
      ${course.instructor ? `
        <div class="course-instructor">
          <div class="instructor-avatar">${getInitials(course.instructor)}</div>
          <span>${escapeHtml(course.instructor)}</span>
        </div>
      ` : ''}
      <div class="course-actions">
        <button class="icon-btn edit" data-action="edit" data-id="${course.id}" aria-label="Edit course">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </button>
        <button class="icon-btn delete" data-action="delete" data-id="${course.id}" aria-label="Delete course">
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

async function fetchCourses() {
  loadingState.style.display = 'flex';
  courseGrid.style.display = 'none';
  emptyState.style.display = 'none';

  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .order('created_at', { ascending: false });

  loadingState.style.display = 'none';

  if (error) {
    showToast('Failed to load courses', 'error');
    console.error('Fetch error:', error);
    return;
  }

  allCourses = data || [];
  updateStats(allCourses);
  updateCategoryFilter(allCourses);
  renderCourses();
}

function openModal(course = null) {
  editingId = course ? course.id : null;
  modalTitle.textContent = course ? 'Edit Course' : 'New Course';
  formError.textContent = '';

  if (course) {
    document.getElementById('courseId').value = course.id;
    document.getElementById('title').value = course.title || '';
    document.getElementById('description').value = course.description || '';
    document.getElementById('instructor').value = course.instructor || '';
    document.getElementById('category').value = course.category || '';
    document.getElementById('level').value = course.level || 'Beginner';
    document.getElementById('duration_weeks').value = course.duration_weeks || 4;
  document.getElementById('submitBtn').textContent = 'Update Course';
  } else {
    courseForm.reset();
    document.getElementById('courseId').value = '';
    document.getElementById('level').value = 'Beginner';
    document.getElementById('duration_weeks').value = 4;
    document.getElementById('submitBtn').textContent = 'Save Course';
  }

  modalOverlay.classList.add('active');
  setTimeout(() => document.getElementById('title').focus(), 100);
}

function closeModal() {
  modalOverlay.classList.remove('active');
  editingId = null;
  formError.textContent = '';
}

function openDeleteModal(course) {
  deletingId = course.id;
  document.getElementById('deleteCourseName').textContent = course.title;
  deleteModalOverlay.classList.add('active');
}

function closeDeleteModal() {
  deleteModalOverlay.classList.remove('active');
  deletingId = null;
}

async function handleSubmit(e) {
  e.preventDefault();
  formError.textContent = '';

  const payload = {
    title: document.getElementById('title').value.trim(),
    description: document.getElementById('description').value.trim(),
    instructor: document.getElementById('instructor').value.trim(),
    category: document.getElementById('category').value.trim(),
    level: document.getElementById('level').value,
    duration_weeks: parseInt(document.getElementById('duration_weeks').value, 10) || 4,
  };

  if (!payload.title) {
    formError.textContent = 'Title is required';
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving...';

  if (editingId) {
    const { error } = await supabase
      .from('courses')
      .update(payload)
      .eq('id', editingId);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Update Course';

    if (error) {
      formError.textContent = 'Failed to update course. Please try again.';
      console.error('Update error:', error);
      return;
    }

    showToast('Course updated successfully');
    closeModal();
    await fetchCourses();
  } else {
    const { error } = await supabase
      .from('courses')
      .insert(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Course';

    if (error) {
      formError.textContent = 'Failed to create course. Please try again.';
      console.error('Insert error:', error);
      return;
    }

    showToast('Course created successfully');
    closeModal();
    await fetchCourses();
  }
}

async function handleDelete() {
  if (!deletingId) return;

  const deleteBtn = document.getElementById('deleteConfirmBtn');
  deleteBtn.disabled = true;
  deleteBtn.textContent = 'Deleting...';

  const { error } = await supabase
    .from('courses')
    .delete()
    .eq('id', deletingId);

  deleteBtn.disabled = false;
  deleteBtn.textContent = 'Delete';

  if (error) {
    showToast('Failed to delete course', 'error');
    console.error('Delete error:', error);
    closeDeleteModal();
    return;
  }

  showToast('Course deleted successfully');
  closeDeleteModal();
  await fetchCourses();
}

// Event listeners
document.getElementById('addCourseBtn').addEventListener('click', () => openModal());
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
courseForm.addEventListener('submit', handleSubmit);
document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
document.getElementById('deleteConfirmBtn').addEventListener('click', handleDelete);

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

deleteModalOverlay.addEventListener('click', (e) => {
  if (e.target === deleteModalOverlay) closeDeleteModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (modalOverlay.classList.contains('active')) closeModal();
    if (deleteModalOverlay.classList.contains('active')) closeDeleteModal();
  }
});

courseGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const course = allCourses.find(c => c.id === id);
  if (!course) return;

  if (action === 'edit') openModal(course);
  if (action === 'delete') openDeleteModal(course);
});

searchInput.addEventListener('input', renderCourses);
levelFilter.addEventListener('change', renderCourses);
categoryFilter.addEventListener('change', renderCourses);

// Initial load
fetchCourses();

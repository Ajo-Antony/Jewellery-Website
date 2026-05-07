/* ════════════════════════════════════════════════════════════
   THOPPIL JEWELLERY — Admin Dashboard JS (Fixed)
   ════════════════════════════════════════════════════════════ */

let token = localStorage.getItem('tj_admin_token') || '';
let allCategories = [];
let allEnquiries  = [];
let deleteTargetId = null;

const panelTitles = {
  overview: 'Overview',
  categories: 'Collections',
  enquiries: 'Enquiries',
  settings: 'Settings'
};

// ── Toast ──────────────────────────────────────────────────────
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => t.className = '', 3200);
}

// ── API helper ─────────────────────────────────────────────────
async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ── Normalise category from Supabase (snake_case → camelCase) ──
function normaliseCategory(c) {
  return {
    id:          c.id,
    name:        c.name        || '',
    description: c.description || '',
    image:       c.image_url   || c.image || null,   // handle both
    featured:    c.featured    ?? false,
    createdAt:   c.created_at  || c.createdAt || new Date().toISOString()
  };
}

// ── Normalise enquiry from Supabase ────────────────────────────
function normaliseEnquiry(e) {
  return {
    id:        e.id,
    name:      e.name    || '',
    phone:     e.phone   || '',
    email:     e.email   || '',
    message:   e.message || '',
    status:    e.status  || 'new',
    createdAt: e.created_at || e.createdAt || new Date().toISOString()
  };
}

// ── Auth ───────────────────────────────────────────────────────
async function checkAuth() {
  if (!token) return showLogin();
  try {
    const data = await api('/api/admin/verify');
    if (data.valid) showDashboard(data.admin.username);
    else showLogin();
  } catch { showLogin(); }
}

function showLogin() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboard').classList.remove('active');
}

function showDashboard(username) {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').classList.add('active');
  document.getElementById('adminName').textContent = username || 'admin';
  loadAll();
}

// ── Login ──────────────────────────────────────────────────────
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;
  try {
    const data = await api('/api/admin/login', { method: 'POST', body: { username, password } });
    token = data.token;
    localStorage.setItem('tj_admin_token', token);
    showDashboard(username);
  } catch (err) {
    errEl.textContent = err.message || 'Invalid credentials';
  }
});

// ── Logout ─────────────────────────────────────────────────────
document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
  token = '';
  localStorage.removeItem('tj_admin_token');
  showLogin();
});

// ── Sidebar navigation ─────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const panel = item.dataset.panel;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById(`panel-${panel}`).classList.add('active');
    document.getElementById('topbarTitle').textContent = panelTitles[panel] || panel;
    document.getElementById('sidebar').classList.remove('open');
  });
});

document.getElementById('menuToggle').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ── Load ALL data ──────────────────────────────────────────────
async function loadAll() {
  await Promise.all([loadCategories(), loadEnquiries()]);
}

// ── Load Categories ────────────────────────────────────────────
async function loadCategories() {
  try {
    const raw = await api('/api/admin/categories');
    allCategories = (raw || []).map(normaliseCategory);
    renderStats();
    renderTable();
    renderRecent();
  } catch (err) {
    toast('Failed to load collections: ' + err.message, 'error');
  }
}

function renderStats() {
  document.getElementById('statTotal').textContent    = allCategories.length;
  document.getElementById('statFeatured').textContent = allCategories.filter(c => c.featured).length;
  document.getElementById('statImages').textContent   = allCategories.filter(c => c.image).length;
  document.getElementById('statEnquiries').textContent = allEnquiries.length;
  document.getElementById('statNewEnq').textContent    = allEnquiries.filter(e => e.status === 'new').length;
}

function renderTable() {
  const tbody = document.getElementById('catTableBody');
  const empty = document.getElementById('catEmpty');
  if (!allCategories.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = allCategories.map(cat => `
    <tr>
      <td>${cat.image
        ? `<img class="td-thumb" src="${cat.image}" alt="${escHTML(cat.name)}" />`
        : `<div class="td-no-img">◈</div>`}
      </td>
      <td><strong>${escHTML(cat.name)}</strong></td>
      <td style="color:var(--text-muted);max-width:200px;font-size:.8rem">${escHTML(cat.description || '—')}</td>
      <td><span class="badge ${cat.featured ? 'badge-yes' : 'badge-no'}">${cat.featured ? 'Yes' : 'No'}</span></td>
      <td style="color:var(--text-muted);font-size:.78rem">${formatDate(cat.createdAt)}</td>
      <td>
        <div class="action-btns">
          <button class="btn-sm btn-edit" onclick="openEdit(${cat.id})">Edit</button>
          <button class="btn-sm btn-del"  onclick="confirmDelete(${cat.id},'${escHTML(cat.name)}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderRecent() {
  const wrap = document.getElementById('recentCategories');
  const recent = [...allCategories]
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  if (!recent.length) {
    wrap.innerHTML = `<p style="color:var(--text-muted);font-size:.88rem">No collections yet.</p>`;
    return;
  }
  wrap.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Image</th><th>Name</th><th>Featured</th><th>Added</th><th>Actions</th></tr></thead>
    <tbody>${recent.map(cat => `
      <tr>
        <td>${cat.image
          ? `<img class="td-thumb" src="${cat.image}" alt="${escHTML(cat.name)}"/>`
          : `<div class="td-no-img">◈</div>`}</td>
        <td><strong>${escHTML(cat.name)}</strong></td>
        <td><span class="badge ${cat.featured ? 'badge-yes' : 'badge-no'}">${cat.featured ? 'Yes' : 'No'}</span></td>
        <td style="color:var(--text-muted);font-size:.78rem">${formatDate(cat.createdAt)}</td>
        <td><div class="action-btns">
          <button class="btn-sm btn-edit" onclick="openEdit(${cat.id})">Edit</button>
          <button class="btn-sm btn-del"  onclick="confirmDelete(${cat.id},'${escHTML(cat.name)}')">Delete</button>
        </div></td>
      </tr>`).join('')}
    </tbody></table></div>`;

  // Append recent enquiries below
  renderRecentEnquiries();
}

// ── Add / Edit Modal ───────────────────────────────────────────
document.getElementById('addCatBtn').addEventListener('click', () => openModal());
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('catModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function openModal(cat = null) {
  document.getElementById('editId').value       = cat ? cat.id : '';
  document.getElementById('catName').value      = cat ? cat.name : '';
  document.getElementById('catDesc').value      = cat ? cat.description : '';
  document.getElementById('catFeatured').checked = cat ? cat.featured : true;
  document.getElementById('modalTitle').textContent = cat ? 'Edit Collection' : 'Add Collection';
  document.getElementById('catImage').value     = '';
  document.getElementById('previewImg').style.display = 'none';

  const currentWrap = document.getElementById('currentImgWrap');
  const currentImg  = document.getElementById('currentImg');
  if (cat && cat.image) {
    currentImg.src = cat.image;
    currentWrap.style.display = 'block';
  } else {
    currentWrap.style.display = 'none';
  }
  document.getElementById('catModal').classList.add('open');
  document.getElementById('catName').focus();
}

function openEdit(id) {
  const cat = allCategories.find(c => c.id === id);
  if (cat) openModal(cat);
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-panel="categories"]').classList.add('active');
  document.getElementById('panel-categories').classList.add('active');
  document.getElementById('topbarTitle').textContent = 'Collections';
}

function closeModal() {
  document.getElementById('catModal').classList.remove('open');
}

// Image preview
document.getElementById('catImage').addEventListener('change', function() {
  const file = this.files[0];
  const preview = document.getElementById('previewImg');
  if (file) {
    const reader = new FileReader();
    reader.onload = e => { preview.src = e.target.result; preview.style.display = 'block'; };
    reader.readAsDataURL(file);
  }
});

// Drag & drop
const uploadZone = document.getElementById('uploadZone');
uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('drag'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault(); uploadZone.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer(); dt.items.add(file);
    document.getElementById('catImage').files = dt.files;
    const reader = new FileReader();
    reader.onload = ev => {
      const p = document.getElementById('previewImg');
      p.src = ev.target.result; p.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }
});

// Save category
document.getElementById('modalSave').addEventListener('click', async () => {
  const id   = document.getElementById('editId').value;
  const name = document.getElementById('catName').value.trim();
  if (!name) { toast('Collection name is required', 'error'); return; }

  const fd = new FormData();
  fd.append('name',        name);
  fd.append('description', document.getElementById('catDesc').value.trim());
  fd.append('featured',    document.getElementById('catFeatured').checked);
  const imgFile = document.getElementById('catImage').files[0];
  if (imgFile) fd.append('image', imgFile);

  const saveBtn = document.getElementById('modalSave');
  saveBtn.textContent = 'Saving…'; saveBtn.disabled = true;

  try {
    if (id) {
      await api(`/api/admin/categories/${id}`, { method: 'PUT', body: fd });
      toast('Collection updated ✓');
    } else {
      await api('/api/admin/categories', { method: 'POST', body: fd });
      toast('Collection added ✓');
    }
    closeModal();
    await loadCategories();
  } catch (err) {
    toast(err.message || 'Failed to save', 'error');
  } finally {
    saveBtn.textContent = 'Save Collection'; saveBtn.disabled = false;
  }
});

// ── Delete ─────────────────────────────────────────────────────
document.getElementById('confirmClose').addEventListener('click', () =>
  document.getElementById('confirmModal').classList.remove('open'));
document.getElementById('confirmNo').addEventListener('click', () =>
  document.getElementById('confirmModal').classList.remove('open'));
document.getElementById('confirmModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
});

function confirmDelete(id, name) {
  deleteTargetId = id;
  document.getElementById('delName').textContent = name;
  document.getElementById('confirmModal').classList.add('open');
}

document.getElementById('confirmYes').addEventListener('click', async () => {
  if (!deleteTargetId) return;
  try {
    await api(`/api/admin/categories/${deleteTargetId}`, { method: 'DELETE' });
    toast('Collection deleted');
    document.getElementById('confirmModal').classList.remove('open');
    deleteTargetId = null;
    await loadCategories();
  } catch (err) {
    toast(err.message || 'Failed to delete', 'error');
  }
});

// ── Password change ────────────────────────────────────────────
document.getElementById('pwForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById('pwMsg');
  const np = document.getElementById('pwNew').value;
  const cp = document.getElementById('pwConfirm').value;
  if (np !== cp) { msgEl.textContent = 'Passwords do not match'; msgEl.style.color = 'var(--red)'; return; }
  try {
    await api('/api/admin/password', {
      method: 'PUT',
      body: { currentPassword: document.getElementById('pwCurrent').value, newPassword: np }
    });
    toast('Password updated ✓');
    e.target.reset(); msgEl.textContent = '';
  } catch (err) {
    msgEl.textContent = err.message; msgEl.style.color = 'var(--red)';
  }
});

// ══════════════════════════════════════════════════════════════
// ENQUIRIES
// ══════════════════════════════════════════════════════════════

async function loadEnquiries() {
  try {
    const raw = await api('/api/admin/enquiries');
    allEnquiries = (raw || []).map(normaliseEnquiry);
    renderEnquiries();
    renderStats();
    updateEnqBadge();
  } catch (err) {
    toast('Failed to load enquiries: ' + err.message, 'error');
  }
}

function updateEnqBadge() {
  const badge = document.getElementById('newEnqBadge');
  const n = allEnquiries.filter(e => e.status === 'new').length;
  if (n > 0) { badge.textContent = n; badge.style.display = 'inline-flex'; }
  else badge.style.display = 'none';
}

function renderEnquiries() {
  const wrap = document.getElementById('enquiriesWrap');
  if (!wrap) return;
  const f = document.getElementById('enqFilter')?.value || 'all';
  const list = f === 'all' ? allEnquiries : allEnquiries.filter(e => e.status === f);

  if (!list.length) {
    wrap.innerHTML = `<div class="enq-empty"><div class="e-icon">✉</div>
      <p>${f === 'all' ? 'No enquiries yet.' : 'No ' + f + ' enquiries.'}</p></div>`;
    return;
  }

  wrap.innerHTML = list.map(enq => `
    <div class="enq-card enq-${enq.status}" id="enqCard-${enq.id}">
      <div class="enq-header" onclick="toggleEnq(${enq.id})">
        <div class="enq-meta">
          <div class="enq-name">${escHTML(enq.name)}</div>
          <div class="enq-contact">📞 ${escHTML(enq.phone)}${enq.email ? ' · ✉ ' + escHTML(enq.email) : ''}</div>
        </div>
        <div class="enq-right">
          <span class="enq-time">${timeAgo(enq.createdAt)}</span>
          <span class="enq-status status-${enq.status}">${enq.status}</span>
        </div>
      </div>
      <div class="enq-body" id="enqBody-${enq.id}">
        <div class="enq-message">${enq.message
          ? escHTML(enq.message)
          : '<em style="color:var(--text-muted);font-size:.8rem">No message.</em>'}</div>
        <div class="enq-actions">
          ${enq.status !== 'read'    ? `<button class="btn-sm btn-edit" onclick="setEnqStatus(${enq.id},'read')">Mark Read</button>` : ''}
          ${enq.status !== 'replied' ? `<button class="btn-sm btn-edit" onclick="setEnqStatus(${enq.id},'replied')">Mark Replied</button>` : ''}
          ${enq.phone ? `<a href="tel:${escHTML(enq.phone)}" class="btn-sm btn-edit" style="text-decoration:none">📞 Call</a>` : ''}
          ${enq.phone ? `<a href="https://wa.me/91${enq.phone.replace(/\D/g,'')}" target="_blank" class="btn-sm btn-edit" style="text-decoration:none">WhatsApp</a>` : ''}
          ${enq.email ? `<a href="mailto:${escHTML(enq.email)}" class="btn-sm btn-edit" style="text-decoration:none">✉ Email</a>` : ''}
          <button class="btn-sm btn-del" onclick="deleteEnq(${enq.id})">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function renderRecentEnquiries() {
  const wrap = document.getElementById('recentCategories');
  if (!allEnquiries.length || !wrap) return;
  const recent = allEnquiries.slice(0, 3);
  wrap.innerHTML += `
    <h3 class="section-title" style="margin-top:2.5rem">Recent Enquiries</h3>
    ${recent.map(enq => `
      <div class="enq-card enq-${enq.status}" style="margin-bottom:1px">
        <div class="enq-header" style="cursor:default">
          <div class="enq-meta">
            <div class="enq-name">${escHTML(enq.name)}</div>
            <div class="enq-contact">📞 ${escHTML(enq.phone)}</div>
            ${enq.message ? `<div style="font-size:.78rem;color:var(--text-muted);margin-top:.3rem">
              ${escHTML(enq.message.substring(0,80))}${enq.message.length>80?'…':''}</div>` : ''}
          </div>
          <div class="enq-right">
            <span class="enq-time">${timeAgo(enq.createdAt)}</span>
            <span class="enq-status status-${enq.status}">${enq.status}</span>
            <button class="btn-sm btn-edit" onclick="goToEnquiries()">View</button>
          </div>
        </div>
      </div>`).join('')}`;
}

function toggleEnq(id) {
  const body = document.getElementById(`enqBody-${id}`);
  const isOpen = body.classList.contains('open');
  document.querySelectorAll('.enq-body').forEach(b => b.classList.remove('open'));
  if (!isOpen) {
    body.classList.add('open');
    const enq = allEnquiries.find(e => e.id === id);
    if (enq && enq.status === 'new') setEnqStatus(id, 'read', true);
  }
}

async function setEnqStatus(id, status, silent = false) {
  try {
    await api(`/api/admin/enquiries/${id}`, { method: 'PUT', body: { status } });
    const enq = allEnquiries.find(e => e.id === id);
    if (enq) enq.status = status;
    renderEnquiries();
    renderStats();
    updateEnqBadge();
    if (!silent) toast(`Marked as ${status} ✓`);
  } catch { toast('Failed to update', 'error'); }
}

async function deleteEnq(id) {
  if (!confirm('Delete this enquiry?')) return;
  try {
    await api(`/api/admin/enquiries/${id}`, { method: 'DELETE' });
    allEnquiries = allEnquiries.filter(e => e.id !== id);
    renderEnquiries();
    renderStats();
    updateEnqBadge();
    toast('Enquiry deleted');
  } catch { toast('Failed to delete', 'error'); }
}

document.getElementById('enqFilter')?.addEventListener('change', () => renderEnquiries());

document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
  const newOnes = allEnquiries.filter(e => e.status === 'new');
  if (!newOnes.length) { toast('No new enquiries', 'error'); return; }
  await Promise.all(newOnes.map(e =>
    api(`/api/admin/enquiries/${e.id}`, { method: 'PUT', body: { status: 'read' } })
  ));
  newOnes.forEach(e => e.status = 'read');
  renderEnquiries(); renderStats(); updateEnqBadge();
  toast(`Marked ${newOnes.length} as read ✓`);
});

function goToEnquiries() {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-panel="enquiries"]').classList.add('active');
  document.getElementById('panel-enquiries').classList.add('active');
  document.getElementById('topbarTitle').textContent = 'Enquiries';
}

// ── Helpers ────────────────────────────────────────────────────
function escHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});
}
function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60)     return 'just now';
  if (diff < 3600)   return Math.floor(diff/60) + 'm ago';
  if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
  if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
  return new Date(iso).toLocaleDateString('en-IN', {day:'2-digit', month:'short'});
}

// ── Init ───────────────────────────────────────────────────────
checkAuth();
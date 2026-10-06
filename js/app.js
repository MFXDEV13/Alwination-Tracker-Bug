import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { auth } from './firebase-client.js';
import { ADMIN_EMAILS } from './firebase-config.js';

/* =========================================================
  Alwination — Pusat Laporan Bug
   1) Data  2) Helper  3) Shell  4) Dashboard  5) Detail  6) Form  7) Mulai
   ========================================================= */

/* ---------- 1) Data ---------- */
const STATUSES   = ['Baru', 'Dikonfirmasi', 'Dikerjakan', 'Selesai'];
const PRIORITIES = ['Kritis', 'Tinggi', 'Sedang', 'Rendah'];   // urut dari paling parah
const CATEGORIES = ['Mekanik', 'Ekonomi', 'Proteksi', 'Dunia', 'Misi', 'Antarmuka'];
let REPORTS = [];

/* ---------- 2) Helper ---------- */
const $  = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const icon  = name => `<i data-lucide="${name}"></i>`;
const icons = () => window.lucide && lucide.createIcons();   // ubah <i data-lucide> jadi <svg>
const esc   = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fillSelect = (select, placeholder, items) => {
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map(v => `<option>${v}</option>`).join('');
};

function relativeTime(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp?.toDate?.() || timestamp);
  if (Number.isNaN(date.getTime())) return 'Baru saja';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} hari lalu`;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDate(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp?.toDate?.() || timestamp);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

function timestampMillis(timestamp) {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp?.toDate?.() || timestamp);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

async function apiRequest(path, options = {}) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Silakan masuk kembali.'), { status: 401 });
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error || 'Permintaan ke server gagal.'), { status: response.status });
  return result;
}

function reportErrorMessage(error) {
  if (error.status === 401) return 'Sesi login berakhir. Silakan masuk kembali.';
  if (error.status === 403) return 'Akun ini tidak diizinkan melakukan tindakan tersebut.';
  if (error instanceof TypeError) return 'API belum dapat dijangkau. Jalankan melalui Vercel atau periksa deployment API.';
  return error.message || 'MongoDB API gagal memproses permintaan.';
}

let toastTimer;
function toast(message) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.append(el);
  }
  el.textContent = message;
  el.classList.add('is-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-show'), 2500);
}

/* ---------- 3) Shell: topbar, sidebar, footer (dipakai semua halaman) ---------- */
function renderShell() {
  const active = document.body.dataset.nav;   // dashboard | reports | new

  const navLink = ({ key, label, ico, href, count }) => `
    <a class="nav-item ${key && key === active ? 'is-active' : ''}" href="${href}">
      ${icon(ico)}<span>${label}</span>${count ? `<span class="count">${count}</span>` : ''}
    </a>`;

  $('#topbar').innerHTML = `
    <a class="brand" href="index.html">
      <img class="brand__image" src="img/alwination-logo.svg" alt="Alwination — Pusat laporan bug">
    </a>
    <nav class="topbar__nav">
      <a class="is-active" href="index.html">Pelacak bug</a>
      <a href="#">Panduan server</a>
      <a href="#">Komunitas</a>
    </nav>
    <div class="topbar__right">
      <button class="icon-btn" aria-label="Notifikasi">${icon('bell')}<span class="ping"></span></button>
      <div class="profile">
        <button class="user" id="profile-menu-toggle" type="button" aria-label="Buka menu akun" aria-expanded="false" aria-controls="profile-menu">
          <span class="avatar" id="profile-avatar">?</span><span>Profil</span>${icon('chevron-down')}
        </button>
        <div class="profile-menu" id="profile-menu" hidden>
          <strong id="profile-email">Memuat akun…</strong>
          <button id="sign-out" type="button">${icon('log-out')}Keluar</button>
        </div>
      </div>
    </div>`;

  $('#sidebar').innerHTML = `
    <div>
      <p class="nav-label">Menu utama</p>
      <div class="nav-group">
        ${navLink({ key: 'dashboard', label: 'Dashboard',     ico: 'layout-dashboard', href: 'index.html' })}
        ${navLink({ key: 'reports',   label: 'Semua laporan', ico: 'list',             href: 'index.html#laporan' })}
        ${navLink({ key: 'new',       label: 'Laporkan bug',  ico: 'bug',              href: 'lapor.html' })}
      </div>
    </div>
    <div>
      <p class="nav-label">Personal</p>
      <div class="nav-group">
        ${navLink({ label: 'Laporan saya',   ico: 'user',     href: '#' })}
        ${navLink({ label: 'Laporan dikuti', ico: 'bookmark', href: '#' })}
      </div>
    </div>
    <div class="side-card">
      <p class="nav-label">Server Alwination</p>
      <strong><span class="status-dot"></span>Berjalan normal</strong>
      Java 1.21.1 · Survival · Realm 6
    </div>
    <div class="side-card">
      <strong>Butuh bantuan?</strong>
      Baca panduan sebelum mengirim laporan.
      <a href="#">Lihat panduan →</a>
    </div>`;

  $('#footer').innerHTML = `
    <span>© 2026 Alwination. Dibangun bersama komunitas.</span>
    <nav><a href="#">Aturan pelaporan</a><a href="#">Bantuan</a><a href="#">Privasi</a></nav>`;
}

/* ---------- 4) Dashboard: cari, filter, urutkan ---------- */
function initDashboard() {
  const toolbar = $('#toolbar');
  const list = $('#report-list');
  const pager = $('.pager__pages');
  const pageSize = 5;
  const state = { q: '', status: '', priority: '', category: '', sort: 'newest', page: 1 };
  let reportsReady = false;

  fillSelect($('[name=status]', toolbar),   'Semua status',    STATUSES);
  fillSelect($('[name=priority]', toolbar), 'Semua prioritas', PRIORITIES);
  fillSelect($('[name=category]', toolbar), 'Semua kategori',  CATEGORIES);

  const rowHTML = r => `
    <a class="table__row" href="laporan.html?id=${encodeURIComponent(r.id)}">
      <div>
        <div class="row__meta">${esc(r.ticketId)} · ${esc(r.category)}</div>
        <div class="row__title">${esc(r.title)}</div>
        <div class="row__sub"><span>${esc(r.author)}</span><span>${icon('message-square')}${r.comments}</span></div>
      </div>
      <div><span class="badge" data-v="${esc(r.status)}">${esc(r.status)}</span></div>
      <div><span class="prio" data-v="${esc(r.priority)}">${esc(r.priority)}</span></div>
      <div class="muted">${relativeTime(r.updatedAt || r.createdAt)}</div>
    </a>`;

  function render() {
    const q = state.q.trim().toLowerCase();
    const items = REPORTS.filter(r =>
      (!state.status   || r.status === state.status) &&
      (!state.priority || r.priority === state.priority) &&
      (!state.category || r.category === state.category) &&
      (!q || `${r.ticketId} ${r.title} ${r.author}`.toLowerCase().includes(q)));

    if (state.sort === 'oldest') items.sort((a, b) => timestampMillis(a.createdAt) - timestampMillis(b.createdAt));
    else items.sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
    if (state.sort === 'priority') items.sort((a, b) => PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority));

    const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
    state.page = Math.min(state.page, pageCount);
    const start = (state.page - 1) * pageSize;
    const visibleItems = items.slice(start, start + pageSize);

    list.innerHTML = visibleItems.length ? visibleItems.map(rowHTML).join('')
      : `<p class="empty">${reportsReady ? 'Belum ada laporan yang cocok.' : 'Memuat laporan dari Firebase…'}</p>`;
    $('#count').textContent = items.length
      ? `Menampilkan ${start + 1}–${start + visibleItems.length} dari ${items.length} laporan`
      : reportsReady ? 'Menampilkan 0 laporan' : 'Memuat…';
    $('#report-total').textContent = `(${items.length})`;
    const newestReport = [...REPORTS].sort((a, b) =>
      timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt))[0];
    $('#dashboard-updated').textContent = newestReport
      ? `Diperbarui ${relativeTime(newestReport.updatedAt || newestReport.createdAt)}`
      : reportsReady ? 'Belum ada laporan' : 'Memuat data Firebase…';
    for (const status of STATUSES) {
      $(`.stat[data-v="${status}"] .stat__num`).textContent = String(REPORTS.filter(report => report.status === status).length);
    }
    const latest = [...REPORTS]
      .sort((a, b) => timestampMillis(b.updatedAt || b.createdAt) - timestampMillis(a.updatedAt || a.createdAt))
      .slice(0, 3);
    $('#latest-updates').innerHTML = latest.length ? latest.map(report => `
      <li>
        <span class="id">${esc(report.ticketId)}</span>
        <h3>${esc(report.status)} · ${esc(report.title)}</h3>
        <p>Dilaporkan oleh ${esc(report.author || 'Pengguna')}.</p>
        <time>${esc(relativeTime(report.updatedAt || report.createdAt))}</time>
      </li>`).join('') : '<li class="muted">Belum ada aktivitas laporan.</li>';

    const pageButton = (label, page, options = {}) => `
      <button type="button" data-page="${page}" aria-label="${options.label || `Halaman ${page}`}"${options.current ? ' aria-current="page"' : ''}${options.disabled ? ' disabled' : ''}${options.current ? ' class="is-active"' : ''}>${label}</button>`;
    const pageNumbers = new Set([1, pageCount, state.page - 1, state.page, state.page + 1]);
    const pageButtons = [...pageNumbers].filter(page => page >= 1 && page <= pageCount).sort((a, b) => a - b);
    let previousPage = 0;
    let numberedButtons = '';
    for (const page of pageButtons) {
      if (page - previousPage > 1) numberedButtons += '<button type="button" disabled aria-hidden="true">…</button>';
      numberedButtons += pageButton(page, page, { current: page === state.page });
      previousPage = page;
    }
    pager.innerHTML = pageButton(icon('chevron-left'), Math.max(1, state.page - 1), { label: 'Halaman sebelumnya', disabled: state.page === 1 })
      + numberedButtons
      + pageButton(icon('chevron-right'), Math.min(pageCount, state.page + 1), { label: 'Halaman berikutnya', disabled: state.page === pageCount });
    icons();
  }

  $('[name=q]', toolbar).addEventListener('input', e => {
    state.q = e.target.value;
    state.page = 1;
    render();
  });
  toolbar.addEventListener('change', e => {
    if (!Object.hasOwn(state, e.target.name) || e.target.name === 'q' || e.target.name === 'page') return;
    state[e.target.name] = e.target.value;
    state.page = 1;
    render();
  });
  pager.addEventListener('click', e => {
    const button = e.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    render();
  });

  async function loadReports() {
    try {
      const result = await apiRequest('/api/reports');
      REPORTS = result.reports || [];
      reportsReady = true;
      state.page = 1;
      render();
    } catch (error) {
      reportsReady = true;
      list.innerHTML = `<p class="empty">${esc(reportErrorMessage(error))}</p>`;
      $('#count').textContent = 'Gagal memuat laporan';
      toast(reportErrorMessage(error));
    }
  }
  loadReports();
  window.addEventListener('focus', loadReports);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      $('[name=q]', toolbar).focus();
    }
  });

  render();
}

/* ---------- 5) Detail laporan ---------- */
function initDetail() {
  const follow = $('#follow');
  follow.addEventListener('click', () => {
    const on = follow.classList.toggle('is-on');
    $('span', follow).textContent = on ? 'Mengikuti' : 'Ikuti laporan';
  });

  const meToo = $('#me-too');
  meToo.addEventListener('click', () => {
    const on = meToo.classList.toggle('is-on');
    $('#me-too-count').textContent = Number(meToo.dataset.count) + (on ? 1 : 0);
  });

  $('#share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('Tautan laporan disalin.');
    } catch {
      toast('Gagal menyalin tautan.');
    }
  });

  const form = $('#comment-form');
  const reportId = new URLSearchParams(location.search).get('id');
  const submitButton = $('button[type="submit"]', form);
  const deleteButton = $('#delete-report');

  onAuthStateChanged(auth, user => {
    deleteButton.hidden = !user?.emailVerified || !ADMIN_EMAILS.includes(user.email?.toLowerCase());
  });

  if (!reportId) {
    $('#report-title').textContent = 'Laporan tidak ditemukan.';
    $('#report-meta').textContent = 'Buka laporan dari daftar dashboard.';
    form.hidden = true;
    return;
  }

  deleteButton.addEventListener('click', async () => {
    const userEmail = auth.currentUser?.email?.toLowerCase();
    if (!auth.currentUser?.emailVerified || !ADMIN_EMAILS.includes(userEmail)) return;
    if (!confirm('Hapus laporan ini beserta semua komentarnya? Tindakan ini tidak dapat dibatalkan.')) return;

    deleteButton.disabled = true;
    try {
      await apiRequest(`/api/reports/${encodeURIComponent(reportId)}`, { method: 'DELETE' });
      location.replace('index.html#laporan');
    } catch (error) {
      console.error('Gagal menghapus laporan:', error);
      toast(reportErrorMessage(error));
      deleteButton.disabled = false;
    }
  });

  async function loadReport() {
    try {
      const { report } = await apiRequest(`/api/reports/${encodeURIComponent(reportId)}`);
      if (!report) {
      $('#report-title').textContent = 'Laporan tidak ditemukan.';
      $('#report-meta').textContent = 'Laporan mungkin telah dihapus atau tautannya tidak valid.';
      form.hidden = true;
      return;
    }

    const ticketId = report.ticketId || `ALW-${reportId.slice(0, 8).toUpperCase()}`;
    const statusText = report.status || 'Baru';
    const priorityText = report.priority || 'Sedang';
    const author = report.author || 'Pengguna';
    const createdDate = formatDate(report.createdAt);

    $('#report-ticket').textContent = ticketId;
    $('#breadcrumb-ticket').textContent = ticketId;
    document.title = `${ticketId} — Alwination`;
    $('#report-title').textContent = report.title || 'Tanpa judul';
    $('#report-meta').innerHTML = `Dilaporkan oleh <strong>${esc(author)}</strong> · ${esc(createdDate)} · Diperbarui ${esc(relativeTime(report.updatedAt || report.createdAt))}`;
    $('#report-category').textContent = report.category || '—';
    for (const selector of ['#report-status', '#info-status']) {
      $(selector).dataset.v = statusText;
      $(selector).textContent = statusText;
    }
    for (const selector of ['#report-priority', '#info-priority']) {
      $(selector).dataset.v = priorityText;
      $(selector).textContent = priorityText;
    }
    $('#report-notice').textContent = `Status laporan: ${statusText}. Perubahan status terbaru akan ditampilkan di sini.`;
    $('#report-description').textContent = report.description || 'Tidak ada deskripsi.';
    $('#report-steps').innerHTML = String(report.steps || '').split('\n').map(step => step.trim()).filter(Boolean)
      .map(step => `<li>${esc(step.replace(/^\d+[.)]\s*/, ''))}</li>`).join('') || '<li>Tidak ada langkah reproduksi.</li>';
    $('#report-expected').textContent = report.expected || '—';
    $('#report-actual').textContent = report.actual || '—';

    const evidenceLink = $('#report-evidence');
    let safeEvidenceUrl = '';
    try {
      const parsedUrl = new URL(report.evidenceLink);
      if (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:') safeEvidenceUrl = parsedUrl.href;
    } catch { /* Empty or invalid evidence URLs are not rendered as links. */ }
    evidenceLink.innerHTML = safeEvidenceUrl
      ? `<a href="${esc(safeEvidenceUrl)}" target="_blank" rel="noopener noreferrer">${esc(safeEvidenceUrl)}</a>`
      : '<p class="muted">Tidak ada tautan bukti.</p>';

    $('#info-ticket').textContent = ticketId;
    $('#info-author').textContent = author;
    $('#info-category').textContent = report.category || '—';
    $('#info-created').textContent = createdDate;
    $('#info-edition').textContent = report.edition || '—';
    $('#info-version').textContent = report.version || '—';
    $('#info-platform').textContent = report.platform || '—';
    $('#info-realm').textContent = report.realm || '—';
    $('#info-coords').textContent = report.coords || '—';
    $('#info-frequency').textContent = report.frequency || '—';
    $('#report-history').innerHTML = `<li><strong>${esc(statusText)}</strong><small>${esc(author)} · ${esc(createdDate)}</small></li>`;
    } catch (error) {
      $('#report-title').textContent = reportErrorMessage(error);
      form.hidden = true;
    }
  }
  loadReport();

  async function loadComments() {
    try {
      const { comments } = await apiRequest(`/api/reports/${encodeURIComponent(reportId)}/comments`);
      $('#comments').innerHTML = comments.map(comment => {
        const author = comment.author || 'Pengguna';
        const initials = author.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
        return `<article class="comment">
          <span class="avatar">${esc(initials)}</span>
          <div>
            <div class="comment__head"><strong>${esc(author)}</strong><time>${esc(formatDate(comment.createdAt))}</time></div>
            <p>${esc(comment.body || '')}</p>
          </div>
        </article>`;
      }).join('') || '<p class="muted">Belum ada komentar.</p>';
      $('#comment-count').textContent = `${comments.length} komentar`;
    } catch (error) {
      toast(reportErrorMessage(error));
    }
  }
  loadComments();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = form.elements.body.value.trim();
    if (!body) return;
    submitButton.disabled = true;
    try {
      await apiRequest(`/api/reports/${encodeURIComponent(reportId)}/comments`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      form.reset();
      await loadComments();
      await loadReport();
    } catch (error) {
      console.error('Gagal menyimpan komentar:', error);
      toast(reportErrorMessage(error));
    } finally {
      submitButton.disabled = false;
    }
  });
}

/* ---------- 6) Form laporkan bug ---------- */
function initReportForm() {
  const form = $('#report-form');
  const DRAFT_KEY = 'alwination-bug-draft';

  fillSelect(form.elements.category, 'Pilih kategori', CATEGORIES);
  fillSelect(form.elements.priority, 'Pilih tingkat keparahan', [...PRIORITIES].reverse());

  // --- Draf: simpan & pulihkan isian lewat localStorage ---
  const textFields = [...form.elements].filter(el => el.name && el.type !== 'checkbox');
  let draft = {};
  try {
    const savedDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
    if (savedDraft && typeof savedDraft === 'object' && !Array.isArray(savedDraft)) draft = savedDraft;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    toast('Draf lama tidak dapat dibaca dan telah dihapus.');
  }
  textFields.forEach(el => { if (typeof draft[el.name] === 'string') el.value = draft[el.name]; });

  $('#save-draft').addEventListener('click', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(textFields.map(el => [el.name, el.value]))));
    toast('Draf disimpan di browser ini.');
  });

  // --- Kirim: validasi `required` sudah ditangani browser sebelum event ini jalan ---
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const submitButton = $('button[type="submit"]', form);
    submitButton.disabled = true;
    try {
      const report = Object.fromEntries(new FormData(form));
      delete report.confirm;
      for (const [key, value] of Object.entries(report)) {
        if (typeof value === 'string') report[key] = value.trim();
      }
      const result = await apiRequest('/api/reports', {
        method: 'POST',
        body: JSON.stringify(report),
      });
      localStorage.removeItem(DRAFT_KEY);
      location.assign(`laporan.html?id=${encodeURIComponent(result.report.id)}`);
    } catch (error) {
      console.error('Gagal menyimpan laporan:', error);
      toast(reportErrorMessage(error));
      submitButton.disabled = false;
    }
  });
}

/* ---------- 7) Mulai ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderShell();
  if ($('#report-list'))  initDashboard();
  if ($('#comment-form')) initDetail();
  if ($('#report-form'))  initReportForm();
  icons();
});
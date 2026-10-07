import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { auth } from './firebase-client.js';
import { isFirebaseConfigured } from './firebase-config.js';

const isLoginPage = document.body.dataset.authPage === 'login';
const signInButton = document.querySelector('#google-sign-in');
const message = document.querySelector('#auth-message');
const showMessage = text => {
  if (message) message.textContent = text;
};

/* Verifikasi akses lewat server (sumber kebenaran: env + koleksi access MongoDB) */
async function fetchMe(user, forceRefresh = false) {
  const token = await user.getIdToken(forceRefresh);
  return fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } });
}

async function verifyAccess(user) {
  try {
    let response = await fetchMe(user);
    if (response.status === 401) response = await fetchMe(user, true);
    if (response.ok) return true;

    if (response.status === 403) {
      await signOut(auth);
      showMessage('Email ini belum diizinkan mengakses pusat laporan. Hubungi admin untuk menambahkan akses.');
      return false;
    }

    showMessage(response.status === 404
      ? 'API belum ter-deploy di Vercel. Deploy ulang lalu coba lagi.'
      : `Sesi login berakhir. Silakan masuk kembali. (${response.status})`);
    return false;
  } catch {
    return true;
  }
}

function renderProfile(user) {
  const update = () => {
    const name = document.querySelector('#profile-name');
    const email = document.querySelector('#profile-email');
    const avatar = document.querySelector('#profile-avatar');
    const label = user.displayName || user.email || 'Akun Google';
    if (name) name.textContent = user.displayName || user.email || 'Akun Google';
    if (email) email.textContent = user.email || '';
    if (avatar) avatar.textContent = label
      .trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  };

  if (!document.querySelector('#profile-name')) document.addEventListener('DOMContentLoaded', update, { once: true });
  else update();
}

function returnTarget() {
  const requested = new URLSearchParams(location.search).get('next') || 'index.html';
  const page = requested.split(/[?#]/, 1)[0];
  return ['index.html', 'lapor.html', 'laporan.html', 'admin.html'].includes(page) ? requested : 'index.html';
}

function redirectToLogin() {
  const current = `${location.pathname.split('/').pop()}${location.search}${location.hash}`;
  location.replace(`login.html?next=${encodeURIComponent(current)}`);
}

if (!isFirebaseConfigured) {
  if (isLoginPage) {
    if (signInButton) signInButton.disabled = true;
    showMessage('Login belum aktif. Isi konfigurasi Firebase di js/firebase-config.js terlebih dahulu.');
  } else {
    location.replace('login.html?setup=required');
  }
} else {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (signInButton) {
    signInButton.addEventListener('click', async () => {
      signInButton.disabled = true;
      showMessage('Menghubungkan ke Google…');
      try {
        const { user } = await signInWithPopup(auth, provider);
        if (!(await verifyAccess(user))) return;
        location.replace(returnTarget());
      } catch (error) {
        const messages = {
          'auth/configuration-not-found': 'Firebase Authentication belum disiapkan. Buka Firebase Console > Authentication, lalu pilih Get started.',
          'auth/operation-not-allowed': 'Google Sign-In belum aktif. Aktifkan Google di Firebase Console > Authentication > Sign-in method.',
          'auth/unauthorized-domain': 'Domain ini belum diizinkan. Tambahkan hostname aplikasi di Firebase Console > Authentication > Settings > Authorized domains.',
          'auth/popup-blocked': 'Popup login diblokir browser. Izinkan popup lalu coba lagi.',
          'auth/network-request-failed': 'Koneksi ke Firebase gagal. Periksa internet lalu coba lagi.',
        };
        showMessage(messages[error.code] || `Login gagal (${error.code || 'error tidak diketahui'}). Periksa Firebase Console dan coba lagi.`);
      } finally {
        signInButton.disabled = false;
      }
    });
  }

  document.addEventListener('click', async event => {
    if (event.target.closest('#sign-out')) {
      await signOut(auth);
      location.replace('login.html');
      return;
    }

    const toggle = event.target.closest('#profile-menu-toggle');
    const menu = document.querySelector('#profile-menu');
    if (toggle && menu) {
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!isOpen));
      menu.hidden = isOpen;
      return;
    }

    if (!event.target.closest('#profile-menu')) {
      const profileToggle = document.querySelector('#profile-menu-toggle');
      const profileMenu = document.querySelector('#profile-menu');
      if (profileToggle && profileMenu) {
        profileToggle.setAttribute('aria-expanded', 'false');
        profileMenu.hidden = true;
      }
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const toggle = document.querySelector('#profile-menu-toggle');
    const menu = document.querySelector('#profile-menu');
    if (toggle && menu) {
      toggle.setAttribute('aria-expanded', 'false');
      menu.hidden = true;
    }
  });

  onAuthStateChanged(auth, async user => {
    if (isLoginPage) {
      if (!user) return;
      if (!(await verifyAccess(user))) return;
      location.replace(returnTarget());
      return;
    }

    if (!user) {
      redirectToLogin();
      return;
    }
    if (!(await verifyAccess(user))) {
      location.replace('login.html?error=unauthorized');
      return;
    }

    renderProfile(user);
    document.body.classList.remove('auth-pending');
  });
}

if (isLoginPage && new URLSearchParams(location.search).get('error') === 'unauthorized') {
  showMessage('Email ini belum diizinkan mengakses pusat laporan.');
}


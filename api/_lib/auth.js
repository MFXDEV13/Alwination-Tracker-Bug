import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from './mongo.js';

/** Email pemilik selalu berlevel admin dan tidak dapat diturunkan. */
export const OWNER_EMAIL = 'azwarptk5@gmail.com';

function getAdminAuth() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');
  if (!getApps().length) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT bukan JSON yang valid. Periksa Environment Variables Vercel (harus satu nilai JSON utuh).');
    }
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAuth();
}

/** Baca variabel env berisi daftar email (dipisah koma) → array email lowercase, tidak kosong. */
export function envEmailList(variable, fallback = '') {
  return (process.env[variable] || fallback).split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

/** Baca entri akses dari koleksi `access`; null bila tak ada/DB bermasalah. */
async function getAccessEntry(email) {
  try {
    const database = await getDatabase();
    return await database.collection('access').findOne({ email });
  } catch {
    return null;
  }
}

/** Username Minecraft pengguna (dari `access.username`), atau null bila belum diisi. */
async function getUsername(email) {
  try {
    const entry = await getAccessEntry(email);
    const username = entry?.username;
    return typeof username === 'string' && username.trim() ? username.trim() : null;
  } catch {
    return null;
  }
}

/* Nama yang ditampilkan: username Minecraft (jika ada) > nama Google > email. */
export const displayName = user => (user?.username || user?.name || user?.email || 'Pengguna');

/**
 * Level akses (admin/trusted/null) dengan prioritas:
 * OWNER_EMAIL > ADMIN_EMAILS > TRUSTED_EMAILS > koleksi `access`.
 */
export async function getAccessLevel(email) {
  email = (email || '').toLowerCase();
  if (!email) return null;
  if (email === OWNER_EMAIL) return 'admin';
  if (envEmailList('ADMIN_EMAILS').includes(email)) return 'admin';
  if (envEmailList('TRUSTED_EMAILS', process.env.ADMIN_EMAILS).includes(email)) return 'trusted';
  const entry = await getAccessEntry(email);
  if (entry && entry.role === 'admin') return 'admin';
  if (entry && entry.role === 'trusted') return 'trusted';
  return null;
}

/**
 * Verifikasi Bearer token Firebase dan pastikan akun berhak akses.
 * Menempelkan `user.username` bila sukses. Mengirim respons error & return null bila gagal.
 */
export async function requireTrustedUser(req, res) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Anda belum masuk. Silakan login untuk melanjutkan.' });
    return null;
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    res.status(500).json({ error: 'FIREBASE_SERVICE_ACCOUNT belum dikonfigurasi di server (Environment Variables Vercel).' });
    return null;
  }

  let user;
  try {
    user = await getAdminAuth().verifyIdToken(token);
  } catch (error) {
    const message = /FIREBASE_SERVICE_ACCOUNT|JSON|project/i.test(error?.message || '')
      ? `Konfigurasi server tidak valid: ${error.message}`
      : 'Sesi tidak valid atau sudah kedaluwarsa. Silakan masuk kembali.';
    res.status(401).json({ error: message });
    return null;
  }

  if (!user.email_verified || !(await getAccessLevel(user.email))) {
    res.status(403).json({ error: 'Akun ini belum diizinkan mengakses pusat laporan.' });
    return null;
  }
  user.username = await getUsername(user.email);
  return user;
}

/** Sama seperti requireTrustedUser, plus mensyaratkan level akses admin. */
export async function requireAdmin(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return null;
  if ((await getAccessLevel(user.email)) !== 'admin') {
    res.status(403).json({ error: 'Tindakan ini khusus pengguna dengan akses admin.' });
    return null;
  }
  return user;
}
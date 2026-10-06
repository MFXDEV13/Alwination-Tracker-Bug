import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from './mongo.js';

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

function emailList(variable, fallback = '') {
  return (process.env[variable] || fallback).split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

async function getAccessEntry(email) {
  try {
    const database = await getDatabase();
    return await database.collection('access').findOne({ email });
  } catch {
    return null;
  }
}

export async function getAccessLevel(email) {
  email = (email || '').toLowerCase();
  if (!email) return null;
  if (email === 'azwarptk5@gmail.com') return 'admin';
  if (emailList('ADMIN_EMAILS').includes(email)) return 'admin';
  if (emailList('TRUSTED_EMAILS', process.env.ADMIN_EMAILS).includes(email)) return 'trusted';
  const entry = await getAccessEntry(email);
  if (entry && entry.role === 'admin') return 'admin';
  if (entry && entry.role === 'trusted') return 'trusted';
  return null;
}

export async function requireTrustedUser(req, res) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Sign-in required.' });
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
      : 'Invalid or expired sign-in token.';
    res.status(401).json({ error: message });
    return null;
  }

  if (!user.email_verified || !(await getAccessLevel(user.email))) {
    res.status(403).json({ error: 'This account is not allowed to access reports.' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return null;
  if ((await getAccessLevel(user.email)) !== 'admin') {
    res.status(403).json({ error: 'Administrator access required.' });
    return null;
  }
  return user;
}
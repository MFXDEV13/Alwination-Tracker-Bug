import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function getAdminAuth() {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('FIREBASE_SERVICE_ACCOUNT is not configured.');
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getAuth();
}

function emailList(variable, fallback = '') {
  return (process.env[variable] || fallback).split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

export async function requireTrustedUser(req, res) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Sign-in required.' });
    return null;
  }

  let user;
  try {
    user = await getAdminAuth().verifyIdToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired sign-in token.' });
    return null;
  }

  if (!user.email_verified || !emailList('TRUSTED_EMAILS', process.env.ADMIN_EMAILS).includes(user.email?.toLowerCase())) {
    res.status(403).json({ error: 'This account is not allowed to access reports.' });
    return null;
  }
  return user;
}

export async function requireAdmin(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return null;
  if (!emailList('ADMIN_EMAILS').includes(user.email?.toLowerCase())) {
    res.status(403).json({ error: 'Administrator access required.' });
    return null;
  }
  return user;
}
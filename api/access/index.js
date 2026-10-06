import { requireAdmin } from '../_lib/auth.js';
import { getDatabase } from '../_lib/mongo.js';
import { sendServerError } from '../_lib/reports.js';

const ROLES = ['admin', 'trusted'];
const OWNER_EMAIL = 'azwarptk5@gmail.com';

function envEmails(variable, fallback = '') {
  return (process.env[variable] || fallback).split(',').map(email => email.trim().toLowerCase()).filter(Boolean);
}

function isEnvManaged(email) {
  const admins = envEmails('ADMIN_EMAILS');
  const trusted = envEmails('TRUSTED_EMAILS', process.env.ADMIN_EMAILS);
  return email === OWNER_EMAIL || admins.includes(email) || trusted.includes(email);
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const access = (await getDatabase()).collection('access');

    if (req.method === 'GET') {
      const documents = await access.find({}).toArray();
      const merged = new Map();

      for (const document of documents) {
        merged.set(document.email, { email: document.email, role: document.role, source: 'manual', createdAt: document.createdAt });
      }
      // Prioritas: DB < env TRUSTED < env ADMIN < owner. Role yang akhir dikalahkan.
      for (const email of envEmails('TRUSTED_EMAILS', process.env.ADMIN_EMAILS)) {
        merged.set(email, { email, role: 'trusted', source: 'env' });
      }
      for (const email of envEmails('ADMIN_EMAILS')) {
        merged.set(email, { email, role: 'admin', source: 'env' });
      }
      merged.set(OWNER_EMAIL, { email: OWNER_EMAIL, role: 'admin', source: 'owner' });

      const list = [...merged.values()].sort(
        (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.email.localeCompare(b.email),
      );
      res.status(200).json({ access: list });
      return;
    }

    if (req.method === 'POST') {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const role = typeof req.body?.role === 'string' ? req.body.role : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Email tidak valid.' });
        return;
      }
      if (!ROLES.includes(role)) {
        res.status(400).json({ error: 'Role tidak valid.' });
        return;
      }
      if (isEnvManaged(email)) {
        res.status(400).json({ error: 'Akses email ini berasal dari environment variables dan tidak bisa diubah di panel.' });
        return;
      }
      await access.updateOne({ email }, { $set: { email, role, createdAt: new Date() } }, { upsert: true });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === 'DELETE') {
      const email = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : '';
      if (!email) {
        res.status(400).json({ error: 'Email tidak ditemukan.' });
        return;
      }
      await access.deleteOne({ email });
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST, DELETE');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    sendServerError(res, error);
  }
}
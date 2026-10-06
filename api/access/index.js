import { envEmailList, OWNER_EMAIL, requireAdmin } from '../_lib/auth.js';
import { getDatabase } from '../_lib/mongo.js';
import { sendServerError } from '../_lib/reports.js';

const ROLES = ['admin', 'trusted'];
const USERNAME_RULE = /^[A-Za-z0-9_]{1,24}$/;

/* Role efektif dari env/owner untuk sebuah email; null = tidak dikelola env. */
function envRoleFor(email) {
  if (email === OWNER_EMAIL) return 'admin';
  if (envEmailList('ADMIN_EMAILS').includes(email)) return 'admin';
  if (envEmailList('TRUSTED_EMAILS', process.env.ADMIN_EMAILS).includes(email)) return 'trusted';
  return null;
}

export default async function handler(req, res) {
  const user = await requireAdmin(req, res);
  if (!user) return;

  try {
    const access = (await getDatabase()).collection('access');

    if (req.method === 'GET') {
      const documents = await access.find({}).sort({ role: 1, email: 1 }).toArray();
      const manual = new Map(documents.map(document => [document.email, document]));
      const merged = new Map();

      for (const document of documents) {
        merged.set(document.email, {
          email: document.email,
          role: document.role,
          username: document.username || null,
          source: 'manual',
          createdAt: document.createdAt,
        });
      }
      // Prioritas: DB < env TRUSTED < env ADMIN < owner. Role yang akhir dikalahkan,
      // sedangkan username tetap dipertahankan dari DB bila sudah diisi.
      for (const email of envEmailList('TRUSTED_EMAILS', process.env.ADMIN_EMAILS)) {
        merged.set(email, { email, role: 'trusted', username: manual.get(email)?.username || null, source: 'env', createdAt: null });
      }
      for (const email of envEmailList('ADMIN_EMAILS')) {
        merged.set(email, { email, role: 'admin', username: manual.get(email)?.username || null, source: 'env', createdAt: null });
      }
      merged.set(OWNER_EMAIL, {
        email: OWNER_EMAIL, role: 'admin', username: manual.get(OWNER_EMAIL)?.username || null, source: 'owner', createdAt: null,
      });

      const list = [...merged.values()].sort(
        (a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.email.localeCompare(b.email),
      );
      res.status(200).json({ access: list });
      return;
    }

    if (req.method === 'POST') {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      const role = typeof req.body?.role === 'string' ? req.body.role : '';
      const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Email tidak valid.' });
        return;
      }
      if (!ROLES.includes(role)) {
        res.status(400).json({ error: 'Role tidak valid.' });
        return;
      }
      if (!USERNAME_RULE.test(username)) {
        res.status(400).json({ error: 'Username Minecraft wajib diisi: 1–24 karakter, huruf/angka/garis bawah.' });
        return;
      }

      const envRole = envRoleFor(email);
      if (envRole && role !== envRole) {
        res.status(400).json({ error: 'Role akun ini diatur dari environment variables dan tidak bisa diubah di panel.' });
        return;
      }

      await access.updateOne(
        { email },
        { $set: { email, role, username }, $setOnInsert: { createdAt: new Date() } },
        { upsert: true },
      );
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
    res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
  } catch (error) {
    sendServerError(res, error);
  }
}

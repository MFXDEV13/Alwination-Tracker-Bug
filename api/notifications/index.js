import { requireTrustedUser } from '../_lib/auth.js';
import { getDatabase } from '../_lib/mongo.js';
import { sendServerError, serializeDocument } from '../_lib/reports.js';

export default async function handler(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return;

  try {
    const notifications = (await getDatabase()).collection('notifications');

    if (req.method === 'GET') {
      const [documents, unread] = await Promise.all([
        notifications.find({}).sort({ createdAt: -1 }).limit(50).toArray(),
        notifications.countDocuments({ read: false }),
      ]);
      res.status(200).json({ notifications: documents.map(serializeDocument), unread });
      return;
    }

    if (req.method === 'POST') {
      await notifications.updateMany({ read: false }, { $set: { read: true, readAt: new Date() } });
      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
  } catch (error) {
    sendServerError(res, error);
  }
}
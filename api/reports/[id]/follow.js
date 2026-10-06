import { requireTrustedUser } from '../../_lib/auth.js';
import { getDatabase } from '../../_lib/mongo.js';
import { parseReportId, sendServerError, serializeDocument } from '../../_lib/reports.js';

export default async function handler(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return;

  const id = parseReportId(req.query.id);
  if (!id) {
    res.status(400).json({ error: 'ID laporan tidak valid.' });
    return;
  }

  try {
    const database = await getDatabase();
    const reports = database.collection('reports');
    const follows = database.collection('follows');
    const email = user.email;

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
      return;
    }

    const report = await reports.findOne({ _id: id });
    if (!report) {
      res.status(404).json({ error: 'Laporan tidak ditemukan.' });
      return;
    }

    const follow = req.body?.follow;
    if (typeof follow !== 'boolean') {
      res.status(400).json({ error: 'Nilai follow harus boolean.' });
      return;
    }

    const reportId = String(id);
    if (follow) {
      await follows.updateOne(
        { email, reportId },
        { $set: { email, reportId, createdAt: new Date() } },
        { upsert: true },
      );
    } else {
      await follows.deleteOne({ email, reportId });
    }

    res.status(200).json({ followed: follow });
  } catch (error) {
    sendServerError(res, error);
  }
}
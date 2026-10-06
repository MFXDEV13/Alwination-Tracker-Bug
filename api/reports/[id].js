import { displayName, requireAdmin, requireTrustedUser } from '../_lib/auth.js';
import { getDatabase, getMongoClient } from '../_lib/mongo.js';
import { getFollowedReportIds, parseReportId, sendServerError, serializeDocument, STATUSES } from '../_lib/reports.js';

export default async function handler(req, res) {
  const user = ['DELETE', 'PATCH'].includes(req.method)
    ? await requireAdmin(req, res)
    : await requireTrustedUser(req, res);
  if (!user) return;

  const id = parseReportId(req.query.id);
  if (!id) {
    res.status(400).json({ error: 'ID laporan tidak valid.' });
    return;
  }

  try {
    const database = await getDatabase();
    const reports = database.collection('reports');

    if (req.method === 'GET') {
      const report = await reports.findOne({ _id: id });
      if (!report) {
        res.status(404).json({ error: 'Laporan tidak ditemukan.' });
        return;
      }
      const followedIds = await getFollowedReportIds(database, user.email);
      res.status(200).json({ report: { ...serializeDocument(report), followed: followedIds.has(String(id)) } });
      return;
    }

    if (req.method === 'PATCH') {
      const status = typeof req.body?.status === 'string' ? req.body.status : '';
      if (!STATUSES.includes(status)) {
        res.status(400).json({ error: 'Status tidak valid.' });
        return;
      }
      const now = new Date();
      const result = await reports.updateOne(
        { _id: id },
        {
          $set: { status, updatedAt: now },
          $push: { history: { status, author: displayName(user), authorEmail: user.email, at: now } },
        },
      );
      if (result.matchedCount !== 1) {
        res.status(404).json({ error: 'Laporan tidak ditemukan.' });
        return;
      }
      const updated = await reports.findOne({ _id: id });
      res.status(200).json({ report: serializeDocument(updated) });
      return;
    }

    if (req.method === 'DELETE') {
      const client = await getMongoClient();
      const session = client.startSession();
      let deleted = false;
      try {
        await session.withTransaction(async () => {
          const report = await reports.findOne({ _id: id }, { session });
          if (!report) return;
          await database.collection('comments').deleteMany({ reportId: id }, { session });
          const result = await reports.deleteOne({ _id: id }, { session });
          deleted = result.deletedCount === 1;
        });
      } finally {
        await session.endSession();
      }
      if (!deleted) {
        res.status(404).json({ error: 'Laporan tidak ditemukan.' });
        return;
      }
      res.status(200).json({ deleted: true });
      return;
    }

    res.setHeader('Allow', 'GET, PATCH, DELETE');
    res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
  } catch (error) {
    sendServerError(res, error);
  }
}
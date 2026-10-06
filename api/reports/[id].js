import { requireAdmin, requireTrustedUser } from '../_lib/auth.js';
import { getDatabase, getMongoClient } from '../_lib/mongo.js';
import { parseReportId, serializeDocument, sendServerError } from '../_lib/reports.js';

export default async function handler(req, res) {
  const user = req.method === 'DELETE'
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
      res.status(200).json({ report: serializeDocument(report) });
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

    res.setHeader('Allow', 'GET, DELETE');
    res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    sendServerError(res, error);
  }
}
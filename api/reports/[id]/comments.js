import { ObjectId } from 'mongodb';
import { displayName, requireTrustedUser } from '../../_lib/auth.js';
import { getDatabase, getMongoClient } from '../../_lib/mongo.js';
import { parseReportId, serializeDocument, sendServerError } from '../../_lib/reports.js';

export default async function handler(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return;

  const reportId = parseReportId(req.query.id);
  if (!reportId) {
    res.status(400).json({ error: 'ID laporan tidak valid.' });
    return;
  }

  try {
    const database = await getDatabase();
    const reports = database.collection('reports');
    const comments = database.collection('comments');

    if (req.method === 'GET') {
      const documents = await comments.find({ reportId }).sort({ createdAt: 1 }).limit(1000).toArray();
      res.status(200).json({ comments: documents.map(serializeDocument) });
      return;
    }

    if (req.method === 'POST') {
      const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
      if (!body || body.length > 3000) {
        res.status(400).json({ error: 'Komentar wajib diisi dan maksimal 3000 karakter.' });
        return;
      }

      const client = await getMongoClient();
      const session = client.startSession();
      const comment = {
        _id: new ObjectId(),
        reportId,
        body,
        author: displayName(user),
        authorEmail: user.email,
        createdAt: new Date(),
      };
      let reportExists = false;
      try {
        await session.withTransaction(async () => {
          const result = await reports.updateOne(
            { _id: reportId },
            { $inc: { comments: 1 }, $set: { updatedAt: comment.createdAt } },
            { session },
          );
          if (result.matchedCount !== 1) return;
          reportExists = true;
          await comments.insertOne(comment, { session });
        });
      } finally {
        await session.endSession();
      }
      if (!reportExists) {
        res.status(404).json({ error: 'Laporan tidak ditemukan.' });
        return;
      }
      res.status(201).json({ comment: serializeDocument(comment) });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
  } catch (error) {
    sendServerError(res, error);
  }
}
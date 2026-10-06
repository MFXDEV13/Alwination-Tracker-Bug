import { ObjectId } from 'mongodb';
import { displayName, requireTrustedUser } from '../_lib/auth.js';
import { getDatabase } from '../_lib/mongo.js';
import { getFollowedReportIds, serializeDocument, sendServerError, validateReport } from '../_lib/reports.js';

export default async function handler(req, res) {
  const user = await requireTrustedUser(req, res);
  if (!user) return;

  try {
    const reports = (await getDatabase()).collection('reports');

    if (req.method === 'GET') {
      const followedIds = await getFollowedReportIds(await getDatabase(), user.email);
      const documents = await reports.find({}).sort({ createdAt: -1 }).limit(1000).toArray();
      res.status(200).json({
        reports: documents.map(report => ({ ...serializeDocument(report), followed: followedIds.has(String(report._id)) })),
      });
      return;
    }

    if (req.method === 'POST') {
      const validated = validateReport(req.body || {});
      if (typeof validated === 'string') {
        res.status(400).json({ error: validated });
        return;
      }

      const id = new ObjectId();
      const now = new Date();
      const report = {
        _id: id,
        ...validated,
        ticketId: `ALW-${id.toHexString().slice(-8).toUpperCase()}`,
        author: displayName(user),
        authorEmail: user.email,
        status: 'Baru',
        comments: 0,
        createdAt: now,
        updatedAt: now,
        history: [{ status: 'Baru', author: displayName(user), authorEmail: user.email, at: now }],
      };
      await reports.insertOne(report);
      await (await getDatabase()).collection('notifications').insertOne({
        _id: new ObjectId(),
        type: 'new_report',
        reportId: String(id),
        ticketId: report.ticketId,
        title: validated.title,
        author: report.author,
        read: false,
        createdAt: now,
      });
      res.status(201).json({ report: serializeDocument(report) });
      return;
    }

    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Metode permintaan tidak didukung.' });
  } catch (error) {
    sendServerError(res, error);
  }
}
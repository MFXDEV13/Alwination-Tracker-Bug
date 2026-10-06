import { getAccessLevel, requireTrustedUser } from './_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  const user = await requireTrustedUser(req, res);
  if (!user) return;

  const level = await getAccessLevel(user.email);
  res.status(200).json({
    profile: {
      email: user.email,
      name: user.name || user.email,
      username: user.username || null,
      isTrusted: true,
      isAdmin: level === 'admin',
      accessLevel: level,
    },
  });
}
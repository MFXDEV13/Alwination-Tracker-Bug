import { ObjectId } from 'mongodb';

export const STATUSES = ['Baru', 'Dikonfirmasi', 'Dikerjakan', 'Selesai'];
export const CATEGORIES = ['Mekanik', 'Ekonomi', 'Proteksi', 'Dunia', 'Misi', 'Antarmuka'];
export const PRIORITIES = ['Kritis', 'Tinggi', 'Sedang', 'Rendah'];
export const EDITIONS = ['Java Edition', 'Bedrock Edition'];
export const PLATFORMS = ['Windows', 'macOS', 'Linux', 'Android', 'iOS'];
export const REALMS = [
  'OneBlock SlimeFun', 'OneBlock Classic', 'Tycoon', 'Survival SlimeFun',
  'Survival RPG', 'Earth', 'Survival War', 'Arena PVP', 'Semi Vanilla',
];
export const FREQUENCIES = ['Selalu', 'Sering', 'Kadang-kadang', 'Sekali saja'];

export function parseReportId(value) {
  return ObjectId.isValid(value) ? new ObjectId(value) : null;
}

export function serializeDocument(document) {
  if (!document) return null;
  const { _id, ...fields } = document;
  return { ...fields, id: String(_id) };
}

export function validateReport(data) {
  const text = (value, min, max) => typeof value === 'string' && value.trim().length >= min && value.length <= max;
  let evidenceLink = '';
  if (data.evidenceLink) {
    try {
      const parsed = new URL(data.evidenceLink);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return 'URL bukti harus menggunakan HTTP atau HTTPS.';
      evidenceLink = parsed.href;
    } catch {
      return 'URL bukti tidak valid.';
    }
  }

  if (!text(data.title, 5, 100)) return 'Judul harus berisi 5 sampai 100 karakter.';
  if (!CATEGORIES.includes(data.category)) return 'Kategori tidak valid.';
  if (!PRIORITIES.includes(data.priority)) return 'Prioritas tidak valid.';
  if (!EDITIONS.includes(data.edition)) return 'Edisi game tidak valid.';
  if (!text(data.version, 1, 32)) return 'Versi game wajib diisi.';
  if (!PLATFORMS.includes(data.platform)) return 'Platform tidak valid.';
  if (!REALMS.includes(data.realm)) return 'Realm tidak valid.';
  if (!text(data.description, 1, 5000)) return 'Deskripsi wajib diisi (maks. 5000 karakter).';
  if (!text(data.steps, 1, 5000)) return 'Langkah reproduksi wajib diisi (maks. 5000 karakter).';
  if (!text(data.expected, 1, 3000) || !text(data.actual, 1, 3000)) return 'Hasil yang diharapkan dan aktual wajib diisi (maks. 3000 karakter).';
  if (!FREQUENCIES.includes(data.frequency)) return 'Frekuensi tidak valid.';

  return {
    title: data.title.trim(),
    category: data.category,
    priority: data.priority,
    edition: data.edition,
    version: data.version.trim(),
    platform: data.platform,
    realm: data.realm,
    when: typeof data.when === 'string' ? data.when.slice(0, 40) : '',
    coords: typeof data.coords === 'string' ? data.coords.trim().slice(0, 120) : '',
    description: data.description.trim(),
    steps: data.steps.trim(),
    expected: data.expected.trim(),
    actual: data.actual.trim(),
    frequency: data.frequency,
    evidenceLink,
  };
}

export function sendServerError(res, error) {
  console.error('API request failed.');
  if (!res.headersSent) res.status(500).json({ error: 'Server tidak dapat memproses permintaan.' });
}
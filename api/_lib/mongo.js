import { MongoClient } from 'mongodb';

/* Koneksi di-cache pada globalThis agar singleton lintas cold start pada instance yang sama. */
const state = globalThis;

/** Klien MongoDB singleton (promise koneksi). Lempar error bila MONGODB_URI belum diset. */
export function getMongoClient() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  if (!state.mongoClientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    state.mongoClientPromise = client.connect();
  }
  return state.mongoClientPromise;
}

/** Referensi database (nama dari MONGODB_DB, default `alwination_tracker`). */
export async function getDatabase() {
  const client = await getMongoClient();
  void ensureIndexes().catch(() => {});
  return client.db(process.env.MONGODB_DB || 'alwination_tracker');
}

/** Buat index penting sekaligus. Aman dipanggil berulang (idempotent; tidak melayani request). */
export async function ensureIndexes() {
  if (state.indexesCreated) return;
  const client = await getMongoClient();
  const database = client.db(process.env.MONGODB_DB || 'alwination_tracker');
  await Promise.all([
    database.collection('reports').createIndex({ createdAt: -1 }),
    database.collection('reports').createIndex({ authorEmail: 1, createdAt: -1 }),
    database.collection('comments').createIndex({ reportId: 1, createdAt: 1 }),
    database.collection('follows').createIndex({ email: 1, reportId: 1 }, { unique: true }),
    database.collection('follows').createIndex({ reportId: 1 }),
    database.collection('access').createIndex({ email: 1 }, { unique: true }),
    database.collection('notifications').createIndex({ read: 1, createdAt: -1 }),
  ]);
  state.indexesCreated = true;
}
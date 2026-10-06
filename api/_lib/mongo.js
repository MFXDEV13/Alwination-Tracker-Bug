import { MongoClient } from 'mongodb';

const state = globalThis;

export function getMongoClient() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not configured.');
  if (!state.mongoClientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    state.mongoClientPromise = client.connect();
  }
  return state.mongoClientPromise;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || 'alwination_tracker');
}
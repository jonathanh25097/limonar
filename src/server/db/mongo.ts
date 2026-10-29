import { MongoClient, type ClientSession, type Db } from "mongodb";
import { env } from "../env";
import { ensureIndexes } from "./collections";

/**
 * One MongoClient per process. In dev, Next reloads modules on every change,
 * so the client is kept on globalThis to avoid opening a new pool each time.
 */
const g = globalThis as unknown as { __mongo?: { client: MongoClient; db: Promise<Db> } };

export const getDb = (): Promise<Db> => {
  if (!g.__mongo) {
    const { mongoUri, mongoDb } = env();
    const client = new MongoClient(mongoUri, { appName: "limonar" });
    const db = client.connect().then(async (c) => {
      const db = c.db(mongoDb);
      await ensureIndexes(db);
      return db;
    });
    // A failed connect shouldn't be cached forever.
    db.catch(() => (g.__mongo = undefined));
    g.__mongo = { client, db };
  }
  return g.__mongo.db;
};

export const getClient = async (): Promise<MongoClient> => {
  await getDb();
  return g.__mongo!.client;
};

/** For tests: point the app at an already-connected database. */
export const useDbForTests = (client: MongoClient, db: Db) => {
  g.__mongo = { client, db: Promise.resolve(db) };
};

/**
 * Runs `fn` in a transaction so a state change and its audit entry land
 * together or not at all. Needs a replica set (Atlas always is one).
 */
export const withTransaction = async <T>(fn: (session: ClientSession, db: Db) => Promise<T>): Promise<T> => {
  const [client, db] = await Promise.all([getClient(), getDb()]);
  const session = client.startSession();
  try {
    return await session.withTransaction(() => fn(session, db));
  } finally {
    await session.endSession();
  }
};

/**
 * A throwaway MongoDB replica set for local development, for when you don't
 * want to point at Atlas. Data lives in memory and is gone when you stop it.
 *
 *   npm run db:dev        then copy the printed MONGODB_URI into .env.local
 */
import { MongoMemoryReplSet } from "mongodb-memory-server";

const rs = await MongoMemoryReplSet.create({
  instanceOpts: [{ port: Number(process.env.DEV_DB_PORT ?? 27027) }],
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
console.log(`MONGODB_URI=${rs.getUri()}`);
console.log("In-memory MongoDB running. Ctrl+C to stop (data is discarded).");

const stop = async () => {
  await rs.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

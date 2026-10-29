import type { ClientSession, Db } from "mongodb";
import type { Actor } from "@/core/shared/actor";
import { collections, newId } from "./db/collections";

/** Every create, approve, verify, reverse and close is logged with who, when and before/after. */
export const audit = (
  db: Db,
  entry: { actor: Actor; action: string; collection: string; docId: string; before: unknown; after: unknown },
  session?: ClientSession,
) =>
  collections(db).auditLog.insertOne(
    {
      _id: newId(),
      at: new Date(),
      userId: entry.actor.userId,
      userName: entry.actor.name,
      action: entry.action,
      collection: entry.collection,
      docId: entry.docId,
      before: entry.before,
      after: entry.after,
    },
    { session },
  );

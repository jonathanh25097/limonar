import { getDb } from "@/server/db/mongo";
import { ok, publicHandler } from "@/server/http/handler";

export const GET = publicHandler(async () => {
  await (await getDb()).command({ ping: 1 });
  return ok({ status: "ok" });
});

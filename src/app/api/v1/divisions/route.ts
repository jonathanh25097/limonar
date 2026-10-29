import { handler, ok } from "@/server/http/handler";
import { listDivisions } from "@/server/services/catalog";

export const GET = handler(async () => ok(listDivisions()));

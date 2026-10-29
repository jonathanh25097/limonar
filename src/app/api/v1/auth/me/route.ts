import { handler, ok } from "@/server/http/handler";
import { me } from "@/server/services/auth";

export const GET = handler(async ({ actor }) => ok(await me(actor)));

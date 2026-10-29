import { OrderActionRequest } from "@/contracts/orders";
import { handler, ok, parseBody } from "@/server/http/handler";
import { actOnOrder } from "@/server/services/orders";

/** Lifecycle moves: submit, return, approve, reject, cancel. */
export const POST = handler<{ id: string }>(async ({ req, actor, params }) =>
  ok(await actOnOrder(actor, params.id, await parseBody(req, OrderActionRequest))),
);

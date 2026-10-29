import { UpdateOrderRequest } from "@/contracts/orders";
import { handler, ok, parseBody } from "@/server/http/handler";
import { getOrder, updateOrder } from "@/server/services/orders";

type Params = { id: string };

export const GET = handler<Params>(async ({ actor, params }) => ok(await getOrder(actor, params.id)));

/** Only drafts can be changed. An approved order is cancelled and replaced instead. */
export const PATCH = handler<Params>(async ({ req, actor, params }) =>
  ok(await updateOrder(actor, params.id, await parseBody(req, UpdateOrderRequest))),
);

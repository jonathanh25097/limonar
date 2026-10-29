import { CreateOrderRequest, ListOrdersQuery } from "@/contracts/orders";
import { handler, ok, parseBody, parseQuery } from "@/server/http/handler";
import { createOrder, listOrders } from "@/server/services/orders";

export const GET = handler(async ({ req, actor }) => ok(await listOrders(actor, parseQuery(req, ListOrdersQuery))));

export const POST = handler(async ({ req, actor }) =>
  ok(await createOrder(actor, await parseBody(req, CreateOrderRequest)), { status: 201 }),
);

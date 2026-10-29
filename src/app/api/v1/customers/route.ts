import { CreateCustomerRequest, ListCustomersQuery } from "@/contracts/catalog";
import { handler, ok, parseBody, parseQuery } from "@/server/http/handler";
import { createCustomer, listCustomers } from "@/server/services/catalog";

export const GET = handler(async ({ req, actor }) =>
  ok(await listCustomers(actor, parseQuery(req, ListCustomersQuery))),
);

export const POST = handler(async ({ req, actor }) =>
  ok(await createCustomer(actor, await parseBody(req, CreateCustomerRequest)), { status: 201 }),
);

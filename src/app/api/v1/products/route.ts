import { CreateProductRequest, ListProductsQuery } from "@/contracts/catalog";
import { handler, ok, parseBody, parseQuery } from "@/server/http/handler";
import { createProduct, listProducts } from "@/server/services/catalog";

export const GET = handler(async ({ req, actor }) => ok(await listProducts(actor, parseQuery(req, ListProductsQuery))));

export const POST = handler(async ({ req, actor }) =>
  ok(await createProduct(actor, await parseBody(req, CreateProductRequest)), { status: 201 }),
);

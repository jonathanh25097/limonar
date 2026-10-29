import { SuggestedPriceQuery } from "@/contracts/orders";
import { handler, ok, parseQuery } from "@/server/http/handler";
import { suggestedPrice } from "@/server/services/orders";

export const GET = handler(async ({ req, actor }) => {
  const { customerId, productId } = parseQuery(req, SuggestedPriceQuery);
  return ok(await suggestedPrice(actor, customerId, productId));
});

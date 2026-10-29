import { z } from "zod";
import { LoginRequest, LoginResponse, SessionUser } from "./auth";
import {
  CreateCustomerRequest,
  CreateProductRequest,
  CustomerDTO,
  DivisionDTO,
  ListCustomersQuery,
  ListProductsQuery,
  ProductDTO,
} from "./catalog";
import { ApiErrorSchema } from "./common";
import {
  CreateOrderRequest,
  ListOrdersQuery,
  OrderActionRequest,
  OrderDTO,
  SuggestedPriceDTO,
  SuggestedPriceQuery,
  UpdateOrderRequest,
} from "./orders";

/**
 * Every endpoint, described from the same zod schemas the routes validate
 * with. Add a line here when you add a route.
 */
type Op = {
  summary: string;
  tag: string;
  public?: boolean;
  query?: z.ZodObject;
  body?: z.ZodType;
  response?: z.ZodType;
  status?: number;
};

const ROUTES: Record<string, Partial<Record<"get" | "post" | "patch", Op>>> = {
  "/auth/login": {
    post: {
      tag: "auth",
      summary: "Sign in with phone and PIN",
      public: true,
      body: LoginRequest,
      response: LoginResponse,
    },
  },
  "/auth/logout": { post: { tag: "auth", summary: "Clear the session cookie", public: true } },
  "/auth/me": { get: { tag: "auth", summary: "The signed-in user and their permissions", response: SessionUser } },
  "/divisions": {
    get: { tag: "catalog", summary: "Lines of business (lemons, cattle…)", response: z.array(DivisionDTO) },
  },
  "/products": {
    get: { tag: "catalog", summary: "List products", query: ListProductsQuery, response: z.array(ProductDTO) },
    post: {
      tag: "catalog",
      summary: "Create a product (owner)",
      body: CreateProductRequest,
      response: ProductDTO,
      status: 201,
    },
  },
  "/customers": {
    get: { tag: "catalog", summary: "List customers", query: ListCustomersQuery, response: z.array(CustomerDTO) },
    post: {
      tag: "catalog",
      summary: "Create a customer",
      body: CreateCustomerRequest,
      response: CustomerDTO,
      status: 201,
    },
  },
  "/orders": {
    get: {
      tag: "orders",
      summary: "List orders visible to the caller",
      query: ListOrdersQuery,
      response: z.array(OrderDTO),
    },
    post: {
      tag: "orders",
      summary: "Create an order (draft, or submit right away)",
      body: CreateOrderRequest,
      response: OrderDTO,
      status: 201,
    },
  },
  "/orders/{id}": {
    get: { tag: "orders", summary: "Get one order", response: OrderDTO },
    patch: { tag: "orders", summary: "Change a draft order", body: UpdateOrderRequest, response: OrderDTO },
  },
  "/orders/{id}/actions": {
    post: {
      tag: "orders",
      summary: "Submit, return, approve, reject or cancel",
      body: OrderActionRequest,
      response: OrderDTO,
    },
  },
  "/prices/suggested": {
    get: {
      tag: "orders",
      summary: "Last approved price for a customer and product",
      query: SuggestedPriceQuery,
      response: SuggestedPriceDTO,
    },
  },
  "/health": { get: { tag: "system", summary: "Liveness and database check", public: true } },
};

const schema = (s: z.ZodType, io: "input" | "output") =>
  z.toJSONSchema(s, { io, target: "openapi-3.0", unrepresentable: "any" });

export const openApiDocument = () => {
  const paths: Record<string, unknown> = {};
  for (const [path, ops] of Object.entries(ROUTES)) {
    const item: Record<string, unknown> = {};
    for (const [method, op] of Object.entries(ops)) {
      const parameters = [
        ...(path.includes("{id}") ? [{ name: "id", in: "path", required: true, schema: { type: "string" } }] : []),
        ...Object.entries(op.query?.shape ?? {}).map(([name, s]) => ({
          name,
          in: "query",
          required: !(s as z.ZodType).safeParse(undefined).success,
          schema: schema(s as z.ZodType, "input"),
        })),
      ];
      item[method] = {
        tags: [op.tag],
        summary: op.summary,
        ...(op.public ? { security: [] } : {}),
        ...(parameters.length ? { parameters } : {}),
        ...(op.body
          ? { requestBody: { required: true, content: { "application/json": { schema: schema(op.body, "input") } } } }
          : {}),
        responses: {
          [op.status ?? 200]: {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "object", properties: { data: op.response ? schema(op.response, "output") : {} } },
              },
            },
          },
          default: {
            description: "Error",
            content: { "application/json": { schema: schema(ApiErrorSchema, "output") } },
          },
        },
      };
    }
    paths[path] = item;
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "Limonar API",
      version: "1",
      description:
        "Every screen in the web app uses this API, so any other client can do the same. Money is integer minor units plus a currency.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer" },
        cookie: { type: "apiKey", in: "cookie", name: "limonar_session" },
      },
    },
    security: [{ bearer: [] }, { cookie: [] }],
    paths,
  };
};

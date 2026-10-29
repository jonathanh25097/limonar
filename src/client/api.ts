import type { ApiError as ApiErrorBody } from "@/contracts/common";
import type { LoginRequest, LoginResponse, SessionUser } from "@/contracts/auth";
import type { CustomerDTO, ProductDTO } from "@/contracts/catalog";
import type {
  CreateOrderRequest,
  OrderActionRequest,
  OrderDTO,
  SuggestedPriceDTO,
  UpdateOrderRequest,
} from "@/contracts/orders";
import type { DivisionDefinition, DivisionId } from "@/core/divisions";
import type { OrderStatus } from "@/core/sales/order";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined>;

/**
 * Typed client for /api/v1. The web UI uses it with the session cookie; any
 * other JavaScript client (a phone app, a script) passes `baseUrl` and a
 * bearer `token` and gets the same calls.
 */
export const createApiClient = (opts: { baseUrl?: string; token?: string } = {}) => {
  const base = `${opts.baseUrl ?? ""}/api/v1`;

  const request = async <T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> => {
    const qs = query
      ? new URLSearchParams(
          Object.entries(query)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]),
        ).toString()
      : "";
    const res = await fetch(`${base}${path}${qs ? `?${qs}` : ""}`, {
      method,
      credentials: "same-origin",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as { data?: T; error?: ApiErrorBody } | null;
    if (!res.ok || !json || json.error) {
      const e = json?.error;
      throw new ApiError(res.status, e?.code ?? "internal", e?.message ?? res.statusText, e?.details);
    }
    return json.data as T;
  };

  return {
    auth: {
      login: (body: LoginRequest) => request<LoginResponse>("POST", "/auth/login", body),
      logout: () => request<null>("POST", "/auth/logout"),
      me: () => request<SessionUser>("GET", "/auth/me"),
    },
    divisions: {
      list: () => request<Omit<DivisionDefinition, "costCenter">[]>("GET", "/divisions"),
    },
    products: {
      list: (q: { division?: DivisionId; includeInactive?: boolean } = {}) =>
        request<ProductDTO[]>("GET", "/products", undefined, q),
    },
    customers: {
      list: (q: { division?: DivisionId; q?: string } = {}) =>
        request<CustomerDTO[]>("GET", "/customers", undefined, q),
    },
    orders: {
      list: (q: { division?: DivisionId; status?: OrderStatus[]; customerId?: string; limit?: number } = {}) =>
        request<OrderDTO[]>("GET", "/orders", undefined, { ...q, status: q.status?.join(",") }),
      get: (id: string) => request<OrderDTO>("GET", `/orders/${encodeURIComponent(id)}`),
      create: (body: CreateOrderRequest) => request<OrderDTO>("POST", "/orders", body),
      update: (id: string, body: UpdateOrderRequest) =>
        request<OrderDTO>("PATCH", `/orders/${encodeURIComponent(id)}`, body),
      act: (id: string, body: OrderActionRequest) =>
        request<OrderDTO>("POST", `/orders/${encodeURIComponent(id)}/actions`, body),
    },
    prices: {
      suggested: (q: { customerId: string; productId: string }) =>
        request<SuggestedPriceDTO>("GET", "/prices/suggested", undefined, q),
    },
  };
};

export type ApiClient = ReturnType<typeof createApiClient>;

/** The web app's client: same origin, session cookie. */
export const api = createApiClient();

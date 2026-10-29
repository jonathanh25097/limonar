"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/client/api";
import { ORDER_STATUS_LABEL } from "@/client/format";
import type { OrderStatus } from "@/core/sales/order";
import { useSession } from "@/components/providers";
import { ButtonLink, Empty, ErrorNote, PageHeader } from "@/components/ui";
import { OrderCard } from "./order-card";

const FILTERS: { label: string; status?: OrderStatus[] }[] = [
  { label: "Abiertos", status: ["draft", "pending_approval", "approved"] },
  { label: ORDER_STATUS_LABEL.pending_approval, status: ["pending_approval"] },
  { label: "Aprobados", status: ["approved"] },
  { label: "Todos" },
];

export function OrderList() {
  const { can } = useSession();
  const [filter, setFilter] = useState(0);
  const status = FILTERS[filter].status;
  const orders = useQuery({ queryKey: ["orders", { status }], queryFn: () => api.orders.list({ status }) });

  return (
    <>
      <PageHeader title="Pedidos" />
      <main className="flex flex-col gap-3 p-4">
        <div role="group" aria-label="Filtrar" className="flex flex-wrap gap-2">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              aria-pressed={i === filter}
              onClick={() => setFilter(i)}
              className={`h-10 rounded-full px-4 text-sm ${
                i === filter ? "bg-brand font-semibold text-white" : "border border-line-2 bg-surface text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <ErrorNote error={orders.error} />
        {orders.data?.map((o) => (
          <OrderCard key={o.id} order={o} />
        ))}
        {orders.isSuccess && orders.data.length === 0 && <Empty>No hay pedidos aquí.</Empty>}
        {can("orders.create") && <ButtonLink href="/pedidos/nuevo">Nuevo pedido</ButtonLink>}
      </main>
    </>
  );
}

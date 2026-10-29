"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatQty,
  fromMajor,
  ORDER_SOURCE_LABEL,
  ORDER_STATUS_LABEL,
} from "@/client/format";
import type { OrderActionRequest, OrderDTO } from "@/contracts/orders";
import { ORDER_SOURCES, type OrderSource, type OrderStatus } from "@/core/sales/order";
import { Button, Card, ErrorNote, Field, inputClass, PageHeader, SectionTitle } from "@/components/ui";
import { OrderStatusBadge } from "./order-card";

type ReasonAction = "return" | "reject" | "cancel";
const REASON_LABEL: Record<ReasonAction, { title: string; confirm: string }> = {
  return: { title: "¿Qué hay que cambiar?", confirm: "Devolver para cambiar" },
  reject: { title: "¿Por qué se rechaza?", confirm: "Rechazar pedido" },
  cancel: { title: "¿Por qué se cancela?", confirm: "Cancelar pedido" },
};

export function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const order = useQuery({ queryKey: ["order", id], queryFn: () => api.orders.get(id) });

  const act = useMutation({
    mutationFn: (body: OrderActionRequest) => api.orders.act(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["order", id], updated);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  if (!order.data) {
    return (
      <>
        <PageHeader title="Pedido" back="/pedidos" />
        <main className="p-4">
          <ErrorNote error={order.error} />
        </main>
      </>
    );
  }
  const o = order.data;
  return (
    <>
      <PageHeader title={`Pedido ${o.number}`} back="/pedidos" />
      <main className="flex flex-col gap-3 p-4">
        <Summary order={o} />
        <ErrorNote error={act.error} />
        <Actions key={o.version} order={o} pending={act.isPending} onAct={(body) => act.mutate(body)} />
        <History order={o} />
      </main>
    </>
  );
}

function Summary({ order: o }: { order: OrderDTO }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[17px] font-bold">{o.customerName}</span>
          <span className="text-[13px] text-muted">
            Lo pidió {o.createdByName} · {formatDateTime(o.createdAt)}
          </span>
          {o.approvedByName && (
            <span className="text-[13px] text-muted">
              Aprobó {o.approvedByName} · {formatDateTime(o.approvedAt!)}
            </span>
          )}
        </div>
        <OrderStatusBadge status={o.status} />
      </div>
      <div className="flex flex-col gap-1.5 border-t border-track pt-2.5">
        {o.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-2 text-[15px]">
            <span>
              {formatQty(l.quantity)} {l.productName.toLowerCase()}
              {l.unitPrice && ` × ${formatMoney(l.unitPrice)}`}
            </span>
            <strong className="whitespace-nowrap">{l.total ? formatMoney(l.total) : "Sin precio"}</strong>
          </div>
        ))}
        {o.total && o.lines.length > 1 && (
          <div className="flex justify-between border-t border-track pt-1.5 text-[15px]">
            <span>Total</span>
            <strong>{formatMoney(o.total)}</strong>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1 text-sm text-ink-2">
        <span>
          Entregar {formatDateTime(o.neededBy)} · {o.deliveryPoint}
        </span>
        {o.source && <span>Origen: {ORDER_SOURCE_LABEL[o.source]}</span>}
        {o.note && <span>Nota: {o.note}</span>}
        {o.rejectReason && <span className="text-wine">Rechazado: {o.rejectReason}</span>}
        {o.cancelReason && <span className="text-wine">Cancelado: {o.cancelReason}</span>}
      </div>
    </Card>
  );
}

function Actions({
  order: o,
  pending,
  onAct,
}: {
  order: OrderDTO;
  pending: boolean;
  onAct: (b: OrderActionRequest) => void;
}) {
  const allowed = new Set(o.allowedActions);
  const [source, setSource] = useState<OrderSource>("farm_cut");
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [reasonFor, setReasonFor] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const v = o.version;

  if (reasonFor) {
    return (
      <Card className="flex flex-col gap-3">
        <Field label={REASON_LABEL[reasonFor].title} htmlFor="reason">
          <textarea
            id="reason"
            className={`${inputClass} h-24 py-2`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setReasonFor(null)}>
            Volver
          </Button>
          <Button
            variant={reasonFor === "return" ? "primary" : "danger"}
            disabled={pending || !reason.trim()}
            onClick={() => onAct({ action: reasonFor, expectedVersion: v, note: reason })}
          >
            {REASON_LABEL[reasonFor].confirm}
          </Button>
        </div>
      </Card>
    );
  }

  const unpriced = o.lines.map((l, i) => (l.unitPrice ? null : i)).filter((i): i is number => i !== null);

  return (
    <>
      {allowed.has("approve") && (
        <>
          {unpriced.length > 0 && (
            <Card className="flex flex-col gap-3">
              <SectionTitle>Precios que faltan</SectionTitle>
              {unpriced.map((i) => (
                <Field
                  key={i}
                  label={`${formatQty(o.lines[i].quantity)} ${o.lines[i].productName.toLowerCase()} · C$ por unidad`}
                  htmlFor={`price${i}`}
                >
                  <input
                    id={`price${i}`}
                    className={inputClass}
                    inputMode="decimal"
                    value={prices[i] ?? ""}
                    onChange={(e) => setPrices((p) => ({ ...p, [i]: e.target.value }))}
                  />
                </Field>
              ))}
            </Card>
          )}
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 px-1 text-sm font-semibold text-muted">¿De dónde sale el limón?</legend>
            {ORDER_SOURCES.map((s) => (
              <label
                key={s}
                className={`flex items-center gap-3 rounded-[14px] bg-surface px-3.5 py-3 ${source === s ? "border-2 border-brand" : "border border-line"}`}
              >
                <input
                  type="radio"
                  name="source"
                  checked={source === s}
                  onChange={() => setSource(s)}
                  className="h-5 w-5 accent-brand"
                />
                <span className="text-[15px] font-semibold">{ORDER_SOURCE_LABEL[s]}</span>
              </label>
            ))}
          </fieldset>
          <p className="m-0 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn-ink">
            <strong>Al aprobar, el precio queda fijo y no se puede cambiar.</strong> Si el cliente paga menos, la
            diferencia queda como saldo pendiente.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="danger" onClick={() => setReasonFor("reject")}>
              Rechazar
            </Button>
            <Button variant="secondary" onClick={() => setReasonFor("return")}>
              Cambiar
            </Button>
            <Button
              disabled={pending || unpriced.some((i) => !prices[i]?.trim())}
              onClick={() =>
                onAct({
                  action: "approve",
                  expectedVersion: v,
                  source,
                  prices: unpriced.length
                    ? Object.fromEntries(unpriced.map((i) => [String(i), fromMajor(Number(prices[i]), o.currency)]))
                    : undefined,
                })
              }
            >
              Aprobar
            </Button>
          </div>
        </>
      )}

      {allowed.has("submit") && (
        <Button disabled={pending} onClick={() => onAct({ action: "submit", expectedVersion: v })}>
          Enviar a aprobación
        </Button>
      )}
      {o.status === "pending_approval" && !allowed.has("approve") && (
        <p className="m-0 px-1 text-sm text-muted">Esperando que María Isabel o Adrián lo aprueben.</p>
      )}
      {allowed.has("cancel") && (
        <Button variant="danger" onClick={() => setReasonFor("cancel")}>
          Cancelar pedido
        </Button>
      )}
    </>
  );
}

function History({ order }: { order: OrderDTO }) {
  return (
    <section className="flex flex-col gap-1.5 px-1 pt-2">
      <h2 className="m-0 text-[13px] font-semibold text-muted">Historial</h2>
      {[...order.statusHistory].reverse().map((h, i) => (
        <span key={i} className="text-[13px] text-ink-2">
          <strong>{formatDate(h.at)}</strong> · {h.byName}:{" "}
          {h.from ? `${ORDER_STATUS_LABEL[h.from as OrderStatus]} → ` : ""}
          {ORDER_STATUS_LABEL[h.to as OrderStatus]}
          {h.note ? ` — ${h.note}` : ""}
        </span>
      ))}
    </section>
  );
}

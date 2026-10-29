"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import { formatDate, formatMoney, formatQty, fromMajor } from "@/client/format";
import type { ProductDTO } from "@/contracts/catalog";
import { sum, type Money } from "@/core/shared/money";
import { lineTotal } from "@/core/sales/order";
import { Button, Card, ErrorNote, Field, inputClass, PageHeader, SectionTitle } from "@/components/ui";

type Line = { productId: string; quantity: string; price: string };
const emptyLine = (): Line => ({ productId: "", quantity: "", price: "" });

const DIVISION = "lemons" as const;

/** Tomorrow at 8:00, in the format a datetime-local input wants. */
const defaultNeededBy = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const toPrice = (s: string): Money | null => (s.trim() === "" ? null : fromMajor(Number(s), "NIO"));

export function NewOrder() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const customers = useQuery({
    queryKey: ["customers", DIVISION],
    queryFn: () => api.customers.list({ division: DIVISION }),
  });
  const products = useQuery({
    queryKey: ["products", DIVISION],
    queryFn: () => api.products.list({ division: DIVISION }),
  });

  const [customerId, setCustomerId] = useState("");
  const [neededBy, setNeededBy] = useState(defaultNeededBy);
  const [deliveryPoint, setDeliveryPoint] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);

  const setLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const priced = lines.map((l) => lineTotal({ quantity: Number(l.quantity) || 0, unitPrice: toPrice(l.price) }));
  const total = priced.every((t) => t) ? sum(priced as Money[], "NIO") : null;

  const create = useMutation({
    mutationFn: (submit: boolean) =>
      api.orders.create({
        divisionId: DIVISION,
        customerId,
        currency: "NIO",
        neededBy: new Date(neededBy).toISOString(),
        deliveryPoint,
        note: note.trim() || undefined,
        lines: lines.map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: toPrice(l.price),
        })),
        submit,
      }),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.replace(`/pedidos/${order.id}`);
    },
  });

  return (
    <>
      <PageHeader title="Nuevo pedido" back="/pedidos" />
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(true);
        }}
      >
        <Field label="Cliente" htmlFor="customer">
          <select
            id="customer"
            className={inputClass}
            value={customerId}
            required
            onChange={(e) => {
              setCustomerId(e.target.value);
              const c = customers.data?.find((c) => c.id === e.target.value);
              if (c?.defaultDeliveryPoint && !deliveryPoint) setDeliveryPoint(c.defaultDeliveryPoint);
            }}
          >
            <option value="">Elegí un cliente…</option>
            {customers.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Para cuándo" htmlFor="neededBy">
            <input
              id="neededBy"
              type="datetime-local"
              className={inputClass}
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              required
            />
          </Field>
          <Field label="Se entrega en" htmlFor="deliveryPoint">
            <input
              id="deliveryPoint"
              className={inputClass}
              value={deliveryPoint}
              onChange={(e) => setDeliveryPoint(e.target.value)}
              required
            />
          </Field>
        </div>

        <Card className="flex flex-col gap-4">
          <SectionTitle>Productos</SectionTitle>
          {lines.map((line, i) => (
            <LineEditor
              key={i}
              index={i}
              line={line}
              products={products.data ?? []}
              customerId={customerId}
              onChange={(patch) => setLine(i, patch)}
              onRemove={lines.length > 1 ? () => setLines((ls) => ls.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          <Button variant="secondary" onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            + Agregar producto
          </Button>
        </Card>

        <Field label="Nota (opcional)" htmlFor="note">
          <input id="note" className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-muted">Total del pedido</span>
          <strong className="text-xl">{total ? formatMoney(total) : "Sin precio"}</strong>
        </div>

        <ErrorNote error={create.error} />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={create.isPending || !customerId} onClick={() => create.mutate(false)}>
            Guardar borrador
          </Button>
          <Button type="submit" disabled={create.isPending}>
            Enviar a aprobación
          </Button>
        </div>
      </form>
    </>
  );
}

function LineEditor({
  index,
  line,
  products,
  customerId,
  onChange,
  onRemove,
}: {
  index: number;
  line: Line;
  products: ProductDTO[];
  customerId: string;
  onChange: (patch: Partial<Line>) => void;
  onRemove?: () => void;
}) {
  const suggestion = useQuery({
    queryKey: ["suggested-price", customerId, line.productId],
    queryFn: () => api.prices.suggested({ customerId, productId: line.productId }),
    enabled: !!customerId && !!line.productId,
  });
  const s = suggestion.data;
  const total = lineTotal({ quantity: Number(line.quantity) || 0, unitPrice: toPrice(line.price) });

  return (
    <div className="flex flex-col gap-2 border-b border-track pb-4 last:border-0 last:pb-0">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field label={`Producto ${index + 1}`} htmlFor={`p${index}`}>
            <select
              id={`p${index}`}
              className={inputClass}
              value={line.productId}
              required
              onChange={(e) => onChange({ productId: e.target.value })}
            >
              <option value="">Elegí…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar producto ${index + 1}`}
            className="h-12 w-12 rounded-xl border border-line-2 text-danger"
          >
            ×
          </button>
        )}
      </div>
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <Field label="Cantidad" htmlFor={`q${index}`}>
          <input
            id={`q${index}`}
            className={inputClass}
            inputMode="numeric"
            value={line.quantity}
            required
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </Field>
        <Field label="Precio C$" htmlFor={`pr${index}`}>
          <input
            id={`pr${index}`}
            className={inputClass}
            inputMode="decimal"
            placeholder="Sin precio"
            value={line.price}
            onChange={(e) => onChange({ price: e.target.value })}
          />
        </Field>
        <div className="flex min-w-20 flex-col items-end gap-1 pb-3">
          <span className="text-xs text-muted">Subtotal</span>
          <strong className="text-sm">{total ? formatMoney(total) : "—"}</strong>
        </div>
      </div>
      {s?.unitPrice && (
        <button
          type="button"
          className="self-start text-left text-xs text-brand underline"
          onClick={() => onChange({ price: String(s.unitPrice!.amount / 100) })}
        >
          Último precio a este cliente: {formatMoney(s.unitPrice)} ({formatDate(s.orderDate!)}, {formatQty(s.quantity!)}{" "}
          unid.)
        </button>
      )}
    </div>
  );
}

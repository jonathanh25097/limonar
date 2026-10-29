import Link from "next/link";
import type { OrderDTO } from "@/contracts/orders";
import { formatDate, formatMoney, formatQty, ORDER_STATUS_LABEL } from "@/client/format";
import { Badge } from "@/components/ui";

const STATUS_TONE = {
  draft: "neutral",
  pending_approval: "warn",
  approved: "ok",
  fulfilled: "ok",
  rejected: "danger",
  cancelled: "neutral",
} as const;

export function OrderStatusBadge({ status }: { status: OrderDTO["status"] }) {
  return <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Badge>;
}

/** One row in a list: customer, what and when on the left, total (or "Sin precio") on the right. */
export function OrderCard({ order, showStatus = true }: { order: OrderDTO; showStatus?: boolean }) {
  const summary = order.lines.map((l) => `${formatQty(l.quantity)} ${l.productName.toLowerCase()}`).join(" · ");
  return (
    <Link
      href={`/pedidos/${order.id}`}
      className="flex items-center justify-between gap-3 rounded-[14px] border border-line bg-surface px-4 py-3.5 text-ink no-underline hover:border-line-2"
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[15px] font-semibold">{order.customerName}</span>
        <span className="truncate text-[13px] text-muted">
          {summary} · {formatDate(order.neededBy)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        {order.total ? (
          <strong className="whitespace-nowrap text-[15px]">{formatMoney(order.total)}</strong>
        ) : (
          <Badge tone="warn">Sin precio</Badge>
        )}
        {showStatus && <OrderStatusBadge status={order.status} />}
      </span>
    </Link>
  );
}

import type { OrderSource, OrderStatus } from "@/core/sales/order";

export { formatMoney, fromMajor } from "@/core/shared/money";

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Borrador",
  pending_approval: "Por aprobar",
  approved: "Aprobado",
  fulfilled: "Entregado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  farm_cut: "Cortar en la finca",
  consignment_stock: "Tomar de la casa de Chayito",
};

const dateFmt = new Intl.DateTimeFormat("es-NI", { weekday: "short", day: "numeric", month: "short" });
const dateTimeFmt = new Intl.DateTimeFormat("es-NI", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso));
export const formatQty = (n: number) => n.toLocaleString("en-US");

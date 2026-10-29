import { Suspense } from "react";
import { OrderDetail } from "@/features/orders/order-detail";

export default function OrderPage() {
  return (
    <Suspense>
      <OrderDetail />
    </Suspense>
  );
}

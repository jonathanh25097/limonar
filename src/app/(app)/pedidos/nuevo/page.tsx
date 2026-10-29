import { Suspense } from "react";
import { NewOrder } from "@/features/orders/new-order";

export default function NewOrderPage() {
  return (
    <Suspense>
      <NewOrder />
    </Suspense>
  );
}

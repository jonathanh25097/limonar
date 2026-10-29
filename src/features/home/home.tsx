"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/client/api";
import { useSession } from "@/components/providers";
import { ButtonLink, Empty, ErrorNote } from "@/components/ui";
import { OrderCard } from "../orders/order-card";

const today = new Intl.DateTimeFormat("es-NI", { weekday: "long", day: "numeric", month: "long" });

export function Home() {
  const { user, can } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const approver = can("orders.approve");

  const pending = useQuery({
    queryKey: ["orders", { status: ["pending_approval"] }],
    queryFn: () => api.orders.list({ status: ["pending_approval"] }),
    enabled: !!user,
  });
  const toApprove = pending.data?.filter((o) => o.allowedActions.includes("approve")) ?? [];
  const waiting = pending.data?.filter((o) => !o.allowedActions.includes("approve")) ?? [];

  const logout = async () => {
    await api.auth.logout();
    queryClient.clear();
    router.replace("/login");
  };

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-start justify-between px-5 pb-3 pt-5">
        <div className="flex flex-col gap-0.5">
          <Suspense fallback={<span className="h-[18px]" />}>
            <Today />
          </Suspense>
          <h1 className="m-0 text-[22px] font-bold">{user ? `Hola, ${user.name.split(" ")[0]}` : " "}</h1>
        </div>
        <button
          type="button"
          onClick={logout}
          className="h-11 rounded-full border border-line bg-surface px-4 text-sm text-muted"
        >
          Salir
        </button>
      </header>

      <main className="flex flex-col gap-3 px-4">
        <ErrorNote error={pending.error} />

        {approver && (
          <section className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between px-1">
              <h2 className="m-0 text-base font-bold">Por aprobar</h2>
              <span className="text-[13px] text-muted">{toApprove.length} pedidos</span>
            </div>
            {toApprove.map((o) => (
              <OrderCard key={o.id} order={o} showStatus={false} />
            ))}
            {pending.isSuccess && toApprove.length === 0 && <Empty>No hay pedidos esperando tu aprobación.</Empty>}
          </section>
        )}

        {waiting.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="m-0 px-1 text-base font-bold">Esperando aprobación</h2>
            {waiting.map((o) => (
              <OrderCard key={o.id} order={o} showStatus={false} />
            ))}
          </section>
        )}

        {can("orders.create") && <ButtonLink href="/pedidos/nuevo">Nuevo pedido</ButtonLink>}
      </main>
    </div>
  );
}

/** Today's date is read at request time, so it lives in its own Suspense boundary. */
function Today() {
  return <span className="text-[13px] text-muted first-letter:uppercase">{today.format(new Date())}</span>;
}

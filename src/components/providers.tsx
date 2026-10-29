"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, ApiError } from "@/client/api";
import type { Permission } from "@/core/auth/roles";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The signed-in user. Sends the browser to /login when the session is gone. */
export function useSession() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["me"], queryFn: api.auth.me });
  const unauthenticated = query.error instanceof ApiError && query.error.status === 401;
  useEffect(() => {
    if (unauthenticated) router.replace("/login");
  }, [unauthenticated, router]);
  const user = query.data;
  return {
    user,
    isLoading: query.isLoading,
    can: (p: Permission) => !!user?.permissions.includes(p),
  };
}

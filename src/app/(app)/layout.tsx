import { AppShell } from "@/components/app-shell";
import { Providers } from "@/components/providers";

/**
 * Every screen under here is a client component that reads and writes through
 * /api/v1 — no direct database access from the UI — so other clients can do
 * anything this app does.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}

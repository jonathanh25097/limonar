"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

const icon = (d: ReactNode) => (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

/** Bottom navigation from the mockups. Entregas and Cobros arrive with the next slices. */
const NAV = [
  { href: "/", label: "Inicio", icon: icon(<path d="M3 10.5 12 3l9 7.5V21H3z" />) },
  {
    href: "/pedidos",
    label: "Pedidos",
    icon: icon(
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>,
    ),
  },
  {
    href: null,
    label: "Entregas",
    icon: icon(
      <>
        <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7" />
        <circle cx="7" cy="18" r="1.8" />
        <circle cx="17" cy="18" r="1.8" />
      </>,
    ),
  },
  {
    href: null,
    label: "Cobros",
    icon: icon(
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>,
    ),
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <div className="flex-1 pb-24">{children}</div>
      {/* The current path is only known per request, so the highlighted tab streams in. */}
      <Suspense fallback={<BottomNav pathname={null} />}>
        <CurrentBottomNav />
      </Suspense>
    </div>
  );
}

function CurrentBottomNav() {
  return <BottomNav pathname={usePathname()} />;
}

function BottomNav({ pathname }: { pathname: string | null }) {
  const active = (href: string) => (href === "/" ? pathname === "/" : !!pathname?.startsWith(href));
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto grid h-[72px] max-w-xl grid-cols-4 border-t border-line bg-surface"
    >
      {NAV.map((item) =>
        item.href ? (
          <Link
            key={item.label}
            href={item.href}
            aria-current={active(item.href) ? "page" : undefined}
            className={`flex flex-col items-center justify-center gap-1 text-xs no-underline ${
              active(item.href) ? "font-semibold text-brand" : "text-muted"
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ) : (
          <span
            key={item.label}
            aria-disabled="true"
            className="flex flex-col items-center justify-center gap-1 text-xs text-line-2"
          >
            {item.icon}
            {item.label}
          </span>
        ),
      )}
    </nav>
  );
}

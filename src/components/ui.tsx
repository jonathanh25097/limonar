import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx("rounded-2xl border border-line bg-surface p-4", className)}>{children}</section>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="m-0 text-sm font-semibold text-muted">{children}</h2>;
}

type Tone = "warn" | "ok" | "neutral" | "danger";
const TONE: Record<Tone, string> = {
  warn: "bg-warn-soft text-warn",
  ok: "bg-brand-soft text-brand-dark",
  neutral: "bg-track text-muted",
  danger: "bg-wine-soft text-wine",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("whitespace-nowrap rounded-[10px] px-2 py-[3px] text-xs font-semibold", TONE[tone])}>
      {children}
    </span>
  );
}

type Variant = "primary" | "secondary" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark disabled:opacity-50",
  secondary: "border border-line-2 bg-surface text-ink hover:bg-ground disabled:opacity-50",
  danger: "border border-line-2 bg-surface text-danger hover:bg-wine-soft disabled:opacity-50",
};
const buttonBase = "flex h-[52px] items-center justify-center rounded-[14px] px-4 text-[15px] font-semibold";

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={cx(buttonBase, VARIANT[variant], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(buttonBase, VARIANT[variant], "no-underline", className)} {...props} />;
}

export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-xs font-semibold text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  "h-12 w-full min-w-0 rounded-xl border border-line-2 bg-surface px-3 text-base text-ink focus:border-brand focus:outline-none";

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : "Algo salió mal";
  return (
    <p role="alert" className="m-0 rounded-xl bg-wine-soft px-3 py-2 text-sm text-wine">
      {message}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 rounded-2xl border border-dashed border-line-2 p-6 text-center text-sm text-muted">{children}</p>
  );
}

export function PageHeader({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-1 border-b border-line bg-surface px-2 py-2">
      {back && (
        <Link href={back} aria-label="Volver" className="flex h-11 w-11 items-center justify-center text-ink">
          <svg
            aria-hidden="true"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </Link>
      )}
      <div className={cx("flex flex-col", !back && "px-2")}>
        <h1 className="m-0 text-lg font-bold">{title}</h1>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
    </header>
  );
}

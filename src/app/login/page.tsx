import { Suspense } from "react";
import { Providers } from "@/components/providers";
import { LoginForm } from "@/features/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <div className="flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-bold">Limonar</h1>
        <p className="m-0 text-sm text-muted">Entrá con tu teléfono y PIN</p>
      </div>
      <Providers>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Providers>
    </main>
  );
}

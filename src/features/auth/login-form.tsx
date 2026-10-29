"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/client/api";
import { Button, ErrorNote, Field, inputClass } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const login = useMutation({
    mutationFn: () => api.auth.login({ phone, pin }),
    // Only same-site paths, so ?next= can't send someone elsewhere.
    onSuccess: () => router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/"),
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        login.mutate();
      }}
    >
      <Field label="Teléfono" htmlFor="phone">
        <input
          id="phone"
          className={inputClass}
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
        />
      </Field>
      <Field label="PIN" htmlFor="pin">
        <input
          id="pin"
          className={inputClass}
          inputMode="numeric"
          type="password"
          autoComplete="current-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      </Field>
      <ErrorNote error={login.error} />
      <Button type="submit" disabled={login.isPending}>
        {login.isPending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}

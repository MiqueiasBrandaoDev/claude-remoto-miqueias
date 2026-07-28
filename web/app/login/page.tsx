"use client";

import { signIn } from "next-auth/react";
import { Robot } from "@/components/ui/robot";

export default function Login() {
  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="text-center max-w-xs w-full">
        <Robot className="w-16 h-16 mx-auto mb-5 drop-shadow-[0_0_18px_rgba(242,193,78,0.35)]" />
        <h1 className="text-xl font-semibold mb-1">Claude</h1>
        <p className="text-sm text-muted-foreground mb-8">Assistente do seu workspace</p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="w-full flex items-center justify-center gap-3 bg-panel border border-border rounded-xl px-4 py-3 text-sm font-medium hover:border-primary/60 hover:bg-panel-2 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
          </svg>
          Entrar com Google
        </button>

        <p className="text-[11px] text-muted-foreground mt-6">Acesso restrito. Apenas contas autorizadas.</p>
      </div>
    </div>
  );
}

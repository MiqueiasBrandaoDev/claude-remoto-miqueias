"use client";

import React from "react";
import { Robot } from "@/components/ui/robot";

export default function Login() {
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (r.ok) {
        window.location.href = "/";
        return;
      }
      setError("Senha incorreta.");
    } catch {
      setError("Não consegui entrar. Tenta de novo.");
    }
    setLoading(false);
  };

  return (
    <div
      className="h-full flex items-center justify-center px-6"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <form onSubmit={submit} className="text-center max-w-xs w-full">
        <Robot className="w-16 h-16 mx-auto mb-5 drop-shadow-[0_0_18px_rgba(242,193,78,0.35)]" />
        <h1 className="text-xl font-semibold mb-1">Claude</h1>
        <p className="text-sm text-muted-foreground mb-8">Assistente do seu workspace</p>

        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          autoFocus
          className="w-full bg-panel border border-border rounded-xl px-4 py-3 text-base text-center outline-none focus:border-primary/60 mb-3"
        />
        {error && <p className="text-[13px] text-red-400 mb-3">{error}</p>}
        <button
          type="submit"
          disabled={!password || loading}
          className="w-full bg-primary text-primary-foreground rounded-xl px-4 py-3 text-sm font-medium hover:bg-[var(--accent-soft)] active:scale-[0.99] disabled:opacity-50 transition-all"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-[11px] text-muted-foreground mt-6">Acesso restrito.</p>
      </form>
    </div>
  );
}

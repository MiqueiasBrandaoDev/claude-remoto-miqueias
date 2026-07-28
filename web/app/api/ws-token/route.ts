import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, authEnabled } from "@/lib/session";

// Entrega o token de conexao da ponte SO pra quem tem sessao valida.
// Assim o token nao vaza no bundle publico e ninguem conecta na ponte sem login.
export async function GET() {
  if (authEnabled()) {
    const jar = await cookies();
    const ok = await verifySessionToken(jar.get(SESSION_COOKIE)?.value);
    if (!ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token: process.env.CLIENT_TOKEN || "" });
}

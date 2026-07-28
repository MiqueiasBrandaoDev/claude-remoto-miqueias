import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Entrega o token de conexao da ponte SO pra quem esta autenticado.
// Assim o token nao vaza no bundle publico e ninguem conecta na ponte sem login.
export async function GET() {
  const authEnabled = !!process.env.AUTH_GOOGLE_ID;
  if (authEnabled) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token: process.env.CLIENT_TOKEN || "" });
}

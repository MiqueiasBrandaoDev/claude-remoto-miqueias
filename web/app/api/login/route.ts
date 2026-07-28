import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, passwordMatches, authEnabled } from "@/lib/session";

export async function POST(req: Request) {
  // sem senha configurada (dev): libera
  if (!authEnabled()) return NextResponse.json({ ok: true });

  let password = "";
  try { password = (await req.json())?.password || ""; } catch {}

  if (!passwordMatches(password)) {
    return NextResponse.json({ error: "senha incorreta" }, { status: 401 });
  }

  const token = await createSessionToken();
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return NextResponse.json({ ok: true });
}

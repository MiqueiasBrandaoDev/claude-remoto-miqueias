import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken, authEnabled } from "@/lib/session";

// Gate de paginas por cookie de sessao. As rotas /api cuidam da propria auth.
export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next(); // dev local sem senha = sem gate

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isLogin = req.nextUrl.pathname === "/login";

  if (ok) {
    // ja logado: nao faz sentido ficar na tela de login
    if (isLogin) return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  // sem sessao: so pode ver o /login
  if (isLogin) return NextResponse.next();
  return NextResponse.redirect(new URL("/login", req.url));
}

// roda em tudo, menos /api (cada rota se protege), estaticos, manifest e icones
export const config = {
  matcher: ["/((?!api|manifest.webmanifest|icon|apple-icon|_next/static|_next/image|favicon.ico).*)"],
};

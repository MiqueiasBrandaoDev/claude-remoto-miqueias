export { auth as middleware } from "@/auth";

// protege tudo, menos as rotas de auth, estaticos e a propria pagina de login
export const config = {
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};

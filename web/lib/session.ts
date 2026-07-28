import { SignJWT, jwtVerify } from "jose";

// Sessao por cookie assinado (JWT HS256 com AUTH_SECRET). Sem sair do dominio:
// o login acontece dentro do proprio app, entao o PWA fica em tela cheia.
export const SESSION_COOKIE = "camozzi_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano (raramente re-loga)

function secret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET || "dev-insecure-secret");
}

// O gate so "liga" se houver senha configurada. Sem APP_PASSWORD => sem gate (dev local).
export function authEnabled() {
  return !!process.env.APP_PASSWORD;
}

export async function createSessionToken() {
  return await new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(secret());
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}

// comparacao de senha em tempo ~constante
export function passwordMatches(input: string) {
  const expected = process.env.APP_PASSWORD || "";
  if (!input || input.length !== expected.length) return false;
  let out = 0;
  for (let i = 0; i < input.length; i++) out |= input.charCodeAt(i) ^ expected.charCodeAt(i);
  return out === 0;
}

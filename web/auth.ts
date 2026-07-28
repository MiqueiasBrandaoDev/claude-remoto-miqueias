import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Auth so "liga" se as envs do Google existirem (em producao). No dev local,
// sem envs, o painel abre sem gate.
const authEnabled = !!process.env.AUTH_GOOGLE_ID;

// Allowlist: so estes e-mails entram (ex: miqueiasbrandaogyn@gmail.com).
const allowed = (process.env.ALLOWED_EMAILS || "")
  .toLowerCase()
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: authEnabled ? [Google] : [],
  pages: { signIn: "/login" },
  callbacks: {
    // deixa entrar so quem esta na allowlist
    signIn({ profile }) {
      if (!allowed.length) return true;
      const email = (profile?.email || "").toLowerCase();
      return allowed.includes(email);
    },
    // usado pelo middleware pra decidir acesso as paginas
    authorized({ auth }) {
      if (!authEnabled) return true; // dev local
      return !!auth?.user;
    },
  },
});

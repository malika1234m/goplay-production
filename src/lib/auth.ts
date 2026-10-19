import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { findOrCreateGoogleUser } from "@/lib/google-auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getClientIp, loginBlocked, recordLoginFailure } from "@/lib/rateLimiter";
import { verifyTurnstile } from "@/lib/turnstile";

class RateLimitError extends CredentialsSignin {
  code = "rate_limit";
}
class CaptchaError extends CredentialsSignin {
  code = "captcha";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        turnstileToken: { label: "Security check", type: "text" },
      },
      async authorize(credentials, request) {
        // Website only — the apps sign in through /api/auth/mobile-login
        const ip = getClientIp(request);
        if (!(await verifyTurnstile(credentials?.turnstileToken, ip))) throw new CaptchaError();

        const email = String(credentials?.email ?? "").toLowerCase().trim();
        if (await loginBlocked(email, ip)) throw new RateLimitError();

        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
        });

        // Always run bcrypt even when user not found — prevents email enumeration via timing
        const DUMMY_HASH = "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012345";
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user?.password ?? DUMMY_HASH
        );

        if (!user || !user.isActive || !passwordMatch) {
          if (email) await recordLoginFailure(email, ip);
          return null;
        }

        return {
          id:                 user.id,
          name:               user.name,
          email:              user.email,
          role:               user.role,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    // "Continue with Google" — only when the OAuth client is configured (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET)
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET ? [Google] : []),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email || profile.email_verified !== true) return "/login?error=google";
      const user = await findOrCreateGoogleUser({
        email:   profile.email,
        name:    profile.name ?? profile.email.split("@")[0],
        picture: typeof profile.picture === "string" ? profile.picture : undefined,
      });
      return user.isActive ? true : "/login?error=inactive";
    },
    async jwt({ token, user, account }) {
      // Google hands us its own profile — swap in the GoPlay account it belongs to
      if (account?.provider === "google" && token.email) {
        const dbUser = await db.user.findFirst({ where: { email: { equals: token.email, mode: "insensitive" } } });
        if (dbUser) {
          token.id                 = dbUser.id;
          token.name               = dbUser.name;
          token.role               = dbUser.role;
          token.mustChangePassword = false;   // they never chose that password, so don't force a change
        }
        token.signedInAt = Date.now();
        return token;
      }
      if (user) {
        token.id                 = user.id;
        token.role               = (user as any).role;
        token.mustChangePassword = (user as any).mustChangePassword;
        token.signedInAt         = Date.now();
        return token;
      }
      // Later requests: end the session if the account was deactivated, or its sessions were
      // revoked (password reset, account recovered through Google) after this sign-in
      if (token.id) {
        const current = await db.user.findUnique({ where: { id: token.id as string }, select: { isActive: true, sessionsValidAfter: true } });
        if (!current?.isActive) return null;
        if (current.sessionsValidAfter && Number(token.signedInAt ?? 0) < current.sessionsValidAfter.getTime()) return null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id                 = token.id as string;
        session.user.role               = token.role as string;
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
});

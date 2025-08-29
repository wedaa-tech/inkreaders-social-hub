// auth.ts — NextAuth v4 shared config for App Router
import type { NextAuthOptions } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,   // required so JWTs are signed
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_ID!,
      clientSecret: process.env.GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token }) {
      // add fields to token if needed
      return token;
    },
    async session({ session, token }) {
      (session as any).sub = token.sub; // expose stable user id if you want
      return session;
    },
  },
};

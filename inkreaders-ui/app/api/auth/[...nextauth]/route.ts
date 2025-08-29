// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import { authOptions } from "@/auth"; // if you don't have "@/auth" alias, see note below

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };

// --- If you don't use a path alias for "@/auth", replace the import with:
// import { authOptions } from "../../../auth";

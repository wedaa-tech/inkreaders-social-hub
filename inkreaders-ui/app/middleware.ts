// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const inkSid = req.cookies.get("ink_sid")?.value;

  // Protect /exercises and /notebook routes
if (inkSid && req.nextUrl.pathname === "/login") {
      return NextResponse.redirect(new URL("/", req.url));
  }
    
  return NextResponse.next();
}

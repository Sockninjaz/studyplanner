import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { NextFetchEvent } from "next/server";

export default function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  return withAuth(req, event);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password|share|privacy|voorwaarden|terms|$).*)'],
};

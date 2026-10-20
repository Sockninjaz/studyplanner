import { withAuth } from "next-auth/middleware";
import type { NextRequestWithAuth } from "next-auth/middleware";
import type { NextFetchEvent } from "next/server";

const middlewareSecret =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  'a8f5b6e3c1d9a7b0c2e8f3d6a9c1b4e7f0a2d8c4b6e9a1d0c3f7b2e5a9d1c8e3';

export default function middleware(req: NextRequestWithAuth, event: NextFetchEvent) {
  return withAuth(req, {
    secret: middlewareSecret,
  });
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password|share|privacy|voorwaarden|terms|$).*)'],
};

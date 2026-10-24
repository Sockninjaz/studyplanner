import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const middlewareSecret =
  process.env.NEXTAUTH_SECRET ||
  process.env.AUTH_SECRET ||
  'a8f5b6e3c1d9a7b0c2e8f3d6a9c1b4e7f0a2d8c4b6e9a1d0c3f7b2e5a9d1c8e3';

export async function middleware(req: NextRequest) {
  let token = await getToken({ req, secret: middlewareSecret });

  if (!token) {
    const secureCookieName = '__Secure-next-auth.session-token';
    const defaultCookieName = 'next-auth.session-token';

    if (req.cookies.has(secureCookieName)) {
      token = await getToken({ req, secret: middlewareSecret, cookieName: secureCookieName });
    } else if (req.cookies.has(defaultCookieName)) {
      token = await getToken({ req, secret: middlewareSecret, cookieName: defaultCookieName });
    }
  }

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login|register|forgot-password|reset-password|share|privacy|voorwaarden|terms|$).*)'],
};

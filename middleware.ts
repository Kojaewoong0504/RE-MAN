import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAMES } from "@/lib/auth/constants";

const PROTECTED_PREFIXES = [
  "/profile",
  "/settings",
  "/closet",
  "/history",
  "/credits",
  "/programs/style/onboarding"
];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!isProtected) {
    return NextResponse.next();
  }

  const hasAccessCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAMES.access)?.value);
  const hasRefreshCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAMES.refresh)?.value);

  if (hasAccessCookie || hasRefreshCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("returnTo", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/profile/:path*",
    "/settings/:path*",
    "/closet/:path*",
    "/history/:path*",
    "/credits/:path*",
    "/programs/style/onboarding/:path*"
  ]
};

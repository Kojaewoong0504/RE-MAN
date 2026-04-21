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
const CANONICAL_PRODUCTION_HOST = "re-man.vercel.app";

function shouldRedirectToCanonicalHost(host: string) {
  return (
    host.endsWith(".vercel.app") &&
    host !== CANONICAL_PRODUCTION_HOST &&
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1")
  );
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const host = request.headers.get("host") ?? request.nextUrl.host;

  if (shouldRedirectToCanonicalHost(host)) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.protocol = "https:";
    canonicalUrl.host = CANONICAL_PRODUCTION_HOST;
    return NextResponse.redirect(canonicalUrl);
  }

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
    "/((?!api|_next/static|_next/image|favicon.ico).*)"
  ]
};

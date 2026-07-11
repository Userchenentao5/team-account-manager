import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let authenticated = false;
  try {
    authenticated = await verifySessionToken(
      request.cookies.get(AUTH_COOKIE_NAME)?.value,
    );
  } catch {
    authenticated = false;
  }

  if (pathname === "/login") {
    if (!authenticated) return NextResponse.next();

    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  if (authenticated) return NextResponse.next();

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

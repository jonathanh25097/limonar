import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends people without a session cookie to the sign-in page. This only checks
 * that a cookie exists; the API verifies it on every call.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has("limonar_session")) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};

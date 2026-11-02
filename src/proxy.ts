import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic check only: without a session cookie there is no point
 * rendering a page, so go straight to the login form and come back after.
 * The real check (signature, account state) runs in every page and server
 * action through requireUser().
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("et_session")) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = next === "/" ? "" : `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip the login page, the API (it answers 401 itself), Next internals and files with an extension
  matcher: ["/((?!login|api|_next|.*\\..*).*)"],
};

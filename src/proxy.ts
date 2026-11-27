import { NextResponse, type NextRequest } from "next/server";

/**
 * Backend-only deployment (SECUREEXAM_PORTAL_ONLY=1): the real system is served at /portal, so the
 * design-preview routes of the frontend (which run on mock data) send visitors into the portal instead.
 * Without the flag this does nothing, so the frontend deployment behaves exactly as before.
 */
export function proxy(request: NextRequest) {
  if (process.env.SECUREEXAM_PORTAL_ONLY !== "1") return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  const role = /^\/(candidate|examiner|admin)(?:\/|$)/.exec(pathname)?.[1];
  const target = pathname === "/" ? "/portal"
    : pathname === "/login" ? "/portal/login"
    : role ? `/portal/${role}`
    : pathname.startsWith("/exam/") ? "/portal"
    : null;
  return target ? NextResponse.redirect(new URL(target + (pathname === "/login" ? search : ""), request.url)) : NextResponse.next();
}

export const config = { matcher: ["/", "/login", "/candidate/:path*", "/examiner/:path*", "/admin/:path*", "/exam/:path*"] };

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const cookie = request.headers.get("cookie") || "";

  try {
    // Call the Better Auth session endpoint using native fetch
    // INTERNAL_APP_URL (e.g. http://127.0.0.1:3000 in the pod) avoids hairpinning through the CDN.
    const sessionOrigin = process.env.INTERNAL_APP_URL || request.nextUrl.origin;
    const res = await fetch(`${sessionOrigin}/api/auth/get-session`, {
      headers: {
        cookie: cookie,
      },
    });

    // If there's no active session, redirect them to the landing/sign-in page
    if (!res.ok) {
      return NextResponse.redirect(new URL("/landing", request.url));
    }

    const sessionData = await res.json();

    // STRICT OTP GUARD: If they have a session but are unverified
    if (sessionData?.user && sessionData.user.emailVerified === false) {
      // Force them to the verification screen
      const verifyUrl = new URL("/verify", request.url);
      verifyUrl.searchParams.set("email", sessionData.user.email);
      return NextResponse.redirect(verifyUrl);
    }

  } catch (error) {
    // If the fetch fails for any reason (e.g. server error), safely redirect to login
    return NextResponse.redirect(new URL("/landing", request.url));
  }

  // Allow the request to proceed to the protected route
  return NextResponse.next();
}

export const config = {
  // Apply this middleware to the root ("/") and any other protected routes.
  // We strictly EXCLUDE public routes like auth pages, APIs, and static files.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|landing|sign-in|sign-up|forgot-password|reset-password|verify).*)"
  ],
};

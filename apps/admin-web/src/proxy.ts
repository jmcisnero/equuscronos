import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const token = request.cookies.get("session-token")?.value;
  const { pathname } = request.nextUrl;

  // Si no está autenticado y está intentando acceder a una página protegida
  if (!token) {
    if (pathname !== "/login") {
      const callbackUrl = encodeURIComponent(
        request.nextUrl.pathname + request.nextUrl.search,
      );
      return NextResponse.redirect(
        new URL(`/login?callbackUrl=${callbackUrl}`, request.url),
      );
    }
  } else {
    // Si está autenticado e intenta ingresar a la página de login, redirige al dashboard central
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.webp$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)",
  ],
};

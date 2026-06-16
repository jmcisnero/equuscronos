import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
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
  /*
   * Coincide con todas las rutas de solicitud excepto:
   * - api (rutas de la API del Next.js si las hubiera)
   * - _next/static (archivos estáticos)
   * - _next/image (optimización de imágenes)
   * - favicon.ico y archivos de íconos/logos (.png, .webp, .svg, .jpg)
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.webp$|.*\\.jpg$|.*\\.jpeg$|.*\\.svg$).*)",
  ],
};

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Quand le site est servi depuis sikastock.onrender.com (ou futur sikastock.tg),
// la racine affiche SikaStock au lieu de SantéConnect.
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  if (!host.startsWith("sikastock")) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/sika") ||
    pathname.startsWith("/digitogo")
  ) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/sika" : "/sika" + pathname;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|favicon.ico).*)"],
};

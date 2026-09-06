import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/adminCookieName";

/**
 * Pedido explícito: la guía de bienvenida (app/welcome/page.tsx) tiene que aparecer
 * SOLA en la primera visita de cada persona, no solo quedar enlazada por si alguien la
 * encuentra. Como cubre gente que todavía ni ha iniciado sesión (todo el flujo de
 * "Sign in with Discord"), no hay usuario contra el que guardar "ya la vio" — la única
 * identidad que existe en ese momento es el propio navegador, así que se guarda con
 * una cookie, no en la base de datos.
 *
 * Un año de validez: de sobra para que "primera visita" signifique eso de verdad y no
 * "primera visita de esta semana". Si alguien borra cookies, la vuelve a ver una vez —
 * aceptable, es el mismo comportamiento que cualquier "no volver a mostrar esto".
 */
const SEEN_COOKIE = "xkt_seen";
const SEEN_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const ADMIN_LOGIN_PATH = "/admin/login";

/**
 * Defensa en profundidad, no la comprobación real: solo mira si la cookie de admin
 * EXISTE, nunca valida su firma (el runtime de Edge no soporta `node:crypto`, que usa
 * lib/adminSession.ts para eso — la validación de verdad sigue pasando por
 * `requireAdmin()` dentro de cada página/Server Action). Esto solo existe para que una
 * futura página de /admin que se olvide de llamar a `requireAdmin()` no quede expuesta
 * de par en par: sin cookie, ni siquiera llega a cargar.
 */
function isAdminRouteExposed(request: NextRequest): boolean {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin") || pathname === ADMIN_LOGIN_PATH) return false;
  return !request.cookies.has(ADMIN_COOKIE_NAME);
}

export function proxy(request: NextRequest) {
  if (isAdminRouteExposed(request)) {
    return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
  }

  if (request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();

  if (request.cookies.has(SEEN_COOKIE)) return NextResponse.next();

  const originalPath = request.nextUrl.pathname + request.nextUrl.search;
  const url = request.nextUrl.clone();
  url.pathname = "/welcome";
  url.search = originalPath === "/" ? "" : `?next=${encodeURIComponent(originalPath)}`;

  const response = NextResponse.redirect(url);
  response.cookies.set(SEEN_COOKIE, "1", { maxAge: SEEN_COOKIE_MAX_AGE, path: "/" });
  return response;
}

export const config = {
  // Todo lo que sea contenido real de la web — nunca la API (rompería la subida de
  // MatchLog, el callback de Discord, el sondeo de Live Scores...), nunca `/welcome`
  // (o el redirect se muerde la cola), y nunca los archivos estáticos de Next ni los de
  // la raíz de `public/` que el navegador pide solo. `/admin` SÍ entra ahora (antes
  // estaba excluido entero) — solo para el respaldo de cookie-ausente de arriba, nunca
  // para el redirect de bienvenida.
  matcher: ["/((?!api|_next/static|_next/image|welcome|favicon.ico|robots.txt|sitemap.xml).*)"],
};

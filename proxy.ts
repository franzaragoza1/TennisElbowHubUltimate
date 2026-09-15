import { NextResponse, type NextRequest } from "next/server";

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

/**
 * Dominio por defecto de Render (auto-hospedaje, 2026-09-15) — sigue sirviendo el
 * mismo sitio en paralelo al dominio propio a menos que se redirija a mano, Render no
 * trae ningún ajuste para esto. Cualquiera que llegue por él (enlaces viejos de
 * cuando se probó el despliegue, o quien lo encuentre por curiosidad) se manda al
 * dominio real — nunca se sirve contenido dos veces bajo dos hosts distintos.
 */
const RENDER_DEFAULT_HOST = "xkt-tour.onrender.com";

/**
 * Ya no hay ninguna ruta /admin que proteger aquí — el panel entero vive dentro de
 * /account como una sección más (components/account/AdminSection.tsx), gateada por
 * `requireAdmin()`/`isAdmin()` (lib/adminSession.ts) dentro de cada Server Action y
 * al construir esa sección en app/account/page.tsx. Este middleware solo se ocupa ya
 * del redirect de bienvenida.
 */
export function proxy(request: NextRequest) {
  // Antes que nada, sin mirar la cookie: da igual si este navegador ya vio /welcome,
  // el host equivocado se redirige siempre. `SITE_URL` es la misma variable que ya
  // usa el resto del proyecto como fuente única del dominio real — si algún día
  // cambia, esto no se queda apuntando a uno viejo.
  if (request.headers.get("host") === RENDER_DEFAULT_HOST && process.env.SITE_URL) {
    const target = new URL(request.nextUrl.pathname + request.nextUrl.search, process.env.SITE_URL);
    return NextResponse.redirect(target, 308);
  }

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
  //
  // `.*\..*` (cualquier segmento con un punto) añadido tras un bug real encontrado al
  // probar el sitio fuera de Vercel (pase de auto-hospedaje, 2026-09-15): el propio
  // `next/image` interno resuelve una imagen LOCAL (p.ej. `/assets/logo.png`) con una
  // petición simulada en el propio proceso, sin ninguna cookie — antes eso caía en este
  // mismo matcher (nada la excluía salvo `_next/static`), así que ese fetch interno
  // siempre recibía el redirect 307 a `/welcome` en vez del PNG real, y la imagen
  // optimizada salía "isn't a valid image". Invisible en Vercel porque ahí la
  // optimización de imágenes corre en su propia infraestructura aparte, sin pasar por
  // este middleware en absoluto — solo se manifestaba al auto-hospedar. Ninguna ruta
  // real del sitio lleva un punto en su path, así que excluir cualquier segmento con
  // uno cubre `/assets/*`, fuentes, etc. sin tener que enumerarlos uno a uno (y sigue
  // cubriendo `favicon.ico`, `robots.txt`, `sitemap.xml` igual que antes).
  matcher: ["/((?!api|_next/static|_next/image|welcome|.*\\..*).*)"],
};

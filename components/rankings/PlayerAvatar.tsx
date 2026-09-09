import { CountryFlag } from "./CountryFlag";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + (last ?? "")).toUpperCase();
}

const SIZES = {
  sm: {
    avatar: "h-11 w-11",
    text: "text-xs",
    flag: "h-5 w-5 -right-1 -bottom-1 border-2",
  },
  lg: {
    avatar: "h-24 w-24",
    text: "text-2xl",
    flag: "h-9 w-9 -right-1 -bottom-1 border-[3px]",
  },
} as const;

export function PlayerAvatar({
  displayName,
  country,
  avatarUrl = null,
  size = "sm",
  onDarkSurface = false,
}: {
  displayName: string;
  country: string | null;
  /** Discord del usuario vinculado (copiado en cada login) o una foto subida a mano
   * (`players.avatarIsCustom`, ver components/account/AvatarUpload.tsx) — cualquiera
   * de las dos ya es un string válido como `src` de `<img>`, este componente no
   * necesita distinguirlas. Sin cuenta vinculada ni foto propia, caen las iniciales. */
  avatarUrl?: string | null;
  size?: "sm" | "lg";
  /** true cuando este avatar se pinta sobre una superficie SIEMPRE oscura, sin
   * importar el tema del sitio (cabeceras navy fijas: PlayerHeader, H2HHeader, el
   * cuadro de campeón de StatsLeadersShowcase, la fila de ganador de
   * NextOpponentPanel) — ahí el aro/bandera se quedan en un blanco fijo, igual que ya
   * hacía el aro del pfp en tamaño "lg" (`border-white/20`). En cualquier otra
   * superficie (tablas, tarjetas, sidebar), que SÍ seguía el tema del sitio, el aro y
   * el fondo de la bandera usaban `border-paper`/`bg-paper` — el mismo color que el
   * propio fondo de esa superficie, así que en tema oscuro salían casi negros en vez
   * de blancos (bug real reportado: "the flag should be white in dark mode and vice
   * versa"). `--ink` es exactamente lo contrario de `--paper` en los dos temas
   * (casi blanco en oscuro, azul marino oscuro en claro — ver app/globals.css), así
   * que da el contraste pedido sin inventar un color nuevo fuera del sistema. */
  onDarkSurface?: boolean;
}) {
  const s = SIZES[size];
  const flagRing = onDarkSurface ? "border-white bg-white" : "border-ink bg-ink";

  return (
    <div className={`relative ${s.avatar} shrink-0`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto remota de Discord o subida propia, no un asset next/image
        <img src={avatarUrl} alt="" className={`${s.avatar} rounded-full bg-paper object-cover`} />
      ) : (
        // Mismo fondo de acento para todo el que no tenga avatar todavía — la columna
        // del ranking tiene que leerse homogénea, con o sin foto configurada.
        <div
          className={`text-eyebrow flex ${s.avatar} items-center justify-center rounded-full bg-accent-500 ${s.text} text-navy-900`}
        >
          {initials(displayName)}
        </div>
      )}
      <div className={`absolute ${s.flag} overflow-hidden rounded-full ${flagRing} shadow-sm`}>
        <CountryFlag country={country} />
      </div>
    </div>
  );
}

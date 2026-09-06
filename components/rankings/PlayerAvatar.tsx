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
    border: "border-rule",
  },
  lg: {
    avatar: "h-24 w-24",
    text: "text-2xl",
    flag: "h-9 w-9 -right-1 -bottom-1 border-[3px]",
    border: "border-white/20",
  },
} as const;

export function PlayerAvatar({
  displayName,
  country,
  avatarUrl = null,
  size = "sm",
}: {
  displayName: string;
  country: string | null;
  /** Discord del usuario vinculado (copiado en cada login) o una foto subida a mano
   * (`players.avatarIsCustom`, ver components/account/AvatarUpload.tsx) — cualquiera
   * de las dos ya es un string válido como `src` de `<img>`, este componente no
   * necesita distinguirlas. Sin cuenta vinculada ni foto propia, caen las iniciales. */
  avatarUrl?: string | null;
  size?: "sm" | "lg";
}) {
  const s = SIZES[size];

  return (
    <div className={`relative ${s.avatar} shrink-0`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- foto remota de Discord o subida propia, no un asset next/image
        <img
          src={avatarUrl}
          alt=""
          className={`${s.avatar} rounded-full border-2 ${s.border} bg-paper object-cover`}
        />
      ) : (
        // Mismo fondo de acento para todo el que no tenga avatar todavía — la columna
        // del ranking tiene que leerse homogénea, con o sin foto configurada.
        <div
          className={`text-eyebrow flex ${s.avatar} items-center justify-center rounded-full border-2 ${s.border} bg-accent-500 ${s.text} text-navy-900`}
        >
          {initials(displayName)}
        </div>
      )}
      <div
        className={`absolute ${s.flag} overflow-hidden rounded-full border-paper bg-paper shadow-sm`}
      >
        <CountryFlag country={country} />
      </div>
    </div>
  );
}

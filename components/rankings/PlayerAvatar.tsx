import { CountryFlag } from "./CountryFlag";
import { renderAvatarDataUri } from "@/lib/avatar";

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
  character = null,
  size = "sm",
}: {
  displayName: string;
  country: string | null;
  character?: string | null;
  size?: "sm" | "lg";
}) {
  const s = SIZES[size];
  const avatarUri = renderAvatarDataUri(character);

  return (
    <div className={`relative ${s.avatar} shrink-0`}>
      {avatarUri ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar generado, no un asset next/image
        <img
          src={avatarUri}
          alt=""
          className={`${s.avatar} rounded-full border-2 ${s.border} bg-paper object-cover`}
        />
      ) : (
        // Mismo fondo que los avatares generados (`LOCKED_AVATAR_BACKGROUND` en
        // lib/avatar.ts): la columna del ranking tiene que leerse homogénea, con o sin
        // avatar configurado.
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

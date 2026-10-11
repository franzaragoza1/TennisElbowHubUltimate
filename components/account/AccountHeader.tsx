import Link from "next/link";
import { CourtBackdrop } from "@/components/layout/CourtBackdrop";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

/**
 * Cabecera de /account (rediseño, 2026-10-11): sustituye a la pareja PageMasthead +
 * AccountProfileCard, que repetía nombre, avatar y "View Tour Profile" dos veces (en
 * la banda y en la tarjeta lateral) y, en móvil, empujaba el contenido muy abajo. Lo
 * personal que pedía el propietario ("the Account section doesn't feel personal, looks
 * more like settings", 2026-09-18) sigue aquí, en la propia banda: avatar grande,
 * ranking y puntos de esta semana, seguidores/siguiendo.
 *
 * `rank`/`points` nulos (sin ranking esta semana) o sin ficha vinculada todavía: la
 * fila de cifras enseña solo lo que hay, nunca un "#—" inventado (CLAUDE.md §1).
 */
export function AccountHeader({
  displayName,
  country,
  avatarUrl,
  playerId,
  rank,
  points,
  followerCount,
  followingCount,
  greeting,
}: {
  displayName: string;
  country: string | null;
  avatarUrl: string | null;
  playerId?: number;
  rank?: number | null;
  points?: number | null;
  followerCount?: number;
  followingCount?: number;
  greeting: string;
}) {
  const facts: { label: string; value: string }[] = [];
  if (rank) facts.push({ label: "World rank", value: `#${rank}` });
  if (points !== null && points !== undefined) facts.push({ label: "Points", value: points.toLocaleString("en-US") });
  if (followerCount !== undefined) facts.push({ label: "Followers", value: String(followerCount) });
  if (followingCount !== undefined) facts.push({ label: "Following", value: String(followingCount) });

  return (
    <div className="relative overflow-hidden bg-navy-900">
      <CourtBackdrop />
      <div className="tour-container relative flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
        <div className="flex min-w-0 items-center gap-5">
          <PlayerAvatar displayName={displayName} country={country} avatarUrl={avatarUrl} size="lg" onDarkSurface />
          <div className="min-w-0">
            <p className="text-eyebrow text-xs text-accent-500">My account</p>
            <h1 className="text-headline mt-1 text-2xl text-balance break-words text-white sm:text-4xl">{greeting}</h1>
            {country && <p className="mt-1 text-sm text-white/60">{country}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          {facts.length > 0 && (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {facts.map((f) => (
                <div key={f.label}>
                  <dt className="text-eyebrow text-[10px] text-white/50">{f.label}</dt>
                  <dd className="tour-numeric text-headline text-lg text-white">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {playerId !== undefined && (
            <Link
              href={`/players/${playerId}`}
              prefetch={false}
              className="text-eyebrow self-start rounded-full border border-white/30 px-4 py-1.5 text-xs text-white transition-colors hover:border-accent-500 hover:text-accent-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 sm:self-end"
            >
              View tour profile
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

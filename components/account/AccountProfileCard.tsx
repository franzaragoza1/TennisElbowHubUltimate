import Link from "next/link";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";

/**
 * Tarjeta de identidad pegada encima de la lista de secciones de /account — pedido
 * explícito del propietario, 2026-09-18: "the Account section doesn't feel personal,
 * looks more like settings". Antes lo único personal de toda la página era el
 * `PageMasthead` de arriba del todo ("Welcome back, X"); en cuanto alguien cambiaba de
 * pestaña (Build, Point of the Month...) ese saludo quedaba fuera de pantalla y el
 * resto se sentía un panel de ajustes cualquiera. Esta tarjeta va DENTRO de la columna
 * de navegación (`SectionShell` variant="sidebar", prop `header`), así que sigue
 * visible sin importar qué pestaña esté activa.
 *
 * Solo para un jugador ya vinculado — `stats` es opcional a propósito: alguien sin
 * perfil reclamado todavía (pantalla "Claim your profile") o un admin sin jugador
 * vinculado no tiene seguidores/seguidos que enseñar.
 */
export function AccountProfileCard({
  displayName,
  country,
  avatarUrl,
  playerId,
  stats,
}: {
  displayName: string;
  country: string | null;
  avatarUrl: string | null;
  playerId?: number;
  stats?: { followerCount: number; followingCount: number };
}) {
  return (
    <div className="rounded-lg border border-rule bg-paper p-4">
      <div className="flex items-center gap-3">
        <PlayerAvatar displayName={displayName} country={country} avatarUrl={avatarUrl} size="md" />
        <div className="min-w-0">
          <p className="text-headline truncate text-sm text-ink">{displayName}</p>
          {country && <p className="text-muted-label truncate text-xs">{country}</p>}
        </div>
      </div>

      {stats && (
        <div className="mt-3 flex items-center gap-4 border-t border-rule pt-3 text-xs">
          <span>
            <span className="tour-numeric text-headline text-ink">{stats.followerCount}</span> <span className="text-muted-label">followers</span>
          </span>
          <span>
            <span className="tour-numeric text-headline text-ink">{stats.followingCount}</span> <span className="text-muted-label">following</span>
          </span>
        </div>
      )}

      {playerId !== undefined && (
        <Link
          href={`/players/${playerId}`}
          className="text-eyebrow mt-3 block rounded-full border border-rule px-3 py-1.5 text-center text-[10px] text-muted-label transition-colors hover:border-blue-500 hover:text-blue-500"
        >
          View Tour Profile
        </Link>
      )}
    </div>
  );
}

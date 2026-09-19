import Link from "next/link";
import { ageFromBirthDate } from "@/lib/age";
import type { PlayerSocialStats } from "@/lib/playerSocialStats";

export interface PlayerFactsCardPlayer {
  bio: string | null;
  realName: string | null;
  birthDate: string | null;
  playstyle: string | null;
  clothingBrand: string | null;
  racketBrand: string | null;
  instagramHandle: string | null;
  youtubeUrl: string | null;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

const PLAYSTYLE_LABEL: Record<string, string> = {
  "right-handed": "Right-handed",
  "left-handed": "Left-handed",
};

function InstagramIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="M10.5 9.5v5l4.5-2.5-4.5-2.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Todos los campos "de ficha" (bio, real name, playstyle...) son opcionales y se
 * rellenan uno a uno desde /account (components/account/PlayerProfileForm.tsx) — sin
 * toggle de visibilidad, el propio jugador ya decide qué enseña con lo que rellena.
 *
 * `socialStats` es distinto: siempre se calcula (nunca lo rellena el jugador a mano,
 * ver lib/playerSocialStats.ts), y por eso puede hacer que la tarjeta aparezca aunque
 * ningún campo de ficha esté relleno — un jugador con 3 seguidores pero sin bio
 * escrita todavía sigue mereciendo la tarjeta.
 */
export function PlayerFactsCard({ player, socialStats }: { player: PlayerFactsCardPlayer; socialStats: PlayerSocialStats }) {
  const age = player.birthDate ? ageFromBirthDate(player.birthDate) : null;
  const playstyleLabel = player.playstyle ? (PLAYSTYLE_LABEL[player.playstyle] ?? null) : null;
  const hasEquipment = player.clothingBrand || player.racketBrand;
  const hasSocialLinks = player.instagramHandle || player.youtubeUrl;
  const hasFacts = player.realName || age !== null || playstyleLabel || hasEquipment;
  const hasSiteActivity = socialStats.followerCount > 0 || socialStats.linked !== null;

  if (!player.bio && !hasFacts && !hasSocialLinks && !hasSiteActivity) return null;

  return (
    <div>
      <h2 className="text-headline mb-4 text-lg text-ink">About</h2>
      <div className="rounded-lg border border-rule bg-paper p-4 shadow-sm">
        {player.bio && <p className="text-ink mb-4 text-sm leading-relaxed">{player.bio}</p>}

        {hasFacts && (
          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {player.realName && (
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Real name</dt>
                <dd className="text-sm text-ink">{player.realName}</dd>
              </div>
            )}
            {age !== null && (
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Age</dt>
                <dd className="text-sm text-ink">{age}</dd>
              </div>
            )}
            {playstyleLabel && (
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Playstyle</dt>
                <dd className="text-sm text-ink">{playstyleLabel}</dd>
              </div>
            )}
            {player.clothingBrand && (
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Clothing</dt>
                <dd className="text-sm text-ink">{player.clothingBrand}</dd>
              </div>
            )}
            {player.racketBrand && (
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Racket</dt>
                <dd className="text-sm text-ink">{player.racketBrand}</dd>
              </div>
            )}
          </dl>
        )}

        {hasSocialLinks && (
          <div className="flex items-center gap-3 border-t border-rule pt-3">
            {player.instagramHandle && (
              <a
                href={`https://instagram.com/${player.instagramHandle}`}
                target="_blank"
                rel="noopener noreferrer"
                title={`@${player.instagramHandle} on Instagram`}
                className="text-muted-label transition-colors duration-150 hover:text-blue-500"
              >
                <InstagramIcon />
              </a>
            )}
            {player.youtubeUrl && (
              <a
                href={player.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="YouTube"
                className="text-muted-label transition-colors duration-150 hover:text-blue-500"
              >
                <YouTubeIcon />
              </a>
            )}
          </div>
        )}

        {hasSiteActivity && (
          <div className={hasFacts || hasSocialLinks || player.bio ? "border-t border-rule pt-3" : undefined}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Followers</dt>
                <dd className="tour-numeric text-sm text-ink">{socialStats.followerCount}</dd>
              </div>
              {socialStats.linked && (
                <>
                  <div>
                    <dt className="text-eyebrow text-[10px] text-muted-label">Following</dt>
                    <dd className="tour-numeric text-sm text-ink">{socialStats.linked.followingCount}</dd>
                  </div>
                  <div>
                    <dt className="text-eyebrow text-[10px] text-muted-label">Topics posted</dt>
                    <dd className="tour-numeric text-sm text-ink">{socialStats.linked.topicsPostedCount}</dd>
                  </div>
                  {socialStats.linked.articlesPostedCount !== null && (
                    <div>
                      <dt className="text-eyebrow text-[10px] text-muted-label">Articles</dt>
                      <dd className="tour-numeric text-sm text-ink">{socialStats.linked.articlesPostedCount}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
            {socialStats.linked?.lastActivity && (
              <p className="text-muted-label mt-3 text-xs">
                Last active {formatDate(socialStats.linked.lastActivity.createdAt)} —{" "}
                <Link href={socialStats.linked.lastActivity.href} className="text-blue-500 hover:underline">
                  {socialStats.linked.lastActivity.kind === "topic_comment" ? "replied in" : "commented on"} {socialStats.linked.lastActivity.contextTitle}
                </Link>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

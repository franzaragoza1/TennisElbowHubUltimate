import { ageFromBirthDate } from "@/lib/age";

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
 * Todos los campos son opcionales y se rellenan uno a uno desde /account
 * (components/account/PlayerProfileForm.tsx) — sin toggle de visibilidad, el propio
 * jugador ya decide qué enseña con lo que rellena. Cada campo se omite si está vacío,
 * y la tarjeta entera desaparece si no hay ni un solo campo relleno (una ficha sin
 * personalizar no enseña una tarjeta vacía).
 */
export function PlayerFactsCard({ player }: { player: PlayerFactsCardPlayer }) {
  const age = player.birthDate ? ageFromBirthDate(player.birthDate) : null;
  const playstyleLabel = player.playstyle ? (PLAYSTYLE_LABEL[player.playstyle] ?? null) : null;
  const hasEquipment = player.clothingBrand || player.racketBrand;
  const hasSocials = player.instagramHandle || player.youtubeUrl;
  const hasFacts = player.realName || age !== null || playstyleLabel || hasEquipment;

  if (!player.bio && !hasFacts && !hasSocials) return null;

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

        {hasSocials && (
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
      </div>
    </div>
  );
}

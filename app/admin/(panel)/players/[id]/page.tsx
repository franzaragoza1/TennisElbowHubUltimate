import Link from "next/link";
import { notFound } from "next/navigation";
import { getOtherPlayers, getPlayerAdminDetail } from "@/app/admin/players/actions";
import { CountryOverrideForm } from "@/components/admin/players/CountryOverrideForm";
import { AliasReassignForm } from "@/components/admin/players/AliasReassignForm";
import { KnownNamesForm } from "@/components/admin/players/KnownNamesForm";
import { UnlinkAccountButton } from "@/components/admin/players/UnlinkAccountButton";

export const dynamic = "force-dynamic";

export default async function AdminPlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const playerId = Number(id);
  if (!Number.isInteger(playerId)) notFound();

  const detail = await getPlayerAdminDetail(playerId);
  if (!detail) notFound();

  const candidates = await getOtherPlayers(playerId);

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-headline text-2xl text-ink">{detail.displayName}</h1>
          <p className="text-muted-label text-xs">Player #{detail.id}</p>
        </div>
        <Link href={`/players/${detail.id}`} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
          View public page
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Linked account</h2>
        {detail.linkedAccount ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rule bg-paper px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              {detail.linkedAccount.image && (
                // eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Discord
                <img src={detail.linkedAccount.image} alt="" className="h-8 w-8 shrink-0 rounded-full" />
              )}
              <p className="text-ink truncate text-sm">{detail.linkedAccount.name ?? "Unknown Discord user"}</p>
            </div>
            <UnlinkAccountButton playerId={detail.id} />
          </div>
        ) : (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-3 text-sm">
            No Discord account linked to this profile.
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Nationality</h2>
        <CountryOverrideForm playerId={detail.id} realCountry={detail.country} countryOverride={detail.countryOverride} />
      </section>

      <section className="mb-8">
        <h2 className="text-headline mb-3 text-lg text-ink">Known names (for match log matching)</h2>
        <KnownNamesForm playerId={detail.id} knownNames={detail.knownNames} />
      </section>

      <section>
        <h2 className="text-headline mb-3 text-lg text-ink">Aliases</h2>
        {detail.aliases.length === 0 ? (
          <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-8 text-center text-sm">
            No aliases on record for this player.
          </p>
        ) : (
          <div className="space-y-2">
            {detail.aliases.map((a) => (
              <AliasReassignForm
                key={a.id}
                aliasId={a.id}
                currentPlayerId={detail.id}
                sourceSlug={a.sourceSlug}
                externalId={a.externalId}
                displayName={a.displayName}
                candidates={candidates}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

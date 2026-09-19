import { redirect, notFound } from "next/navigation";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { PlayerAvatar } from "@/components/rankings/PlayerAvatar";
import { LinkifiedText } from "@/components/LinkifiedText";
import { getLinkedPlayerId } from "@/lib/auth";
import { getMemberProfile } from "@/lib/memberProfile";

export const dynamic = "force-dynamic";

/**
 * Destino de "commenters should be clickable" (pedido explícito, 2026-09-18) para
 * cualquier autor de un comentario/tema — no solo jugadores del tour. Una cuenta YA
 * vinculada a un jugador redirige a su ficha de siempre (/players/[id], con toda la
 * riqueza de lib/playerSocialStats.ts): esta página nunca duplica esa vista, solo
 * cubre el hueco que quedaba para quien todavía no está vinculado.
 */
export default async function MemberProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  const linkedPlayerId = await getLinkedPlayerId(userId);
  if (linkedPlayerId) redirect(`/players/${linkedPlayerId}`);

  const profile = await getMemberProfile(userId);
  if (!profile) notFound();

  return (
    <div>
      <PageMasthead eyebrow="XKT World Tour" title={profile.displayName} />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0 max-w-[640px]">
          <div className="rounded-lg border border-rule bg-paper p-4">
            <div className="flex items-center gap-3">
              <PlayerAvatar displayName={profile.displayName} country={null} avatarUrl={profile.image} size="lg" />
              <div>
                <p className="text-headline text-lg text-ink">{profile.displayName}</p>
                <p className="text-muted-label text-xs">Site member — not a tour player</p>
              </div>
            </div>

            {profile.bio && (
              <p className="text-ink mt-4 border-t border-rule pt-4 text-sm leading-relaxed">
                <LinkifiedText text={profile.bio} />
              </p>
            )}

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-rule pt-4 sm:grid-cols-3">
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Topics posted</dt>
                <dd className="tour-numeric text-sm text-ink">{profile.topicsPostedCount}</dd>
              </div>
              <div>
                <dt className="text-eyebrow text-[10px] text-muted-label">Comments</dt>
                <dd className="tour-numeric text-sm text-ink">{profile.commentsPostedCount}</dd>
              </div>
              {profile.articlesPostedCount !== null && (
                <div>
                  <dt className="text-eyebrow text-[10px] text-muted-label">Articles</dt>
                  <dd className="tour-numeric text-sm text-ink">{profile.articlesPostedCount}</dd>
                </div>
              )}
            </dl>

            {profile.lastActivity && (
              <p className="text-muted-label mt-3 border-t border-rule pt-3 text-xs">
                Last active — {profile.lastActivity.kind === "topic_comment" ? "replied in" : "commented on"}{" "}
                <a href={profile.lastActivity.href} className="text-blue-500 hover:underline">
                  {profile.lastActivity.contextTitle}
                </a>
              </p>
            )}
          </div>
        </div>
        <Sidebar />
      </div>
    </div>
  );
}

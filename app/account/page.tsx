import { and, eq, getTableColumns } from "drizzle-orm";
import Link from "next/link";
import {
  User,
  LayoutDashboard,
  Wrench,
  Newspaper,
  Trophy,
  ListOrdered,
  Activity,
  Award,
  Sparkles,
  Star,
  Users,
  Video,
  Radio,
  Image as ImageIcon,
  PenSquare,
  MessageCircle,
  MessagesSquare,
} from "lucide-react";
import { db } from "@/db/client";
import { players, playerClaimRequests, playerBuilds, newsReporterRequests } from "@/db/schema";
import { getCurrentUser, getLinkedPlayerId } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { RankingsSection } from "@/components/admin/sections/RankingsSection";
import { ScoresSection } from "@/components/admin/sections/ScoresSection";
import { MatchLogSection as AdminMatchLogSection } from "@/components/admin/sections/MatchLogSection";
import { VideosSection } from "@/components/admin/sections/VideosSection";
import { ThumbnailsSection } from "@/components/admin/sections/ThumbnailsSection";
import { TournamentsSection } from "@/components/admin/sections/TournamentsSection";
import { NewsSection, type PendingReporterRequestRow, type ReporterRow } from "@/components/admin/sections/NewsSection";
import { CommentsModerationSection } from "@/components/admin/sections/CommentsModerationSection";
import { getRecentCommentsForModeration } from "@/lib/comments";
import { DiscussionsModerationSection } from "@/components/admin/sections/DiscussionsModerationSection";
import { getRecentTopicsForModeration, getRecentTopicCommentsForModeration } from "@/lib/discussionTopics";
import { AccountHeader } from "@/components/account/AccountHeader";
import { getCareerStats } from "@/lib/h2hStats";
import { getPlayerSocialStats } from "@/lib/playerSocialStats";
import { MemberBioForm } from "@/components/account/MemberBioForm";
import { getNewsListRows } from "@/app/admin/actions";
import { getNewsFormOptions } from "@/lib/adminQueries";
import { ReporterSection } from "@/components/account/ReporterSection";
import { getMyReporterStatus, getMyNewsSubmissions, getSuggestedClaimMatch, getPendingAdminLinkSuggestion } from "@/app/account/actions";
import { PlayersSection, type PendingClaimRow } from "@/components/admin/sections/PlayersSection";
import { searchPlayers } from "@/app/admin/players/actions";
import { authUsers } from "@/db/schema";
import { FinalsSection } from "@/components/admin/sections/FinalsSection";
import { listFinalsEditions } from "@/lib/finals/queries";
import { AwardsSection } from "@/components/admin/sections/AwardsSection";
import { listDiscordRoleOptions } from "@/app/admin/awards/actions";
import { listAwardPeriods } from "@/lib/awards/queries";
import { PointOfMonthSubmitForm } from "@/components/awards/PointOfMonthSubmitForm";
import { getMyPendingPointOfMonthSubmissions } from "@/app/awards/actions";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import { ClaimSuggestion } from "@/components/account/ClaimSuggestion";
import { SignInButton } from "@/components/account/SignInButton";
import { MatchLogUploadPrompt } from "@/components/account/MatchLogUploadPrompt";
import { PlayerProfileForm } from "@/components/account/PlayerProfileForm";
import { PlayerOverviewCard } from "@/components/account/PlayerOverviewCard";
import { BuildSection, type BuildListEntry } from "@/components/account/BuildSection";
import { MyStatsCard } from "@/components/account/MyStatsCard";
import { SectionShell, type ShellSection } from "@/components/layout/SectionShell";
import { getPlayerOverview } from "@/lib/playerOverview";
import { getMyRecentStats } from "@/lib/statsQueries";
import { ACCELERATION_TRAITS, ALL_STAT_KEYS, ARCHETYPES, type AccelerationTrait, type Archetype, type StatKey } from "@/lib/buildStats";

function isAccelerationTrait(v: string | null): v is AccelerationTrait {
  return v !== null && (ACCELERATION_TRAITS as readonly string[]).includes(v);
}

function isArchetype(v: string | null): v is Archetype {
  return v !== null && (ARCHETYPES as readonly string[]).includes(v);
}

function isStatKey(v: string): v is StatKey {
  return (ALL_STAT_KEYS as readonly string[]).includes(v);
}

const NAV_ICON_CLASS = "h-3.5 w-3.5 shrink-0";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <PageMasthead eyebrow="XKT Tour" title="Sign in" subtitle="Sign in with Discord to claim your player profile." />
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <SignInButton />
          <p className="text-muted-label mt-6 text-xs">
            New here?{" "}
            <Link href="/welcome" className="text-blue-500 hover:underline">
              See how it works
            </Link>
          </p>
        </div>
      </>
    );
  }

  const admin = await isAdmin(user);
  const playerId = await getLinkedPlayerId(user.id);

  // Reportero: independiente de tener jugador vinculado o no (ser reportero no exige
  // jugar el tour) — se calcula para CUALQUIER cuenta logueada, no solo dentro de las
  // ramas de abajo que sí dependen de `playerId`. `newsFormOptions` se pedía antes
  // solo dentro del bloque de admin; ahora hace falta también aquí fuera para el
  // formulario del reportero, así que se sube una vez y se reusa en los dos sitios.
  const [reporterStatus, newsFormOptions] = await Promise.all([getMyReporterStatus(), getNewsFormOptions()]);
  const mySubmissions = reporterStatus.isReporter ? await getMyNewsSubmissions() : [];
  const reporterSection: ShellSection = {
    id: "reporter",
    label: "Reporter",
    icon: <PenSquare className={NAV_ICON_CLASS} aria-hidden="true" />,
    content: <ReporterSection status={reporterStatus} submissions={mySubmissions} players={newsFormOptions.players} editions={newsFormOptions.editions} />,
  };

  // Sub-secciones del panel de admin — pedido explícito del propietario: viven como
  // pestañas más de la misma lista de /account (Profile, Overview, Build, ...), no
  // agrupadas detrás de una pestaña "Admin" propia que abra un segundo nivel de
  // navegación. Se calcula independientemente de si esta cuenta tiene un jugador
  // vinculado o no: un admin sin perfil reclamado todavía (ver más abajo) sigue
  // necesitando entrar al panel. Las consultas de datos de admin solo se hacen si
  // `admin` es true, para no gastarlas en cada visita de un jugador normal.
  let adminSections: ShellSection[] = [];
  if (admin) {
    const [newsRows, allPlayerRows, pendingClaims, pendingReporterRequests, currentReporters, finalsEditionRows, allPlayerOptions, awardPeriodRows, discordRoleOptions, recentComments, recentTopics, recentTopicComments] = await Promise.all([
      getNewsListRows(),
      searchPlayers(""),
      db
        .select({
          claimId: playerClaimRequests.id,
          requestedAt: playerClaimRequests.requestedAt,
          playerId: players.id,
          playerDisplayName: players.displayName,
          userName: authUsers.name,
          userImage: authUsers.image,
        })
        .from(playerClaimRequests)
        .innerJoin(players, eq(players.id, playerClaimRequests.playerId))
        .innerJoin(authUsers, eq(authUsers.id, playerClaimRequests.userId))
        .where(eq(playerClaimRequests.status, "pending"))
        .orderBy(playerClaimRequests.requestedAt),
      db
        .select({
          requestId: newsReporterRequests.id,
          requestedAt: newsReporterRequests.requestedAt,
          userName: authUsers.name,
          userImage: authUsers.image,
        })
        .from(newsReporterRequests)
        .innerJoin(authUsers, eq(authUsers.id, newsReporterRequests.userId))
        .where(eq(newsReporterRequests.status, "pending"))
        .orderBy(newsReporterRequests.requestedAt),
      db
        .select({ userId: authUsers.id, userName: authUsers.name, userImage: authUsers.image })
        .from(authUsers)
        .where(eq(authUsers.isReporter, true))
        .orderBy(authUsers.name),
      listFinalsEditions(),
      db.select({ id: players.id, displayName: players.displayName }).from(players),
      listAwardPeriods(),
      listDiscordRoleOptions(),
      getRecentCommentsForModeration(),
      getRecentTopicsForModeration(),
      getRecentTopicCommentsForModeration(),
    ]);
    const claimRows: PendingClaimRow[] = pendingClaims;
    const reporterRequestRows: PendingReporterRequestRow[] = pendingReporterRequests;
    const reporterRows: ReporterRow[] = currentReporters;
    adminSections = [
      {
        id: "news",
        label: "News",
        groupLabel: "Admin",
        icon: <Newspaper className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: (
          <NewsSection
            rows={newsRows}
            players={newsFormOptions.players}
            editions={newsFormOptions.editions}
            pendingReporterRequests={reporterRequestRows}
            reporters={reporterRows}
          />
        ),
      },
      { id: "tournaments", label: "Tournaments", icon: <Trophy className={NAV_ICON_CLASS} aria-hidden="true" />, content: <TournamentsSection /> },
      { id: "rankings", label: "Rankings", icon: <ListOrdered className={NAV_ICON_CLASS} aria-hidden="true" />, content: <RankingsSection /> },
      {
        id: "match-log",
        label: "Match Stats",
        icon: <Activity className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <AdminMatchLogSection />,
      },
      {
        id: "finals",
        label: "Finals",
        icon: <Award className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <FinalsSection editions={finalsEditionRows} players={allPlayerOptions} />,
      },
      {
        id: "awards",
        label: "Awards",
        icon: <Sparkles className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <AwardsSection periods={awardPeriodRows} players={allPlayerOptions} discordRoles={discordRoleOptions} />,
      },
      {
        id: "players",
        label: "Players",
        icon: <Users className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <PlayersSection initialRows={allPlayerRows} initialClaims={claimRows} />,
      },
      { id: "videos", label: "Videos", icon: <Video className={NAV_ICON_CLASS} aria-hidden="true" />, content: <VideosSection /> },
      { id: "thumbnails", label: "Thumbnails", icon: <ImageIcon className={NAV_ICON_CLASS} aria-hidden="true" />, content: <ThumbnailsSection /> },
      { id: "scores", label: "Scores", icon: <Radio className={NAV_ICON_CLASS} aria-hidden="true" />, content: <ScoresSection /> },
      {
        id: "comments",
        label: "Comments",
        icon: <MessageCircle className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <CommentsModerationSection rows={recentComments} />,
      },
      {
        id: "discussions",
        label: "Discussions",
        icon: <MessagesSquare className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <DiscussionsModerationSection topics={recentTopics} comments={recentTopicComments} />,
      },
    ];
  }

  if (playerId) {
    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (player) {
      // Sin `originalScreenshotUrl` (pase de rendimiento, 2026-09-13) — el propio
      // schema ya documenta que nunca se lee fuera del propio flujo de subida, solo
      // pesa: es el screenshot completo tal cual se subió, en base64.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { originalScreenshotUrl: _originalScreenshotUrl, ...buildColumnsWithoutScreenshot } = getTableColumns(playerBuilds);
      const [overview, builds, myStats, pendingClipSubmissions, socialStats, careerStats] = await Promise.all([
        getPlayerOverview(playerId, player.displayName),
        db.select(buildColumnsWithoutScreenshot).from(playerBuilds).where(eq(playerBuilds.playerId, playerId)),
        getMyRecentStats(playerId),
        getMyPendingPointOfMonthSubmissions(),
        getPlayerSocialStats(playerId, user.id),
        // Ranking y puntos de esta semana para la cabecera (rediseño, 2026-10-11).
        getCareerStats(playerId, new Date().getFullYear()),
      ]);

      const buildEntries: BuildListEntry[] = builds.map((build) => ({
        id: build.id,
        inUse: build.inUse,
        characterImageUrl: build.characterImageUrl,
        name: build.name,
        archetype: isArchetype(build.archetype) ? build.archetype : null,
        accelerationTrait: isAccelerationTrait(build.accelerationTrait) ? build.accelerationTrait : null,
        outfitCode: build.outfitCode,
        visibleStats: build.visibleStats.filter(isStatKey),
        isPublic: build.isPublic,
        forehandPower: build.forehandPower,
        forehandConsistency: build.forehandConsistency,
        forehandPrecision: build.forehandPrecision,
        backhandPower: build.backhandPower,
        backhandConsistency: build.backhandConsistency,
        backhandPrecision: build.backhandPrecision,
        servicePower: build.servicePower,
        serviceConsistency: build.serviceConsistency,
        servicePrecision: build.servicePrecision,
        forehandVolley: build.forehandVolley,
        backhandVolley: build.backhandVolley,
        smash: build.smash,
        netPresence: build.netPresence,
        focus: build.focus,
        counter: build.counter,
        lob: build.lob,
        dropShot: build.dropShot,
        topSpin: build.topSpin,
        speed: build.speed,
        stamina: build.stamina,
        muscleTone: build.muscleTone,
      }));

      const sections: ShellSection[] = [
        {
          id: "overview",
          label: "Overview",
          groupLabel: "My account",
          icon: <LayoutDashboard className={NAV_ICON_CLASS} aria-hidden="true" />,
          content: (
            <div className="flex flex-col gap-8">
              <PlayerOverviewCard overview={overview} />
              <div>
                <h2 className="text-headline mb-4 text-lg text-ink">My Stats</h2>
                <MyStatsCard stats={myStats} />
              </div>
              <div>
                <h2 className="text-headline mb-4 text-lg text-ink">Match Log</h2>
                <MatchLogUploadPrompt />
              </div>
            </div>
          ),
        },
        {
          id: "profile",
          label: "Profile",
          icon: <User className={NAV_ICON_CLASS} aria-hidden="true" />,
          content: (
            // Dos tarjetas (rediseño, 2026-10-11): foto y datos públicos, cada una con su
            // título — antes un formulario largo suelto bajo el avatar.
            <div className="flex flex-col gap-6">
              <section className="rounded-lg border border-rule bg-paper p-5 sm:p-6">
                <h3 className="text-headline mb-1 text-base text-ink">Photo</h3>
                <p className="text-muted-label mb-5 text-sm">Shown on your tour profile, the rankings and the sidebar.</p>
                <AvatarUpload currentAvatarUrl={player.avatarUrl} isCustom={player.avatarIsCustom} discordAvatarUrl={user.image} />
              </section>
              <section className="rounded-lg border border-rule bg-paper p-5 sm:p-6">
                <h3 className="text-headline mb-1 text-base text-ink">Public details</h3>
                <p className="text-muted-label mb-5 text-sm">Everything here appears on your tour profile.</p>
                <PlayerProfileForm player={player} />
              </section>
            </div>
          ),
        },
        {
          id: "build",
          label: "Build",
          icon: <Wrench className={NAV_ICON_CLASS} aria-hidden="true" />,
          content: <BuildSection builds={buildEntries} />,
        },
        {
          id: "point-of-month",
          label: "Point of the Month",
          icon: <Star className={NAV_ICON_CLASS} aria-hidden="true" />,
          content: <PointOfMonthSubmitForm initialPending={pendingClipSubmissions} />,
        },
        reporterSection,
      ];
      sections.push(...adminSections);

      return (
        <>
          <AccountHeader
            greeting={`Welcome back, ${player.displayName}`}
            displayName={player.displayName}
            country={player.countryOverride ?? player.country}
            avatarUrl={player.avatarUrl}
            playerId={playerId}
            rank={careerStats.currentRank}
            points={careerStats.currentPoints}
            followerCount={socialStats.followerCount}
            followingCount={socialStats.linked?.followingCount ?? 0}
          />
          <div className="tour-container py-8 sm:py-10">
            <SectionShell sections={sections} />
          </div>
        </>
      );
    }
  }

  const [pendingClaim] = await db
    .select({ id: playerClaimRequests.id })
    .from(playerClaimRequests)
    .where(and(eq(playerClaimRequests.userId, user.id), eq(playerClaimRequests.status, "pending")));

  if (pendingClaim) {
    return (
      <>
        <PageMasthead
          eyebrow="My Account"
          title="Request pending"
          subtitle="Your request to claim a player profile is waiting for an admin to approve it."
        />
        <div className="mx-auto max-w-md px-4 py-16">
          <MatchLogUploadPrompt />
          <h2 className="text-headline mt-10 mb-4 text-lg text-ink">Become a reporter</h2>
          {reporterSection.content}
        </div>
      </>
    );
  }

  // La propuesta de un admin (ya revisada por una persona) tiene prioridad sobre la
  // autosugerencia por nombre — si existe, ni siquiera se pide la otra.
  const pendingAdminLink = await getPendingAdminLinkSuggestion();
  const suggestedClaimMatch = pendingAdminLink ? null : await getSuggestedClaimMatch();
  const suggestion = pendingAdminLink ?? suggestedClaimMatch;
  const suggestionSource: "self" | "admin" = pendingAdminLink ? "admin" : "self";

  const [authUserRow] = await db.select({ bio: authUsers.bio }).from(authUsers).where(eq(authUsers.id, user.id));

  const claimSection: ShellSection = {
    id: "profile",
    label: "Profile",
    icon: <User className={NAV_ICON_CLASS} aria-hidden="true" />,
    content: (
      <div className="flex flex-col gap-8">
        <MemberBioForm initialBio={authUserRow?.bio ?? null} />
        <div>
          <h2 className="text-headline mb-1 text-lg text-ink">Are you on the tour?</h2>
          <p className="text-muted-label mb-6 text-sm">
            {suggestion
              ? "We think we found your profile — confirm below, or search manually if we got it wrong."
              : "Search for your name to link your account — everyone on the tour is already here, imported from the Mana Games forum. Make sure it's the name you actually play under."}
          </p>
          <ClaimSuggestion suggestion={suggestion} source={suggestionSource} />
        </div>
        <MatchLogUploadPrompt />
      </div>
    ),
  };

  // Un admin sin perfil de jugador vinculado todavía (p. ej. alguien que gestiona el
  // sitio pero no juega el tour) sigue necesitando entrar al panel — nunca debe
  // quedar atrapado en la pantalla de "reclama tu perfil" sin forma de llegar ahí.
  const memberHeader = <AccountHeader greeting={`Welcome, ${user.name ?? "there"}`} displayName={user.name ?? "Anonymous"} country={null} avatarUrl={user.image} />;
  const claimSectionFirst: ShellSection = { ...claimSection, groupLabel: "My account" };

  if (adminSections.length > 0) {
    return (
      <>
        {memberHeader}
        <div className="tour-container py-8 sm:py-10">
          <SectionShell sections={[claimSectionFirst, reporterSection, ...adminSections]} />
        </div>
      </>
    );
  }

  return (
    <>
      {memberHeader}
      <div className="tour-container py-8 sm:py-10">
        <SectionShell sections={[claimSectionFirst, reporterSection]} />
      </div>
    </>
  );
}

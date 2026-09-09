import { and, eq } from "drizzle-orm";
import Link from "next/link";
import {
  User,
  LayoutDashboard,
  Wrench,
  UserPlus,
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
  PenSquare,
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
import { TournamentsSection } from "@/components/admin/sections/TournamentsSection";
import { NewsSection, type PendingReporterRequestRow } from "@/components/admin/sections/NewsSection";
import { getNewsListRows } from "@/app/admin/actions";
import { getNewsFormOptions } from "@/lib/adminQueries";
import { ReporterSection } from "@/components/account/ReporterSection";
import { getMyReporterStatus, getMyNewsSubmissions } from "@/app/account/actions";
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
import { ClaimPlayerSearch } from "@/components/account/ClaimPlayerSearch";
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
        <PageMasthead eyebrow="XKT World Tour" title="Sign in" subtitle="Sign in with Discord to claim your player profile." />
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

  const admin = await isAdmin();
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
    const [newsRows, allPlayerRows, pendingClaims, pendingReporterRequests, finalsEditionRows, allPlayerOptions, awardPeriodRows, discordRoleOptions] = await Promise.all([
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
      listFinalsEditions(),
      db.select({ id: players.id, displayName: players.displayName }).from(players),
      listAwardPeriods(),
      listDiscordRoleOptions(),
    ]);
    const claimRows: PendingClaimRow[] = pendingClaims;
    const reporterRequestRows: PendingReporterRequestRow[] = pendingReporterRequests;
    adminSections = [
      {
        id: "news",
        label: "News",
        groupLabel: "Admin",
        icon: <Newspaper className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: <NewsSection rows={newsRows} players={newsFormOptions.players} editions={newsFormOptions.editions} pendingReporterRequests={reporterRequestRows} />,
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
      { id: "scores", label: "Scores", icon: <Radio className={NAV_ICON_CLASS} aria-hidden="true" />, content: <ScoresSection /> },
    ];
  }

  if (playerId) {
    const [player] = await db.select().from(players).where(eq(players.id, playerId));
    if (player) {
      const [overview, builds, myStats, pendingClipSubmissions] = await Promise.all([
        getPlayerOverview(playerId, player.displayName),
        db.select().from(playerBuilds).where(eq(playerBuilds.playerId, playerId)),
        getMyRecentStats(playerId),
        getMyPendingPointOfMonthSubmissions(),
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
          id: "profile",
          label: "Profile",
          icon: <User className={NAV_ICON_CLASS} aria-hidden="true" />,
          content: (
            <div className="flex flex-col gap-8">
              <AvatarUpload currentAvatarUrl={player.avatarUrl} isCustom={player.avatarIsCustom} discordAvatarUrl={user.image} />
              <PlayerProfileForm player={player} />
            </div>
          ),
        },
        {
          id: "overview",
          label: "Overview",
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
          <PageMasthead eyebrow="My Account" title={`Welcome back, ${player.displayName}`}>
            <Link
              href={`/players/${playerId}`}
              className="text-eyebrow shrink-0 rounded-full border border-white/30 px-4 py-1.5 text-xs text-white transition-colors hover:border-accent-500 hover:text-accent-500"
            >
              View Tour Profile
            </Link>
          </PageMasthead>
          <div className="mx-auto max-w-4xl px-4 py-10">
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

  const claimSection: ShellSection = {
    id: "claim",
    label: "Claim your profile",
    icon: <UserPlus className={NAV_ICON_CLASS} aria-hidden="true" />,
    content: (
      <div>
        <p className="text-muted-label mb-6 text-sm">
          Search for your name to link your account — everyone on the tour is already here, imported from the
          Mana Games forum. An admin approves the link, so make sure you search for the name you actually play
          under.
        </p>
        <ClaimPlayerSearch />
        <div className="mt-8">
          <MatchLogUploadPrompt />
        </div>
      </div>
    ),
  };

  // Un admin sin perfil de jugador vinculado todavía (p. ej. alguien que gestiona el
  // sitio pero no juega el tour) sigue necesitando entrar al panel — nunca debe
  // quedar atrapado en la pantalla de "reclama tu perfil" sin forma de llegar ahí.
  if (adminSections.length > 0) {
    return (
      <>
        <PageMasthead eyebrow="My Account" title={`Welcome, ${user.name ?? "there"}`} />
        <div className="mx-auto max-w-4xl px-4 py-10">
          <SectionShell sections={[claimSection, reporterSection, ...adminSections]} />
        </div>
      </>
    );
  }

  return (
    <>
      <PageMasthead eyebrow="My Account" title={`Welcome, ${user.name ?? "there"}`} />
      <div className="mx-auto max-w-4xl px-4 py-10">
        <SectionShell sections={[claimSection, reporterSection]} />
      </div>
    </>
  );
}

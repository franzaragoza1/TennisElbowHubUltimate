import { and, eq, getTableColumns } from "drizzle-orm";
import Link from "next/link";
import {
  User,
  LayoutDashboard,
  Wrench,
  Star,
  PenSquare,
  Gauge,
} from "lucide-react";
import { db } from "@/db/client";
import { players, playerClaimRequests, playerBuilds } from "@/db/schema";
import { getCurrentUser, getLinkedPlayerId } from "@/lib/auth";
import { isAdmin } from "@/lib/adminSession";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { AccountHeader } from "@/components/account/AccountHeader";
import { getCareerStats } from "@/lib/h2hStats";
import { getPlayerSocialStats } from "@/lib/playerSocialStats";
import { MemberBioForm } from "@/components/account/MemberBioForm";
import { getNewsFormOptions } from "@/lib/adminQueries";
import { ReporterSection } from "@/components/account/ReporterSection";
import { getMyReporterStatus, getMyNewsSubmissions, getSuggestedClaimMatch, getPendingAdminLinkSuggestion } from "@/app/account/actions";
import { authUsers } from "@/db/schema";
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

  // El panel de admin vive en /admin desde el 2026-10-17 (rediseño: cada sección su propia
  // página, ver app/admin/layout.tsx). Aquí queda solo la entrada que lleva allí — antes eran
  // 13 pestañas que cargaban los datos de todas en cada visita a /account.
  let adminSections: ShellSection[] = [];
  if (admin) {
    adminSections = [
      {
        id: "admin",
        label: "Admin panel",
        groupLabel: "Admin",
        icon: <Gauge className={NAV_ICON_CLASS} aria-hidden="true" />,
        content: (
          <div className="rounded-lg border border-rule bg-paper p-6">
            <p className="text-sm text-ink">The admin panel has its own page now: an overview of the scraper and the data, and one page per section.</p>
            <Link
              href="/admin"
              className="text-eyebrow mt-4 inline-flex rounded-full bg-accent-500 px-4 py-2 text-xs text-navy-900 transition hover:brightness-95"
            >
              Open the admin panel →
            </Link>
          </div>
        ),
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

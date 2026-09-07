import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { SignInButton } from "@/components/account/SignInButton";
import { CourtBackdrop } from "@/components/layout/CourtBackdrop";

export const dynamic = "force-dynamic";

function StepChip({ n }: { n: number }) {
  return (
    <span className="text-headline flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 text-lg text-blue-500">
      {n}
    </span>
  );
}

/** Solo una ruta interna de verdad — nunca `//host` ni una URL absoluta, o `next`
 * (viene de la query, la controla quien pega el enlace) se podría usar para mandar a
 * alguien fuera del sitio después de "saltar" o de iniciar sesión. */
function safeNextPath(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

/**
 * Puerta de entrada para gente nueva — explica las tres piezas del flujo de cuenta
 * (app/account/page.tsx, que ya las tiene todas construidas y funcionando) antes de
 * que nadie tenga que averiguarlo solo. No duplica ningún formulario real: cada
 * ilustración es una versión estática/animada de la pantalla real, y el único botón que
 * hace algo de verdad es el de cerrar, que lleva a /account (o de vuelta a `next`, la
 * página que de verdad se pedía antes de que `proxy.ts` redirigiera aquí en la
 * primera visita). Pública a propósito — hay que poder verla sin sesión todavía.
 */
export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const next = safeNextPath(params.next);
  const skipHref = next ?? "/";

  return (
    <div>
      <section className="relative overflow-hidden bg-navy-900">
        <CourtBackdrop />
        <div className="tour-container tour-container--reading relative py-20 text-center sm:py-28">
          <div className="row-reveal flex justify-end" style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>
            <Link href={skipHref} className="text-eyebrow text-xs text-white/40 hover:text-white/70">
              Skip for now →
            </Link>
          </div>
          <p className="text-eyebrow row-reveal mt-6 text-xs text-accent-500" style={{ "--reveal-delay": "0ms" } as React.CSSProperties}>
            Welcome to the tour
          </p>
          <h1
            className="text-headline row-reveal mt-3 text-4xl text-white sm:text-5xl"
            style={{ "--reveal-delay": "60ms" } as React.CSSProperties}
          >
            Get your profile live in three steps
          </h1>
          <p
            className="row-reveal mx-auto mt-5 max-w-md text-sm text-white/70 sm:text-base"
            style={{ "--reveal-delay": "120ms" } as React.CSSProperties}
          >
            Sign in, put a name to your matches, and attach your real stats — the last
            one you can even do later, whenever you like.
          </p>
        </div>
      </section>

      <section className="tour-container tour-container--reading flex flex-col gap-16 py-16 sm:gap-20 sm:py-24">
        {/* Step 1 — sign in */}
        <div className="step-reveal flex flex-col gap-5 sm:flex-row sm:gap-8">
          <StepChip n={1} />
          <div className="min-w-0 flex-1">
            <h2 className="text-headline text-xl text-ink sm:text-2xl">Sign in with Discord</h2>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              Every profile on the tour is tied to a real Discord account — it&apos;s how we
              know a claim or an upload is really coming from you.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-rule bg-navy-900 px-4 py-3">
              <span className="text-eyebrow text-xs text-white/50">Top-right corner, any page</span>
              <span className="text-eyebrow rounded-full bg-navy-800 px-4 py-2 text-[11px] text-white">Sign in with Discord</span>
            </div>
          </div>
        </div>

        {/* Step 2 — claim your name */}
        <div className="step-reveal flex flex-col gap-5 sm:flex-row sm:gap-8">
          <StepChip n={2} />
          <div className="min-w-0 flex-1">
            <h2 className="text-headline text-xl text-ink sm:text-2xl">Find your name on the tour</h2>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              The tour itself runs on the Mana Games forum, not here — everyone who plays is already imported
              into the site under the name they use there. This site can&apos;t create a player for you; it can
              only link your Discord account to the name you already play under.
            </p>
            <div className="mt-4 flex gap-3 rounded-lg border border-rule bg-paper p-4">
              <span className="text-eyebrow flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[11px] text-white">
                →
              </span>
              <span className="text-sm text-ink">
                Search for your in-game name and tap <span className="text-blue-500">This is me</span>. An
                admin double-checks and approves the link — usually quick, but it&apos;s a manual review, not
                instant.
              </span>
            </div>
            <p className="text-muted-label mt-3 text-xs leading-relaxed">
              Never played a tour match yet? Register and play on the Mana Games forum first — once you show up
              in a tournament there, you&apos;ll have a name to claim here.
            </p>
          </div>
        </div>

        {/* Step 3 — match log upload */}
        <div className="step-reveal flex flex-col gap-5 sm:flex-row sm:gap-8">
          <StepChip n={3} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="text-headline text-xl text-ink sm:text-2xl">Attach your real match stats</h2>
              <span className="text-eyebrow rounded-full bg-paper-tint px-2.5 py-1 text-[10px] text-muted-label">
                Optional · anytime
              </span>
            </div>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              Tennis Elbow 4 writes a detailed stat sheet — aces, serve %, winners — for every match you play,
              saved locally as:
            </p>
            <p className="tour-numeric mt-2 rounded-md border border-rule bg-paper-tint px-3 py-2 text-xs break-all text-ink">
              Tennis Elbow 4 / Profiles / &lt;your profile&gt; / MatchLog - &lt;profile&gt;.NNN.html
            </p>
            <p className="text-muted-label mt-3 text-sm leading-relaxed">
              Drop one or several onto the upload box on your account page. We match your online games against
              tour results that are already recorded — anything that doesn&apos;t match is safely skipped,
              never guessed.
            </p>
            <div className="mt-4 rounded-lg border border-rule bg-paper p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-label">3 matches linked to the tour</span>
                <span className="text-up text-eyebrow">1 skipped</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
                <div className="bar-grow h-full rounded-full bg-blue-500" style={{ "--bar-pct": "75%" } as React.CSSProperties} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tour-container tour-container--reading pb-16 sm:pb-24">
        <p className="text-eyebrow text-xs text-blue-500">Once you&apos;re set up</p>
        <h2 className="text-headline mt-2 text-2xl text-ink sm:text-3xl">Your account page has more waiting for you</h2>
        <p className="text-muted-label mt-3 max-w-xl text-sm leading-relaxed">
          The three steps above get your profile live — everything below is on your account page whenever you
          want it, and none of it is required.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="step-reveal rounded-lg border border-rule bg-paper p-5">
            <h3 className="text-headline text-base text-ink">Profile</h3>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              Add a bio, real name, playstyle, clothing/racket brand, and your Instagram or YouTube — all
              optional, shown on your public profile only if you fill them in.
            </p>
          </div>

          <div className="step-reveal rounded-lg border border-rule bg-paper p-5">
            <h3 className="text-headline text-base text-ink">Overview &amp; My Stats</h3>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              A private &quot;how you&apos;re doing&quot; summary with a couple of AI-written tips, plus your
              real serve/return numbers from the last 90 days — visible only to you, never on your public page.
            </p>
          </div>

          <div className="step-reveal rounded-lg border border-rule bg-paper p-5">
            <h3 className="text-headline text-base text-ink">Build sheet</h3>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              Save up to 3 named in-game Builds — upload a Character Sheet screenshot and the stats read
              themselves in, or type them by hand. Pick one as &quot;in use&quot; to show on your public profile.
            </p>
          </div>

          <div className="step-reveal rounded-lg border border-rule bg-paper p-5">
            <h3 className="text-headline text-base text-ink">Match Log, anytime</h3>
            <p className="text-muted-label mt-2 text-sm leading-relaxed">
              Come back and drop in more MatchLog files whenever you like — every upload adds to the same
              stats behind My Stats and your public match history.
            </p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-900 py-16 text-center sm:py-20">
        <CourtBackdrop />
        <div className="tour-container tour-container--reading relative">
          <h2 className="text-headline text-2xl text-white sm:text-3xl">Three steps, and you&apos;re on the tour</h2>
          <p className="mt-3 text-sm text-white/70">Sign in, put a name to your matches, and your stats can start speaking for themselves.</p>
          <div className="tap-scale mt-7 inline-block">
            {user ? (
              <Link
                href={next ?? "/account"}
                className="text-eyebrow rounded-full bg-accent-500 px-6 py-3 text-xs text-navy-900 hover:opacity-90"
              >
                {next ? "Continue →" : "Go to your account →"}
              </Link>
            ) : (
              <SignInButton callbackUrl={next ?? "/account"} />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

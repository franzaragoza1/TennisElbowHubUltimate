"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestNewsReporter, type ReporterStatus, type MyNewsSubmission } from "@/app/account/actions";
import type { TagOption, EditionOption } from "@/components/admin/NewsForm";
import { ReporterStoryForm } from "./ReporterStoryForm";

const STATUS_LABEL: Record<string, string> = { draft: "In review", published: "Published" };

/**
 * Tres estados posibles, pedido explícito del propietario ("users should be able, in
 * the news section to ask to become news reporters, and admins will approve"):
 * todavía no es reportero (botón de pedir, o aviso de pendiente si ya lo pidió), o ya
 * aprobado (formulario para escribir + lista de lo ya enviado). Disponible para
 * CUALQUIER cuenta logueada, tenga o no jugador vinculado — ser reportero no depende
 * de jugar el tour.
 */
export function ReporterSection({
  status,
  submissions,
  players,
  editions,
}: {
  status: ReporterStatus;
  submissions: MyNewsSubmission[];
  players: TagOption[];
  editions: EditionOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRequest() {
    startTransition(async () => {
      await requestNewsReporter();
      router.refresh();
    });
  }

  if (!status.isReporter) {
    return (
      <div>
        <p className="text-muted-label mb-6 text-sm">
          Reporters can write their own stories for the News section — every submission is reviewed by an admin
          before it goes live, same as any other draft.
        </p>
        {status.pendingRequest ? (
          <p className="rounded-lg border border-rule bg-paper px-4 py-3 text-sm text-ink">Your request is waiting for an admin to review it.</p>
        ) : (
          <div>
            {status.wasRejected && <p className="text-muted-label mb-3 text-xs">Your previous request wasn&rsquo;t approved — you can try again.</p>}
            <button
              type="button"
              onClick={handleRequest}
              disabled={isPending}
              className="text-eyebrow rounded-full bg-navy-900 px-6 py-2.5 text-xs text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {isPending ? "Requesting…" : "Request to become a reporter"}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ReporterStoryForm players={players} editions={editions} onSubmitted={() => router.refresh()} />

      {submissions.length > 0 && (
        <div>
          <h2 className="text-headline mb-3 text-lg text-ink">My submissions</h2>
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {submissions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                <span
                  className={`text-eyebrow shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                    s.status === "published" ? "bg-up/10 text-up" : "bg-muted-label/10 text-muted-label"
                  }`}
                >
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
                <p className="text-ink min-w-0 flex-1 truncate">{s.title}</p>
                <p className="text-muted-label shrink-0 text-xs">{s.createdAt.toLocaleDateString("en-US")}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

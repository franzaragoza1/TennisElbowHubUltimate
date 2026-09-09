"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteNews, getNewsForEdit, type NewsListRow } from "@/app/admin/actions";
import { approveReporterRequest, rejectReporterRequest } from "@/app/admin/news/reporters/actions";
import { NewsForm, type NewsFormValues, type TagOption, type EditionOption } from "@/components/admin/NewsForm";
import { GenerateNewsPanel } from "@/components/admin/news/GenerateNewsPanel";

export interface PendingReporterRequestRow {
  requestId: number;
  requestedAt: Date;
  userName: string | null;
  userImage: string | null;
}

const EMPTY_VALUES: NewsFormValues = {
  id: null,
  title: "",
  excerpt: "",
  body: "",
  author: "",
  category: "REPORT",
  imageUrl: "",
  editionId: null,
  published: false,
  playerIds: [],
};

type View = { mode: "list" } | { mode: "generate" } | { mode: "new" } | { mode: "edit"; id: number };

/**
 * Antes tres rutas (app/admin/(panel)/page.tsx, .../news/new, .../news/[id]) más
 * app/admin/(panel)/news/generate/page.tsx — absorbidas en una sola sección de
 * /account con estado de vista en el cliente (pedido explícito del propietario).
 * `rows` llega como prop del servidor y NUNCA se copia a estado local: tras cada
 * mutación se llama a `router.refresh()`, que vuelve a ejecutar
 * app/account/page.tsx y manda esta misma prop actualizada — copiarla a `useState`
 * congelaría la lista en lo que había al montar.
 */
export function NewsSection({
  rows,
  players,
  editions,
  pendingReporterRequests,
}: {
  rows: NewsListRow[];
  players: TagOption[];
  editions: EditionOption[];
  pendingReporterRequests: PendingReporterRequestRow[];
}) {
  const [view, setView] = useState<View>({ mode: "list" });
  const [editValues, setEditValues] = useState<NewsFormValues | null>(null);
  const [isLoadingEdit, startLoadingEdit] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (view.mode !== "edit") {
      // Sincroniza con el cambio de vista, no con un dato derivable en el render —
      // sin esto, volver a abrir OTRA edición más rápido de lo que tarda el fetch
      // anterior podría dejar ver un instante los datos de la edición previa.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditValues(null);
      return;
    }
    startLoadingEdit(async () => {
      const values = await getNewsForEdit(view.id);
      setEditValues(values);
    });
  }, [view]);

  function handleSaved() {
    setView({ mode: "list" });
    router.refresh();
  }

  function handleDelete(id: number) {
    if (!window.confirm("Delete this story? This can't be undone.")) return;
    startDeleting(async () => {
      await deleteNews(id);
      router.refresh();
    });
  }

  if (view.mode === "new" || view.mode === "edit") {
    const values = view.mode === "new" ? EMPTY_VALUES : editValues;
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-headline text-2xl text-ink">{view.mode === "new" ? "New story" : "Edit story"}</h1>
          <button type="button" onClick={() => setView({ mode: "list" })} className="text-eyebrow text-xs text-muted-label hover:text-ink">
            ← Back to list
          </button>
        </div>
        {values ? (
          <NewsForm key={values.id ?? "new"} values={values} players={players} editions={editions} onSaved={handleSaved} />
        ) : (
          <p className="text-muted-label text-sm">{isLoadingEdit ? "Loading…" : "Story not found."}</p>
        )}
      </div>
    );
  }

  if (view.mode === "generate") {
    return (
      <div>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-headline text-2xl text-ink">Generate AI drafts</h1>
          <button type="button" onClick={() => setView({ mode: "list" })} className="text-eyebrow text-xs text-muted-label hover:text-ink">
            ← Back to list
          </button>
        </div>
        <GenerateNewsPanel
          onReviewDrafts={() => {
            setView({ mode: "list" });
            router.refresh();
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-headline text-2xl text-ink">News</h1>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setView({ mode: "generate" })}
            className="text-eyebrow rounded-full border border-rule px-5 py-2.5 text-xs text-ink hover:border-blue-500 hover:text-blue-500"
          >
            Generate AI drafts
          </button>
          <button
            type="button"
            onClick={() => setView({ mode: "new" })}
            className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800"
          >
            New story
          </button>
        </div>
      </div>

      {pendingReporterRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-headline mb-3 text-lg text-ink">Pending reporter requests</h2>
          <div className="overflow-hidden rounded-lg border border-rule bg-paper">
            {pendingReporterRequests.map((row) => (
              <div key={row.requestId} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3 text-sm last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- avatar remoto de Discord */}
                  {row.userImage && <img src={row.userImage} alt="" className="h-8 w-8 shrink-0 rounded-full" />}
                  <div className="min-w-0">
                    <p className="text-ink truncate">{row.userName ?? "Unknown Discord user"}</p>
                    <p className="text-muted-label text-xs">Requested {row.requestedAt.toLocaleDateString("en-US")}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-3">
                  <form action={approveReporterRequest}>
                    <input type="hidden" name="requestId" value={row.requestId} />
                    <button type="submit" className="text-eyebrow text-xs text-up hover:underline">
                      Approve
                    </button>
                  </form>
                  <form action={rejectReporterRequest}>
                    <input type="hidden" name="requestId" value={row.requestId} />
                    <button type="submit" className="text-eyebrow text-xs text-down hover:underline">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {rows.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">
          No stories yet. Write the first one.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-0">
              <span
                className={`text-eyebrow shrink-0 rounded-full px-2.5 py-1 text-[10px] ${
                  r.status === "published" ? "bg-up/10 text-up" : "bg-muted-label/10 text-muted-label"
                }`}
              >
                {r.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-headline truncate text-ink">{r.title}</p>
                <p className="text-muted-label truncate text-xs">
                  {r.category} · {r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : "—"}
                  {r.submittedByName && <> · Submitted by {r.submittedByName}</>}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setView({ mode: "edit", id: r.id })}
                className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                disabled={isDeleting}
                className="text-eyebrow shrink-0 text-xs text-down hover:underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

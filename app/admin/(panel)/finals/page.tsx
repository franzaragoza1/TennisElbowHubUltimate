import Link from "next/link";
import { listFinalsEditions } from "@/lib/finals/queries";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  setup: "Setting up",
  groups: "Group stage",
  knockout: "Knockout stage",
  completed: "Completed",
};

export default async function AdminFinalsListPage() {
  const editions = await listFinalsEditions();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-headline text-2xl text-ink">Tour Finals</h1>
        <Link href="/admin/finals/new" className="text-eyebrow rounded-full bg-navy-900 px-5 py-2.5 text-xs text-white hover:bg-navy-800">
          New edition
        </Link>
      </div>

      {editions.length === 0 ? (
        <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center">No Finals editions yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-rule bg-paper">
          {editions.map((e) => (
            <div key={e.id} className="flex items-center gap-4 border-b border-rule px-4 py-3 last:border-0">
              <span className="text-eyebrow shrink-0 rounded-full bg-muted-label/10 px-2.5 py-1 text-[10px] text-muted-label">
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-headline truncate text-ink">{e.displayName}</p>
                <p className="text-muted-label truncate text-xs">
                  {e.kind === "tour_finals" ? "World Tour Finals" : "Next Gen Finals"} · {e.year}
                </p>
              </div>
              <Link href={`/admin/finals/${e.id}`} className="text-eyebrow shrink-0 text-xs text-blue-500 hover:underline">
                Manage
              </Link>
              <Link href={`/finals/${e.id}`} className="text-eyebrow shrink-0 text-xs text-muted-label hover:underline">
                View
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { PageMasthead } from "@/components/layout/PageMasthead";
import { Sidebar } from "@/components/layout/Sidebar";
import { FinalsEditionCard } from "@/components/finals/FinalsEditionCard";
import { listFinalsEditions } from "@/lib/finals/queries";

export const revalidate = 3600;

export default async function FinalsIndexPage() {
  const editions = await listFinalsEditions();

  return (
    <div>
      <PageMasthead eyebrow="Tennis Elbow 4 Online Tour" title="Tour Finals" subtitle="World Tour Finals & Next Gen Finals" />

      <div className="tour-container py-8 lg:grid lg:grid-cols-[1fr_320px] lg:items-start lg:gap-8">
        <div className="min-w-0">
          {editions.length === 0 ? (
            <p className="text-muted-label">No Finals editions yet.</p>
          ) : (
            <div className="flex flex-wrap items-start gap-4">
              {editions.map((e) => (
                <FinalsEditionCard key={e.id} data={e} />
              ))}
            </div>
          )}
        </div>
        <Sidebar />
      </div>
    </div>
  );
}

import { NewsForm } from "@/components/admin/NewsForm";
import { getNewsFormOptions } from "@/lib/adminQueries";

export const dynamic = "force-dynamic";

export default async function NewNewsPage() {
  const { players, editions } = await getNewsFormOptions();

  return (
    <div>
      <h1 className="text-headline mb-6 text-2xl text-navy-900">New story</h1>
      <NewsForm
        players={players}
        editions={editions}
        values={{
          id: null,
          title: "",
          excerpt: "",
          body: "",
          category: "REPORT",
          imageUrl: "",
          editionId: null,
          published: false,
          playerIds: [],
        }}
      />
    </div>
  );
}

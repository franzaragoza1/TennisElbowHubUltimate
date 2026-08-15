import { db } from "@/db/client";
import { players } from "@/db/schema";
import { NewFinalsEditionForm } from "@/components/admin/finals/NewFinalsEditionForm";

export const dynamic = "force-dynamic";

export default async function NewFinalsEditionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const playerRows = await db.select({ id: players.id, displayName: players.displayName }).from(players);

  return (
    <div>
      <h1 className="text-headline mb-6 text-2xl text-ink">New Finals edition</h1>
      {error && (
        <p className="mb-4 rounded-lg border border-down/30 bg-down/10 px-4 py-2 text-sm text-down">
          {error === "need-eight-distinct-players" ? "Pick exactly 8 distinct players." : "Fill in every field."}
        </p>
      )}
      <NewFinalsEditionForm players={playerRows} />
    </div>
  );
}

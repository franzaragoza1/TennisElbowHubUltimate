import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { authUsers, newsReporterRequests } from "@/db/schema";
import { NewsSection } from "@/components/admin/sections/NewsSection";
import { getNewsListRows } from "@/app/admin/actions";
import { getNewsFormOptions } from "@/lib/adminQueries";

export default async function AdminNewsPage() {
  const [rows, options, pendingReporterRequests, reporters] = await Promise.all([
    getNewsListRows(),
    getNewsFormOptions(),
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
  ]);
  return (
    <NewsSection
      rows={rows}
      players={options.players}
      editions={options.editions}
      pendingReporterRequests={pendingReporterRequests}
      reporters={reporters}
    />
  );
}

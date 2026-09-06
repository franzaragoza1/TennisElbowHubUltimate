import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { matchLogFiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUploadOverdue } from "@/lib/matchLog/uploadReminder";

/** Mismo patrón que app/api/admin-session/route.ts, sondeado desde SiteNav para la
 * insignia de recordatorio — pero por usuario (`uploadedByUserId`), no un booleano global. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, overdue: false, lastUploadedAt: null });
  }

  const [last] = await db
    .select({ uploadedAt: matchLogFiles.uploadedAt })
    .from(matchLogFiles)
    .where(eq(matchLogFiles.uploadedByUserId, user.id))
    .orderBy(desc(matchLogFiles.uploadedAt))
    .limit(1);

  const lastUploadedAt = last?.uploadedAt ?? null;
  return NextResponse.json({
    signedIn: true,
    overdue: isUploadOverdue(lastUploadedAt),
    lastUploadedAt: lastUploadedAt ? lastUploadedAt.toISOString() : null,
  });
}

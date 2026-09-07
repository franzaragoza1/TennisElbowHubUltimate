import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { authUsers, matchLogFiles } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUploadOverdue } from "@/lib/matchLog/uploadReminder";

/** Mismo patrón que app/api/admin-session/route.ts, sondeado desde
 * MatchLogReminderToast para el aviso — pero por usuario (`uploadedByUserId`), no un
 * booleano global. Alguien que marcó "I'm not on PC, stop reminding me"
 * (`matchLogReminderOptedOut`) nunca vuelve a salir `overdue`, sea cual sea su
 * última subida — se comprueba ANTES de tocar `matchLogFiles`, para no gastar esa
 * consulta si ya se sabe que la respuesta va a ser que no. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ signedIn: false, overdue: false, lastUploadedAt: null });
  }

  const [account] = await db
    .select({ optedOut: authUsers.matchLogReminderOptedOut })
    .from(authUsers)
    .where(eq(authUsers.id, user.id))
    .limit(1);
  if (account?.optedOut) {
    return NextResponse.json({ signedIn: true, overdue: false, lastUploadedAt: null });
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

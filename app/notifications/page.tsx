import Link from "next/link";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { requireUser } from "@/lib/auth";
import { getRecentNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await getRecentNotifications(user.id, 100);

  return (
    <div>
      <PageMasthead eyebrow="XKT Tour" title="Notifications" subtitle="Replies, follows going live, and finished matches — everything the bell has shown you." />

      <div className="tour-container py-8">
        <div className="mx-auto max-w-2xl">
          {notifications.length === 0 ? (
            <p className="text-muted-label rounded-lg border border-rule bg-paper px-4 py-10 text-center text-sm">
              Nothing here yet — follow a player or tournament to start seeing activity.
            </p>
          ) : (
            <ul className="divide-rule divide-y overflow-hidden rounded-lg border border-rule bg-paper">
              {notifications.map((n) => (
                <li key={n.id}>
                  <Link href={n.href} className={`block px-4 py-3 transition-colors duration-150 hover:bg-paper-tint ${n.readAt ? "" : "bg-accent-500/5"}`}>
                    <p className="text-ink text-sm font-medium">{n.title}</p>
                    {n.body && <p className="text-muted-label mt-0.5 text-xs">{n.body}</p>}
                    <p className="text-muted-label mt-1 text-[11px]">{formatDate(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

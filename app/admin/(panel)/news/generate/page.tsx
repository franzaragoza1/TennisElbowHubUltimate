import Link from "next/link";
import { GenerateNewsPanel } from "@/components/admin/news/GenerateNewsPanel";

export const dynamic = "force-dynamic";

export default function GenerateNewsPage() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-headline text-2xl text-ink">Generate AI drafts</h1>
          <p className="text-muted-label text-xs">Champion crowned, title milestones, upsets, win streaks, ranking milestones.</p>
        </div>
        <Link href="/admin" className="text-eyebrow text-xs text-blue-500 hover:underline">
          Back to news
        </Link>
      </div>

      <GenerateNewsPanel />
    </div>
  );
}

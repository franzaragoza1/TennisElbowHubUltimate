import { CommentsModerationSection } from "@/components/admin/sections/CommentsModerationSection";
import { getRecentCommentsForModeration } from "@/lib/comments";

export default async function AdminCommentsPage() {
  return <CommentsModerationSection rows={await getRecentCommentsForModeration()} />;
}

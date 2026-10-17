import { DiscussionsModerationSection } from "@/components/admin/sections/DiscussionsModerationSection";
import { getRecentTopicsForModeration, getRecentTopicCommentsForModeration } from "@/lib/discussionTopics";

export default async function AdminDiscussionsPage() {
  const [topics, comments] = await Promise.all([getRecentTopicsForModeration(), getRecentTopicCommentsForModeration()]);
  return <DiscussionsModerationSection topics={topics} comments={comments} />;
}

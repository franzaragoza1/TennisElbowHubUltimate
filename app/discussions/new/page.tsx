import { redirect } from "next/navigation";
import { PageMasthead } from "@/components/layout/PageMasthead";
import { getCurrentUser } from "@/lib/auth";
import { NewTopicForm } from "@/components/discussions/NewTopicForm";

export default async function NewDiscussionTopicPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/account");

  return (
    <div>
      <PageMasthead eyebrow="Discussions" title="New topic" subtitle="Give it a clear title — this is what shows up in the feed." />
      <div className="tour-container tour-container--reading py-10">
        <NewTopicForm />
      </div>
    </div>
  );
}

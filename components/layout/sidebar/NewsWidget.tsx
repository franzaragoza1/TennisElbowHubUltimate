import Link from "next/link";
import { SidebarPanel } from "@/components/layout/SidebarPanel";
import { getPublishedNews } from "@/lib/newsQueries";

const MAX_SHOWN = 4;

export async function NewsWidget() {
  const stories = await getPublishedNews(MAX_SHOWN);
  if (stories.length === 0) return null;

  const [featured, ...rest] = stories;

  return (
    <SidebarPanel title="NEWS" href="/news" linkLabel="View all">
      <Link href={`/news/${featured.slug}`} className="group mb-3 block">
        {featured.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- imagen editorial por URL, sin pipeline de next/image
          <img src={featured.imageUrl} alt="" className="mb-2 aspect-video w-full rounded-md object-cover" />
        )}
        <p className="text-headline text-sm text-ink group-hover:text-blue-500">{featured.title}</p>
      </Link>
      {rest.length > 0 && (
        <ul className="space-y-2.5 border-t border-rule pt-2.5">
          {rest.map((item) => (
            <li key={item.id}>
              <Link href={`/news/${item.slug}`} className="flex items-center gap-2.5 hover:text-blue-500">
                {item.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- imagen editorial por URL
                  <img src={item.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                )}
                <span className="text-ink line-clamp-2 text-xs">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SidebarPanel>
  );
}

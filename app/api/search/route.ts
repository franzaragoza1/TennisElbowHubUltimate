import { NextResponse } from "next/server";
import { searchSite } from "@/lib/search";

const EMPTY = { players: [], tournaments: [], news: [], videos: [], matches: [] };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json(EMPTY);

  const results = await searchSite(q);
  return NextResponse.json(results);
}

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminSession";

export async function GET() {
  return NextResponse.json({ isAdmin: await isAdmin() });
}

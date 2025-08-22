import { NextResponse } from "next/server";
import { getAgent } from "@/lib/bsky";

export async function GET(req: Request) {
  const agent = await getAgent();
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const limit = Number(url.searchParams.get("limit") ?? 30);

  const { data } = await agent.getTimeline({ cursor, limit });
  return NextResponse.json(data); // includes feed items and next cursor
}

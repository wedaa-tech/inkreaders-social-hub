import { NextResponse } from "next/server";
import { getAgent } from "@/lib/bsky";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Text required" }, { status: 400 });
  }

  const agent = await getAgent();

  // Minimal app.bsky.feed.post record
  const res = await agent.post({
    text: text.trim(),
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ uri: res.uri, cid: res.cid });
}

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    // Basic validation
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ message: "Invalid email." }, { status: 400 });
    }

    // TODO: store email in DB, call an email service, etc.
    // Example: await db.subscriptions.insert({ email, createdAt: new Date() });

    return NextResponse.json({ message: `Thanks, ${email} is subscribed!` }, { status: 200 });
  } catch {
    return NextResponse.json({ message: "Bad request." }, { status: 400 });
  }
}

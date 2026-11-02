import { NextResponse } from "next/server";
import { db } from "@/lib/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for monitoring: is the app up and can it reach the database.
 * No error details leak out - those go to the logs.
 */
export async function GET() {
  try {
    await Promise.race([
      db().listCollections(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database did not respond within 4 s")), 4000)),
    ]);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Health check: database unavailable:", error);
    return NextResponse.json({ ok: false }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

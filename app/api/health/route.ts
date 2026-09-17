import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Database readiness timed out")), 2000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function GET() {
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();

  try {
    await checkDatabase();
  } catch {
    return NextResponse.json(
      { ok: false, service: "synarava-jewelry", reason: "database_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      service: "synarava-jewelry",
      revision: commitSha ? commitSha.slice(0, 7) : "local",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

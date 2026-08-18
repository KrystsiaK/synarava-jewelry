import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA?.trim();

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

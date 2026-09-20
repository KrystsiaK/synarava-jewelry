import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentAdminSession } from "@/lib/auth/admin-session";
import { applyReconcileChoice } from "@/lib/shopify/reconciliation-apply";

export const runtime = "nodejs";

const requestSchema = z.object({
  choices: z.array(z.object({
    divergenceId: z.string().trim().min(1).max(256),
    choice: z.enum(["SYNARAVA", "SHOPIFY"]),
    expectedLocalFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    expectedShopifyFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  })).min(1).max(50),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentAdminSession();
  if (!session) return NextResponse.json({ error: "Admin session required." }, { status: 401 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose between the reviewed Synarava and Shopify versions." }, { status: 400 });
  }

  const results = [];
  for (const choice of parsed.data.choices) {
    results.push(await applyReconcileChoice({ ...choice, actorUsername: session.username }));
  }
  const failed = results.filter((result) => !result.ok).length;
  return NextResponse.json({
    results,
    appliedCount: results.length - failed,
    failedCount: failed,
  }, { status: failed === results.length ? 409 : 200 });
}

import { NextResponse } from "next/server";

import {
  listAdminProductsPage,
  normalizeAdminProductSort,
  clampAdminProductPageSize,
} from "@/lib/admin/list-products";
import { getCurrentAdminSession } from "@/lib/auth/admin-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Admin session required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const filters = {
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    categoryId: url.searchParams.get("category") ?? undefined,
    collectionId: url.searchParams.get("collection") ?? undefined,
    sort: normalizeAdminProductSort(url.searchParams.get("sort")),
  };
  const cursor = url.searchParams.get("cursor");
  const limit = clampAdminProductPageSize(url.searchParams.get("limit"));

  try {
    const page = await listAdminProductsPage({
      filters,
      cursor,
      limit,
      adminUsername: session.username,
    });
    return NextResponse.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin-api/products] list failed", error);
    return NextResponse.json({ error: "Could not load products." }, { status: 500 });
  }
}

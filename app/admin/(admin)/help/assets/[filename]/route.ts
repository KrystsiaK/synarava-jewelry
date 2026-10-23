import { notFound } from "next/navigation";

import { loadHelpAsset } from "@/lib/admin/help-docs";
import { requireAdminSession } from "@/lib/auth/admin-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  await requireAdminSession(`/admin/help/assets/${encodeURIComponent(filename)}`);
  const asset = await loadHelpAsset(filename);
  if (!asset) notFound();

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Type": asset.contentType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

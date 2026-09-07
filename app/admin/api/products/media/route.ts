import { uploadProductMediaAction } from "@/app/admin/actions/products";
import { getCurrentAdminSession } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!await getCurrentAdminSession()) {
    return Response.json({ error: "Admin session required." }, { status: 401 });
  }

  try {
    const result = await uploadProductMediaAction(await request.formData());
    return Response.json(result, { status: result.error ? 400 : 200 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Gallery upload failed." },
      { status: 500 },
    );
  }
}

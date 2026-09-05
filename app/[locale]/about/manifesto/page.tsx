import { redirect } from "next/navigation";

import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

export default async function Page() {
  const locale = await getRequestLocale();
  redirect(localePath(locale, "/about"));
}

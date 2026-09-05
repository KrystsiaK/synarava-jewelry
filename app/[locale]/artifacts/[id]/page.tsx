import { permanentRedirect } from "next/navigation";

import { getRequestLocale } from "@/lib/i18n/server";
import { localePath } from "@/lib/i18n/routing";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function LegacyArtifactRedirect({ params }: Props) {
  const [{ id }, locale] = await Promise.all([params, getRequestLocale()]);
  permanentRedirect(localePath(locale, `/products/${id}`));
}

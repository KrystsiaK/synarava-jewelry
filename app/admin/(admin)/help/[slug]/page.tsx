import { notFound } from "next/navigation";

import { AdminHelpArticle } from "@/components/synarava-cms";
import { loadHelpArticle } from "@/lib/admin/help-docs";

export default async function AdminHelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await loadHelpArticle(slug);
  if (!article) notFound();
  return <AdminHelpArticle article={article} />;
}

import { AdminHelpIndex } from "@/components/synarava-cms";
import { listHelpArticles } from "@/lib/admin/help-docs";

export default async function AdminHelpPage() {
  const articles = await listHelpArticles();
  return <AdminHelpIndex articles={articles} />;
}

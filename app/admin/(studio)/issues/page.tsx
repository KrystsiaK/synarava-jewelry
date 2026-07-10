import { AdminIssuesCms } from "@/components/admin/admin-issues-cms";
import { db } from "@/lib/db";

export default async function AdminIssuesPage() {
  const issues = await db.adminIssue.findMany({
    orderBy: [
      { status: "asc" },
      { severity: "asc" },
      { updatedAt: "desc" },
    ],
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // QA ]</p>
        <h1 className="adm-page-title">Problems</h1>
        <p className="adm-page-subtitle">
          Broken media, missing taxonomy, and content records that need attention.
        </p>
      </div>

      <AdminIssuesCms issues={issues} />
    </div>
  );
}

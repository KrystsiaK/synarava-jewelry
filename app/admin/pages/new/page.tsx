import Link from "next/link";

import { PageCreateRoute } from "@/components/admin/page-route-editor";

export default function NewPagePage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // PGS // NEW ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">New page</h1>
            <p className="adm-page-subtitle">
              Create one page record. The pages table stays separate for scanning.
            </p>
          </div>
          <Link href="/admin/pages" className="adm-btn-ghost">
            Back to pages
          </Link>
        </div>
      </div>

      <PageCreateRoute />
    </div>
  );
}

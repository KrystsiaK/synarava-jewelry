import Link from "next/link";

import { CategoryEditor } from "@/components/admin/categories-cms";

export default function NewCategoryPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // CAT // NEW ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">New category</h1>
            <p className="adm-page-subtitle">
              Create one category record. Product assignment stays inside product editing.
            </p>
          </div>
          <Link href="/admin/categories" className="adm-btn-ghost">
            Back to categories
          </Link>
        </div>
      </div>

      <CategoryEditor />
    </div>
  );
}

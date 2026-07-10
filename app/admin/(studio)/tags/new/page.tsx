import Link from "next/link";

import { TagEditor } from "@/components/admin/tags-cms";

export default function NewTagPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // TAX // TAG // NEW ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">New tag</h1>
            <p className="adm-page-subtitle">
              Create one tag record. Product assignment stays inside product editing.
            </p>
          </div>
          <Link href="/admin/tags" className="adm-btn-ghost">
            Back to tags
          </Link>
        </div>
      </div>

      <TagEditor />
    </div>
  );
}

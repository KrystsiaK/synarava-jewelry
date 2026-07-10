import Link from "next/link";

import { CollectionCreateRoute } from "@/components/admin/collection-route-editor";

export default function NewCollectionPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // COL // NEW ]</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="adm-page-title">New collection</h1>
            <p className="adm-page-subtitle">
              Create one collection record. The collection table stays separate for scanning.
            </p>
          </div>
          <Link href="/admin/collections" className="adm-btn-ghost">
            Back to collections
          </Link>
        </div>
      </div>

      <CollectionCreateRoute />
    </div>
  );
}

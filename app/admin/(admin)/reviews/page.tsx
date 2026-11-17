import { ReviewsCms } from "@/components/admin/reviews/reviews-cms";
import { ReviewsSettingsEditor } from "@/components/admin/reviews/reviews-settings-editor";
import {
  parseAdminReviewsListState,
  toAdminReviewListFilters,
} from "@/lib/admin/reviews-list-state";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { listReviewProductOptions } from "@/lib/content/product-reviews";
import { listAdminProductReviews } from "@/lib/reviews/queries";
import { getProductReviewsSettings } from "@/lib/reviews/settings";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminReviewsPage({ searchParams }: Props) {
  await requireAdminSession("/admin/reviews");
  const rawParams = (await searchParams) ?? {};
  const listState = parseAdminReviewsListState(rawParams);
  const filters = toAdminReviewListFilters(listState);

  const [initialPage, products, settings] = await Promise.all([
    listAdminProductReviews(filters),
    listReviewProductOptions(),
    getProductReviewsSettings(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // REV ]</p>
        <h1 className="adm-page-title">Reviews</h1>
        <p className="adm-page-subtitle">
          Moderate local buyer reviews. Email stays private — never shown on the storefront or in
          JSON-LD.
        </p>
      </div>

      <ReviewsCms
        key={JSON.stringify(listState)}
        initialPage={initialPage}
        initialListState={listState}
        products={products}
      />

      <ReviewsSettingsEditor settings={settings} />
    </div>
  );
}

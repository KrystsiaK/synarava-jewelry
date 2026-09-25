import { ShopifyProductsCms } from "@/components/admin/products/shopify-products-cms";
import { listAdminProductsPage } from "@/lib/admin/list-products";
import { requireAdminSession } from "@/lib/auth/admin-session";

export default async function AdminShopifyProductsPage() {
  const session = await requireAdminSession("/admin/shopify-products");
  const initialPage = await listAdminProductsPage({
    filters: { sort: "updated" },
    adminUsername: session.username,
  });

  return (
    <div className="space-y-8">
      <ShopifyProductsCms initialPage={initialPage} />
    </div>
  );
}

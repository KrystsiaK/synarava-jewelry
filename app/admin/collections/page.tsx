import { CollectionsCms } from "@/components/admin/collections-cms";
import { getAdminCatalogData } from "@/lib/content/catalog";

export default async function AdminCollectionsPage() {
  const { collections } = await getAdminCatalogData();

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <p className="label-caps text-accent">Collections</p>
        <h1 className="font-serif text-[3rem] leading-none md:text-[4rem]">Collection CMS</h1>
        <p className="max-w-3xl text-lg leading-8 text-foreground/68">
          This page controls the real storefront UI for collection cards and collection detail pages:
          hero image, eyebrow, accent code, summary text, manifesto block, symbolism defaults, sorting,
          and publication state.
        </p>
      </header>
      <CollectionsCms collections={collections} />
    </div>
  );
}

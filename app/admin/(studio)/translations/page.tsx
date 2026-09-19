import { TranslationsCms, type TranslationOverviewRow } from "@/components/admin/translations/translations-cms";
import { STOREFRONT_COPY_KEY } from "@/lib/content/storefront-copy";
import { db } from "@/lib/db";

function statusOf(translation: { syncStatus: string } | undefined): TranslationOverviewRow["status"] {
  return translation ? translation.syncStatus as TranslationOverviewRow["status"] : "MISSING";
}

function eventStatus(status: string | undefined): TranslationOverviewRow["status"] {
  if (!status || status === "PENDING" || status === "PROCESSING") return "PENDING";
  if (status === "IGNORED") return "NOT_APPLICABLE";
  return status as TranslationOverviewRow["status"];
}

export default async function AdminTranslationsPage() {
  const [products, collections, pages, bindings] = await Promise.all([
    db.product.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true,
        translations: { where: { locale: "PT" }, select: { syncStatus: true, syncError: true, updatedAt: true } },
      },
    }),
    db.collection.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, name: true,
        translations: { where: { locale: "PT" }, select: { syncStatus: true, syncError: true, updatedAt: true } },
      },
    }),
    db.page.findMany({
      orderBy: { title: "asc" },
      select: {
        id: true, slug: true, title: true,
        translations: { where: { locale: "PT" }, select: { syncStatus: true, syncError: true, updatedAt: true } },
      },
    }),
    db.shopifyTranslationBinding.findMany({
      include: { syncEvents: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
  ]);
  const latestEvent = new Map(bindings.map((binding) => [binding.entityId, binding.syncEvents[0] ?? null]));
  const audit = (entityId: string) => {
    const event = latestEvent.get(entityId);
    return {
      actor: event?.actorUsername ?? null,
      direction: event?.direction ?? null,
      eventUpdatedAt: event?.updatedAt?.toISOString() ?? null,
    };
  };

  const rows: TranslationOverviewRow[] = [
    ...products.map((product) => {
      const translation = product.translations[0];
      const event = audit(product.id);
      return {
        id: `product:${product.id}`, entityType: "PRODUCT" as const, entityId: product.id,
        label: product.name, locale: "PT" as const, status: statusOf(translation),
        href: `/admin/products/${product.id}`, error: translation?.syncError ?? null,
        updatedAt: event.eventUpdatedAt ?? translation?.updatedAt.toISOString() ?? null,
        actor: event.actor, direction: event.direction,
      };
    }),
    ...collections.map((collection) => {
      const translation = collection.translations[0];
      const event = audit(collection.id);
      return {
        id: `collection:${collection.id}`, entityType: "COLLECTION" as const, entityId: collection.id,
        label: collection.name, locale: "PT" as const, status: statusOf(translation),
        href: `/admin/collections/${collection.id}`, error: translation?.syncError ?? null,
        updatedAt: event.eventUpdatedAt ?? translation?.updatedAt.toISOString() ?? null,
        actor: event.actor, direction: event.direction,
      };
    }),
    ...pages.map((page) => {
      const translation = page.translations[0];
      const event = audit(page.id);
      const href = page.slug === "home" ? "/admin/home" : page.slug === "about" ? "/admin/about" : `/admin/pages/${page.slug}`;
      return {
        id: `page:${page.id}`, entityType: "PAGE" as const, entityId: page.id,
        label: page.title, locale: "PT" as const, status: statusOf(translation), href,
        error: translation?.syncError ?? null,
        updatedAt: event.eventUpdatedAt ?? translation?.updatedAt.toISOString() ?? null,
        actor: event.actor, direction: event.direction,
      };
    }),
  ];
  const copyBinding = bindings.find((binding) => binding.entityId === STOREFRONT_COPY_KEY);
  const copyEvent = copyBinding?.syncEvents[0];
  rows.push({
    id: "storefront-copy", entityType: "STOREFRONT_COPY", entityId: STOREFRONT_COPY_KEY,
    label: "Storefront copy", locale: "PT", status: copyEvent?.status === "SUCCEEDED" ? "SYNCED" : eventStatus(copyEvent?.status),
    href: "/admin/settings", error: copyEvent?.error ?? null,
    updatedAt: copyEvent?.updatedAt.toISOString() ?? null, actor: copyEvent?.actorUsername ?? null,
    direction: copyEvent?.direction ?? null,
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // I18N ]</p>
        <h1 className="adm-page-title">Localization</h1>
        <p className="adm-page-subtitle">Portuguese coverage, Shopify sync state, conflicts, and retry history.</p>
      </div>
      <TranslationsCms rows={rows} />
    </div>
  );
}

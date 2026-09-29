import { ExternalLink } from "lucide-react";

import type {
  LocalHandleRedirectSample,
  RedirectsVisibilityReport,
} from "@/lib/seo/redirects-visibility";
import type { ShopifyUrlRedirectsResult } from "@/lib/shopify/url-redirects";
import { SHOPIFY_URL_REDIRECT_READ_SCOPE } from "@/lib/shopify/url-redirects";

const ENTITY_LABEL = {
  PRODUCT: "Product",
  COLLECTION: "Collection",
  PAGE: "Page",
} as const;

function ShopifyStatus({ shopify }: { shopify: ShopifyUrlRedirectsResult }) {
  if (shopify.status === "unconfigured") {
    return (
      <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
        Shopify Admin API is not configured — URL Redirects cannot be listed. Set{" "}
        <code className="text-[0.7rem]">SHOPIFY_STORE_DOMAIN</code> and Admin credentials.
      </p>
    );
  }

  if (shopify.status === "missing_scope") {
    return (
      <div className="grid gap-2">
        <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          Missing scope <code className="text-[0.7rem]">{SHOPIFY_URL_REDIRECT_READ_SCOPE}</code>.
          Grant it on the Shopify app, then reload. Manage redirects in Shopify Admin until then.
        </p>
        <a
          href={shopify.adminRedirectsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          style={{ color: "var(--adm-ink)" }}
        >
          Open Shopify URL Redirects
          <ExternalLink className="size-3 opacity-50" aria-hidden="true" />
        </a>
      </div>
    );
  }

  if (shopify.status === "error") {
    return (
      <div className="grid gap-2">
        <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          Could not load Shopify URL Redirects: {shopify.message}
        </p>
        {shopify.adminRedirectsUrl ? (
          <a
            href={shopify.adminRedirectsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
            style={{ color: "var(--adm-ink)" }}
          >
            Open Shopify URL Redirects
            <ExternalLink className="size-3 opacity-50" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--adm-ink)" }}>
          {shopify.count}
          <span className="ml-1.5 text-xs font-medium" style={{ color: "var(--adm-subtle)" }}>
            in Shopify
            {shopify.countPrecision !== "EXACT" ? ` (${shopify.countPrecision.toLowerCase()})` : ""}
          </span>
        </p>
        <a
          href={shopify.adminRedirectsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          style={{ color: "var(--adm-ink)" }}
        >
          Manage in Shopify
          <ExternalLink className="size-3 opacity-50" aria-hidden="true" />
        </a>
      </div>
      <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
        These apply on the Shopify Online Store host. The headless Synarava domain does not inherit
        them automatically — add storefront-side redirects separately when an old path must move on
        our host.
      </p>
      {shopify.redirects.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
          No URL Redirects in Shopify yet. Handle changes with{" "}
          <code className="text-[0.7rem]">redirectNewHandle</code> create them when you rename in
          Catalog / Collections.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="adm-redirects__table w-full text-left text-xs">
            <caption className="sr-only">Shopify URL Redirects</caption>
            <thead>
              <tr>
                <th scope="col">From</th>
                <th scope="col">To</th>
              </tr>
            </thead>
            <tbody>
              {shopify.redirects.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code>{row.path}</code>
                  </td>
                  <td>
                    <code>{row.target}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shopify.truncated ? (
            <p className="mt-2 text-xs" style={{ color: "var(--adm-subtle)" }}>
              Showing first {shopify.redirects.length} of {shopify.count}. Full list in Shopify
              Admin.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LocalHandleRows({ samples }: { samples: LocalHandleRedirectSample[] }) {
  if (samples.length === 0) {
    return (
      <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
        No local handle redirects yet. Renaming a localized product, collection, or page handle
        records one automatically.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="adm-redirects__table w-full text-left text-xs">
        <caption className="sr-only">Localized handle redirects on the Synarava storefront</caption>
        <thead>
          <tr>
            <th scope="col">Type</th>
            <th scope="col">Locale</th>
            <th scope="col">From</th>
            <th scope="col">To</th>
          </tr>
        </thead>
        <tbody>
          {samples.map((row) => (
            <tr key={row.id}>
              <td>{ENTITY_LABEL[row.entityType]}</td>
              <td>
                <code>{row.locale}</code>
              </td>
              <td>
                <code>{row.fromHandle}</code>
              </td>
              <td>
                <code>{row.toHandle}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Read-only Shopify URL Redirects + local handle redirects for /admin/meta. */
export function RedirectsVisibilityPanel({ report }: { report: RedirectsVisibilityReport }) {
  return (
    <section className="adm-panel grid gap-5 p-5 md:p-6" data-component="RedirectsVisibilityPanel">
      <div>
        <p className="adm-section-tag">Redirects</p>
        <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
          Read-only visibility. Shopify owns Online Store URL Redirects; Synarava owns localized
          handle redirects on this domain. No second redirect editor here.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="adm-redirects__bucket grid gap-2">
          <p className="adm-label">Shopify URL Redirects</p>
          <ShopifyStatus shopify={report.shopify} />
        </div>

        <div className="adm-redirects__bucket grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="adm-label">Storefront handle redirects</p>
            <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--adm-ink)" }}>
              {report.local.count}
              <span className="ml-1.5 text-xs font-medium" style={{ color: "var(--adm-subtle)" }}>
                local
              </span>
            </p>
          </div>
          <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            Active on the Synarava headless host when a visitor hits an old locale-specific handle.
            Created when you change a localized handle in admin.
          </p>
          <LocalHandleRows samples={report.local.samples} />
          {report.local.count > report.local.samples.length ? (
            <p className="text-xs" style={{ color: "var(--adm-subtle)" }}>
              Showing {report.local.samples.length} most recently updated of {report.local.count}.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

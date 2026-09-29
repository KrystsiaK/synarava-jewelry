import "server-only";

import { cache } from "react";

import type { LocalizedHandleEntityType } from "@/lib/content/handle-localization";
import { db } from "@/lib/db";
import {
  fetchShopifyUrlRedirects,
  type ShopifyUrlRedirectsResult,
} from "@/lib/shopify/url-redirects";

export type LocalHandleRedirectSample = {
  id: string;
  entityType: LocalizedHandleEntityType;
  locale: string;
  fromHandle: string;
  toHandle: string;
};

export type RedirectsVisibilityReport = {
  shopify: ShopifyUrlRedirectsResult;
  local: {
    count: number;
    samples: LocalHandleRedirectSample[];
  };
};

const LOCAL_SAMPLE_LIMIT = 20;

function isHandleEntityType(value: string): value is LocalizedHandleEntityType {
  return value === "PRODUCT" || value === "COLLECTION" || value === "PAGE";
}

/**
 * Read-only redirects visibility for /admin/meta:
 * Shopify URL Redirects (Online Store host) + local LocalizedHandleRedirect rows
 * (headless storefront). No new knobs — edit in Shopify Admin or by changing handles.
 */
export const getRedirectsVisibilityReport = cache(
  async (): Promise<RedirectsVisibilityReport> => {
    const [shopify, localCount, localRows] = await Promise.all([
      fetchShopifyUrlRedirects(),
      db.localizedHandleRedirect.count(),
      db.localizedHandleRedirect.findMany({
        select: {
          id: true,
          entityType: true,
          locale: true,
          fromHandle: true,
          toHandle: true,
        },
        orderBy: { updatedAt: "desc" },
        take: LOCAL_SAMPLE_LIMIT,
      }),
    ]);

    return {
      shopify,
      local: {
        count: localCount,
        samples: localRows.flatMap((row) =>
          isHandleEntityType(row.entityType)
            ? [
                {
                  id: row.id,
                  entityType: row.entityType,
                  locale: row.locale,
                  fromHandle: row.fromHandle,
                  toHandle: row.toHandle,
                },
              ]
            : [],
        ),
      },
    };
  },
);

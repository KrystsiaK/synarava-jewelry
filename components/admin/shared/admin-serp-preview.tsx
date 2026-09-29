"use client";

import type { ReactNode } from "react";

import { AdminHelp } from "@/components/admin/shared/admin-help";
import { FieldLabel } from "@/components/admin/shared/field-label";
import { SITE_SEO_DEFAULTS } from "@/lib/content/site-seo-fields";
import { composeDocumentTitle } from "@/lib/seo/document-title";
import {
  defaultSerpHost,
  SEO_DESCRIPTION_SOFT_MAX,
  SEO_TITLE_SOFT_MAX,
  serpDisplayUrl,
} from "@/lib/seo/serp-preview";
import { cn } from "@/lib/ui";

export type AdminSerpPreviewProps = {
  /** Resolved title already applying seo/fallback rules (brand composed for preview). */
  title: string;
  /** Resolved description (may be empty). */
  description: string;
  /** Storefront path, e.g. `/en/products/ring`. */
  path: string;
  /** Public host for the green URL line. Defaults from NEXT_PUBLIC_SITE_URL / APP_URL. */
  siteHost?: string;
  /** Site title template; defaults to shipped `%s | Synarava`. */
  titleTemplate?: string;
  help?: ReactNode;
  className?: string;
};

function Meter({
  label,
  length,
  max,
}: {
  label: string;
  length: number;
  max: number;
}) {
  const over = length > max;
  return (
    <span
      className="adm-serp__meter"
      data-over={over ? "true" : "false"}
      title={over ? `${label} may truncate in search results` : undefined}
    >
      {label}{" "}
      <span className="adm-serp__meter-count">
        {length}/{max}
      </span>
    </span>
  );
}

/**
 * Live Google-style search result preview for Shopify SEO title/description.
 * Soft counters only — not a Yoast-style score. Wire beside SEO fields.
 */
export function AdminSerpPreview({
  title,
  description,
  path,
  siteHost,
  titleTemplate = SITE_SEO_DEFAULTS.titleTemplate,
  help,
  className,
}: AdminSerpPreviewProps) {
  const host = siteHost?.trim() || defaultSerpHost();
  const url = serpDisplayUrl(host, path);
  const displayTitle = composeDocumentTitle(title.trim() || "Untitled", titleTemplate);
  const titleLength = displayTitle.length;
  const descriptionLength = description.trim().length;
  const descriptionText = description.trim() || "Add an SEO description to control this line.";

  return (
    <div
      data-component="AdminSerpPreview"
      className={cn("adm-serp", className)}
    >
      <div className="adm-serp__header">
        <FieldLabel
          help={
            help ?? (
              <AdminHelp>
                Approximate search result. Soft limits are 60 / 160 characters — overage may
                truncate in Google. Blank SEO fields fall back to the page title and summary.
                Brand is applied once via the site title template (already-branded SEO titles
                are not doubled).
              </AdminHelp>
            )
          }
        >
          Search preview
        </FieldLabel>
        <div className="adm-serp__meters" aria-label="Character counts">
          <Meter label="Title" length={titleLength} max={SEO_TITLE_SOFT_MAX} />
          <Meter label="Description" length={descriptionLength} max={SEO_DESCRIPTION_SOFT_MAX} />
        </div>
      </div>
      <div className="adm-serp__result">
        <p className="adm-serp__url">{url}</p>
        <p className="adm-serp__title">{displayTitle}</p>
        <p
          className="adm-serp__description"
          data-empty={description.trim() ? "false" : "true"}
        >
          {descriptionText}
        </p>
      </div>
    </div>
  );
}

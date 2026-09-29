import Link from "next/link";
import { Check, CircleAlert, CircleDashed, ExternalLink, Minus } from "lucide-react";

import type {
  ImageAltCoverage,
  MetaHealthCheck,
  MetaHealthReport,
  MetaHealthTone,
  SeoCoverageBucket,
} from "@/lib/seo/meta-health";
import { cn } from "@/lib/ui";

const TONE_ICON = {
  ok: Check,
  partial: CircleDashed,
  warn: CircleAlert,
  empty: Minus,
} as const;

const TONE_LABEL = {
  ok: "OK",
  partial: "Partial",
  warn: "Needs attention",
  empty: "Empty",
} as const;

function toneClass(tone: MetaHealthTone) {
  if (tone === "ok") return "adm-meta-health__tone--ok";
  if (tone === "partial") return "adm-meta-health__tone--partial";
  if (tone === "warn") return "adm-meta-health__tone--warn";
  return "adm-meta-health__tone--empty";
}

function CheckRow({ check }: { check: MetaHealthCheck }) {
  const Icon = TONE_ICON[check.tone];
  const body = (
    <>
      <span className={cn("adm-meta-health__mark", toneClass(check.tone))} aria-hidden="true">
        <Icon strokeWidth={1.75} className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold" style={{ color: "var(--adm-ink)" }}>
            {check.label}
          </span>
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--adm-subtle)" }}>
            {TONE_LABEL[check.tone]}
          </span>
          {check.external ? <ExternalLink className="size-3 opacity-50" aria-hidden="true" /> : null}
        </span>
        <span className="mt-0.5 block text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
          {check.detail}
        </span>
      </span>
    </>
  );

  if (!check.href) {
    return <li className="adm-meta-health__row">{body}</li>;
  }

  if (check.external) {
    return (
      <li className="adm-meta-health__row">
        <a href={check.href} target="_blank" rel="noopener noreferrer" className="adm-meta-health__link">
          {body}
        </a>
      </li>
    );
  }

  return (
    <li className="adm-meta-health__row">
      <Link href={check.href} className="adm-meta-health__link">
        {body}
      </Link>
    </li>
  );
}

function CoverageCard({ bucket }: { bucket: SeoCoverageBucket }) {
  const pct =
    bucket.published === 0
      ? null
      : Math.round((bucket.withSeoTitle / bucket.published) * 100);

  return (
    <div className="adm-meta-health__coverage">
      <div className="flex items-baseline justify-between gap-3">
        <Link href={bucket.adminListHref} className="adm-label hover:underline">
          {bucket.label}
        </Link>
        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--adm-ink)" }}>
          {bucket.published === 0 ? "—" : `${bucket.withSeoTitle}/${bucket.published}`}
          {pct != null ? (
            <span className="ml-1.5 text-xs font-medium" style={{ color: "var(--adm-subtle)" }}>
              {pct}%
            </span>
          ) : null}
        </p>
      </div>
      <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
        Published with an explicit SEO title. Blank still falls back to name/title on the storefront and in Shopify.
      </p>
      {bucket.samplesMissing.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {bucket.samplesMissing.map((sample) => (
            <li key={sample.id}>
              <Link
                href={sample.adminHref}
                className="text-xs underline-offset-2 hover:underline"
                style={{ color: "var(--adm-ink)" }}
              >
                {sample.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ImageAltCoverageCard({ coverage }: { coverage: ImageAltCoverage }) {
  const pct =
    coverage.publishedWithMedia === 0
      ? null
      : Math.round((coverage.withGoodAlt / coverage.publishedWithMedia) * 100);

  return (
    <div className="adm-meta-health__coverage">
      <div className="flex items-baseline justify-between gap-3">
        <Link href="/admin/products" className="adm-label hover:underline">
          Image alt
        </Link>
        <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--adm-ink)" }}>
          {coverage.publishedWithMedia === 0
            ? "—"
            : `${coverage.withGoodAlt}/${coverage.publishedWithMedia}`}
          {pct != null ? (
            <span className="ml-1.5 text-xs font-medium" style={{ color: "var(--adm-subtle)" }}>
              {pct}%
            </span>
          ) : null}
        </p>
      </div>
      <p className="mt-1 text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
        Published products where every gallery image has descriptive alt (not blank, Image N, or
        filename-like). Fix on Media; Scan now also raises Issues.
      </p>
      {coverage.samplesMissing.length > 0 ? (
        <ul className="mt-2 grid gap-1">
          {coverage.samplesMissing.map((sample) => (
            <li key={sample.id}>
              <Link
                href={sample.adminHref}
                className="text-xs underline-offset-2 hover:underline"
                style={{ color: "var(--adm-ink)" }}
              >
                {sample.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Read-only SEO health for /admin/meta — robots, sitemap, coverage, Rich Results samples. */
export function MetaHealthPanel({ report }: { report: MetaHealthReport }) {
  return (
    <section className="adm-panel grid gap-5 p-5 md:p-6" data-component="MetaHealthPanel">
      <div>
        <p className="adm-section-tag">Health</p>
        <p className="mt-1 text-xs" style={{ color: "var(--adm-muted)" }}>
          Checklist from the live storefront and published catalog — not a second Shopify settings screen.
          Fix gaps in Pages, Catalog, or Collections; site defaults stay below.
        </p>
      </div>

      <ul className="grid gap-1">
        {report.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </ul>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {report.coverage.map((bucket) => (
          <CoverageCard key={bucket.kind} bucket={bucket} />
        ))}
        <ImageAltCoverageCard coverage={report.imageAltCoverage} />
      </div>

      {report.richResultsSamples.length > 0 ? (
        <div className="grid gap-2">
          <p className="adm-label">Rich Results samples</p>
          <p className="text-xs leading-5" style={{ color: "var(--adm-muted)" }}>
            Open Google’s Rich Results Test on a published product URL. Product JSON-LD is emitted by the storefront.
          </p>
          <ul className="grid gap-1.5">
            {report.richResultsSamples.map((sample) => (
              <li key={sample.storefrontUrl} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                <span style={{ color: "var(--adm-ink)" }}>{sample.label}</span>
                <a
                  href={sample.testUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                  style={{ color: "var(--adm-ink)" }}
                >
                  Test as Google
                  <ExternalLink className="size-3 opacity-50" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs" style={{ color: "var(--adm-muted)" }}>
          Rich Results deep-links appear when APP_URL is set and at least one public product exists.
        </p>
      )}
    </section>
  );
}

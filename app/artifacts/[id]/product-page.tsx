import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductBySlug } from "@/lib/content/catalog";
import { getSiteVideos } from "@/lib/site-videos";
import { ProductDetail } from "@/components/artifacts/product-detail";
import { getProductBreadcrumbs } from "@/lib/catalog/product-presentation";
import { buildProductJsonLd } from "@/lib/seo/product-json-ld";

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

type Props = {
  params: Promise<{ slug?: string; id?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolved = await params;
  const key = resolved.slug ?? resolved.id ?? "";
  const product = await getProductBySlug(key);

  if (!product) return { title: "Product" };

  return {
    title: product.title,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      url: `/products/${product.slug}`,
      images: product.image
        ? [{ url: product.image, width: 1200, height: 630, alt: product.title }]
        : [],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const resolved = await params;
  const key = resolved.slug ?? resolved.id ?? "";
  const [product, videos] = await Promise.all([getProductBySlug(key), getSiteVideos()]);

  if (!product) notFound();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const productJsonLd = buildProductJsonLd(product, siteUrl);

  const breadcrumbs = getProductBreadcrumbs(product);
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      item: new URL(item.href ?? `/products/${product.slug}`, siteUrl).toString(),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <ProductDetail
        product={product}
        fitVideoSrc={product.departmentSlug === "jewelry" ? videos.braceletFilm : undefined}
      />
    </>
  );
}

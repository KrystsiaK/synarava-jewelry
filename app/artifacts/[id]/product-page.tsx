import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProductBySlug } from "@/lib/content/catalog";
import { ProductDetail } from "@/components/artifacts/product-detail";

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
    alternates: { canonical: `/products/${key}` },
    openGraph: {
      url: `/products/${key}`,
      images: [
        {
          url: product.image,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const resolved = await params;
  const key = resolved.slug ?? resolved.id ?? "";
  const product = await getProductBySlug(key);

  if (!product) notFound();

  const priceCents = parseFloat(product.price.replace(/[^0-9.]/g, ""));

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.shortDescription,
    image: product.image,
    sku: product.slug,
    brand: { "@type": "Brand", name: "Synarava" },
    offers: {
      "@type": "Offer",
      priceCurrency: "EUR",
      price: isNaN(priceCents) ? undefined : priceCents,
      availability: "https://schema.org/InStock",
      seller: { "@type": "Organization", name: "Synarava" },
    },
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Shop", item: "/shop" },
      { "@type": "ListItem", position: 3, name: product.title, item: `/products/${key}` },
    ],
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
      <ProductDetail product={product} />
    </>
  );
}
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCollectionBySlug, getProductsByCollection } from "@/lib/content/catalog";
import { CollectionDetail } from "@/components/collections/collection-detail";

function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    return { title: "Collection" };
  }

  return {
    title: collection.name,
    description: collection.summary,
    alternates: { canonical: `/collections/${slug}` },
    openGraph: {
      url: `/collections/${slug}`,
      images: [
        {
          url: collection.heroImage,
          width: 1200,
          height: 630,
          alt: collection.name,
        },
      ],
    },
  };
}

export default async function Page({ params }: Props) {
  const { slug } = await params;
  const [collection, products] = await Promise.all([
    getCollectionBySlug(slug),
    getProductsByCollection(slug),
  ]);

  if (!collection) notFound();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "/" },
      { "@type": "ListItem", position: 2, name: "Collections", item: "/collections" },
      { "@type": "ListItem", position: 3, name: collection.name, item: `/collections/${slug}` },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      <CollectionDetail collection={collection} products={products} />
    </>
  );
}
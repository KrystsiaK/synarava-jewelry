import "server-only";

import { cache } from "react";

import type { Locale } from "@/lib/i18n/locales";
import { storefrontLocaleToContentLocale } from "@/lib/i18n/localized-content";
import { db } from "@/lib/db";
import { getS3PublicUrl } from "@/lib/s3";

export type PublishedPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  publishedAt: Date;
  updatedAt: Date;
};

const publishedPostWhere = {
  status: "PUBLISHED" as const,
  visibility: "PUBLIC" as const,
};

function toPublishedPost(post: {
  id: string;
  slug: string;
  publishedAt: Date | null;
  updatedAt: Date;
  coverAsset: { key: string; alt: string | null } | null;
  translations: Array<{
    title: string;
    excerpt: string | null;
    body: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }>;
}): PublishedPost | null {
  const translation = post.translations[0];
  if (!translation || !post.publishedAt) return null;

  return {
    id: post.id,
    slug: post.slug,
    title: translation.title,
    excerpt: translation.excerpt ?? "",
    body: translation.body ?? "",
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    coverUrl: post.coverAsset ? getS3PublicUrl(post.coverAsset.key) : null,
    coverAlt: post.coverAsset?.alt ?? translation.title,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  };
}

export const listPublishedPosts = cache(async (locale: Locale): Promise<PublishedPost[]> => {
  const posts = await db.post.findMany({
    where: {
      ...publishedPostWhere,
      translations: {
        some: {
          locale: storefrontLocaleToContentLocale(locale),
          reviewStatus: "REVIEWED",
        },
      },
    },
    orderBy: { publishedAt: "desc" },
    include: {
      coverAsset: { select: { key: true, alt: true } },
      translations: {
        where: {
          locale: storefrontLocaleToContentLocale(locale),
          reviewStatus: "REVIEWED",
        },
        take: 1,
      },
    },
  });

  return posts.map(toPublishedPost).filter((post): post is PublishedPost => Boolean(post));
});

export const getPublishedPost = cache(async (slug: string, locale: Locale) => {
  const post = await db.post.findFirst({
    where: {
      slug,
      ...publishedPostWhere,
      translations: {
        some: {
          locale: storefrontLocaleToContentLocale(locale),
          reviewStatus: "REVIEWED",
        },
      },
    },
    include: {
      coverAsset: { select: { key: true, alt: true } },
      translations: {
        where: {
          locale: storefrontLocaleToContentLocale(locale),
          reviewStatus: "REVIEWED",
        },
        take: 1,
      },
    },
  });

  return post ? toPublishedPost(post) : null;
});

import "server-only";

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { headingId } from "@/lib/admin/help-docs-shared";

export const HELP_SLUG_PATTERN = /^[a-z0-9-]+$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const HELP_ROOT = path.join(process.cwd(), "docs", "user");
const HELP_ASSET_ROOT = path.join(HELP_ROOT, "assets");

export type HelpArticleStatus = "draft" | "verified";

export type HelpArticleMeta = {
  slug: string;
  title: string;
  section: string;
  status: HelpArticleStatus;
  verifiedOn: string | null;
  updatedOn: string;
};

export type HelpArticle = HelpArticleMeta & {
  body: string;
  headings: Array<{ id: string; label: string }>;
};

export class HelpArticleFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HelpArticleFormatError";
  }
}

function cleanFrontMatterValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseHelpArticle(source: string, slug: string): HelpArticle {
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new HelpArticleFormatError(`${slug}: front matter must start with ---`);
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    throw new HelpArticleFormatError(`${slug}: front matter must end with ---`);
  }

  const values = new Map<string, string>();
  for (const line of normalized.slice(4, closingIndex).split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator <= 0) {
      throw new HelpArticleFormatError(`${slug}: invalid front matter line “${line}”`);
    }
    values.set(line.slice(0, separator).trim(), cleanFrontMatterValue(line.slice(separator + 1)));
  }

  const title = values.get("title") ?? "";
  const section = values.get("section") ?? "";
  const status = values.get("status");
  const verifiedOn = values.get("verifiedOn") ?? "";
  const updatedOn = values.get("updatedOn") ?? "";

  if (!title || !section) {
    throw new HelpArticleFormatError(`${slug}: title and section are required`);
  }
  if (status !== "draft" && status !== "verified") {
    throw new HelpArticleFormatError(`${slug}: status must be draft or verified`);
  }
  if (!ISO_DATE_PATTERN.test(updatedOn)) {
    throw new HelpArticleFormatError(`${slug}: updatedOn must use YYYY-MM-DD`);
  }
  if (verifiedOn && !ISO_DATE_PATTERN.test(verifiedOn)) {
    throw new HelpArticleFormatError(`${slug}: verifiedOn must be empty or use YYYY-MM-DD`);
  }
  if (status === "verified" && !verifiedOn) {
    throw new HelpArticleFormatError(`${slug}: verified articles require verifiedOn`);
  }

  const body = normalized.slice(closingIndex + 5).trim();
  const headings = Array.from(body.matchAll(/^##\s+(.+)$/gm), ([, label]) => ({
    id: headingId(label),
    label: label.trim(),
  })).filter((heading) => heading.id);

  return {
    slug,
    title,
    section,
    status,
    verifiedOn: verifiedOn || null,
    updatedOn,
    body,
    headings,
  };
}

async function existingArticleSlugs(): Promise<string[]> {
  const entries = await readdir(HELP_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name.slice(0, -3))
    .filter((slug) => HELP_SLUG_PATTERN.test(slug))
    .sort();
}

export async function listHelpArticles(): Promise<HelpArticleMeta[]> {
  const slugs = await existingArticleSlugs();
  const articles = await Promise.all(slugs.map((slug) => loadHelpArticle(slug)));
  return articles
    .filter((article): article is HelpArticle => Boolean(article))
    .map((article) => ({
      slug: article.slug,
      title: article.title,
      section: article.section,
      status: article.status,
      verifiedOn: article.verifiedOn,
      updatedOn: article.updatedOn,
    }))
    .sort((left, right) =>
      left.section.localeCompare(right.section) || left.title.localeCompare(right.title),
    );
}

export async function loadHelpArticle(slug: string): Promise<HelpArticle | null> {
  if (!HELP_SLUG_PATTERN.test(slug)) return null;
  const slugs = await existingArticleSlugs();
  if (!slugs.includes(slug)) return null;
  const source = await readFile(path.join(HELP_ROOT, `${slug}.md`), "utf8");
  return parseHelpArticle(source, slug);
}

export async function loadHelpAsset(filename: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!/^[a-z0-9-]+\.(?:avif|gif|jpe?g|png|webp)$/i.test(filename)) return null;
  const entries = await readdir(HELP_ASSET_ROOT, { withFileTypes: true }).catch(() => []);
  if (!entries.some((entry) => entry.isFile() && entry.name === filename)) return null;

  const extension = path.extname(filename).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return {
    bytes: await readFile(path.join(HELP_ASSET_ROOT, filename)),
    contentType: contentTypes[extension],
  };
}

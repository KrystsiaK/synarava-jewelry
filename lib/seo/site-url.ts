/** A single public origin for metadata, structured data, sitemap, and robots. */
export function getPublicSiteUrl() {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!configured && process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be set to the public site URL in production.");
  }

  const url = new URL(configured || "http://localhost:3000");
  if (!/^(http:|https:)$/.test(url.protocol)) {
    throw new Error("APP_URL must use HTTP or HTTPS.");
  }
  return url.origin;
}

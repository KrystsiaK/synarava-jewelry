import type { MetadataRoute } from "next";
import { isProductionDeployment } from "@/lib/deployment-environment";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionDeployment()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  const baseUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/*/cart",
          "/*/checkout",
          "/*/login",
          "/*/register",
          "/*/reset-password",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

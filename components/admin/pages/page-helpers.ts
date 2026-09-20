import type { SavedPagePayload } from "@/app/admin/actions/pages";
import type { PageRowAction } from "@/components/admin/pages/page-types";
import { isBuiltInPage } from "@/lib/content/built-in-pages";

export function pageStatusLabel(page: SavedPagePayload) {
  if (page.status === "ARCHIVED") return "ARCHIVED";
  return page.status === "PUBLISHED" && page.visibility === "PUBLIC" ? "PUBLISHED" : "DRAFT";
}

export function isProtectedPage(slug: string) {
  return isBuiltInPage(slug) || slug === "manifesto";
}

export function pageActionCopy(target: PageRowAction) {
  if (target.action === "publish") {
    return {
      title: `Publish ${target.page.title}`,
      description:
        "This makes the page public. Site visitors may see the updated page immediately after cache revalidation.",
      confirmLabel: "Publish page",
      tone: "default" as const,
    };
  }
  if (target.action === "draft") {
    return {
      title: `Move ${target.page.title} to draft`,
      description:
        "This hides the page from public access where the site checks publishing state. The content remains editable in admin.",
      confirmLabel: "Move to draft",
      tone: "default" as const,
    };
  }
  return {
    title: `Archive ${target.page.title}`,
    description:
      "This hides the page and keeps the record in admin. Use archive when content should disappear from the site but may be restored later.",
    confirmLabel: "Archive page",
    tone: "danger" as const,
  };
}

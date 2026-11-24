import { locationFromScript } from "@/lib/marketing/ideas/calendar";
import type { LocalizedCopy } from "@/lib/marketing/ideas/localized";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export type IdeaForCalendarEvent = {
  id: string;
  productIds: string[];
  script: string;
  shotList: string[];
  hook: LocalizedCopy;
  plannedFor: Date | string;
};

function dateKeyFromPlannedFor(plannedFor: Date | string): string {
  const d =
    plannedFor instanceof Date ? plannedFor : new Date(plannedFor);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid plannedFor for calendar event");
  }
  return d.toISOString().slice(0, 10);
}

function productLabel(
  productIds: string[],
  productNameById: ReadonlyMap<string, string>,
): string {
  if (productIds.length === 0) return "Synarava";
  return productIds
    .map((id) => productNameById.get(id) ?? id)
    .join(", ");
}

export function buildGoogleCalendarEvent(input: {
  idea: IdeaForCalendarEvent;
  productNameById: ReadonlyMap<string, string>;
  siteUrl?: string;
}): {
  summary: string;
  description: string;
  start: { date: string };
  end: { date: string };
} {
  const dateKey = dateKeyFromPlannedFor(input.idea.plannedFor);
  // All-day end is exclusive — next calendar day.
  const endDate = new Date(`${dateKey}T12:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const endKey = endDate.toISOString().slice(0, 10);

  const product = productLabel(input.idea.productIds, input.productNameById);
  const location = locationFromScript(input.idea.script) || "—";
  const site = (input.siteUrl ?? getPublicSiteUrl()).replace(/\/$/, "");
  const adminLink = `${site}/admin/marketing?idea=${encodeURIComponent(input.idea.id)}`;
  const shots = input.idea.shotList.map((s) => `• ${s}`).join("\n");

  return {
    summary: `Reels: ${product} — ${location}`,
    description: [
      "Shot list (RU):",
      shots || "—",
      "",
      `Hook EN: ${input.idea.hook.en || "—"}`,
      `Hook PT: ${input.idea.hook.pt || "—"}`,
      "",
      `Admin: ${adminLink}`,
    ].join("\n"),
    start: { date: dateKey },
    end: { date: endKey },
  };
}

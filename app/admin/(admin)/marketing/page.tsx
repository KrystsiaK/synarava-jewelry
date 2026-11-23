import { MarketingCms } from "@/components/admin/marketing/marketing-cms";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { sumMonthlyAiSpendUsd } from "@/lib/ai/product-content/budget";
import {
  getLastCompetitorScanSummary,
  listApprovedIdeasCalendar,
  listCompetitorObservations,
  listContentIdeas,
  listProductOptionsForMarketing,
} from "@/lib/marketing/queries";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function asString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminMarketingPage({ searchParams }: Props) {
  await requireAdminSession("/admin/marketing");
  const raw = (await searchParams) ?? {};
  const kind = asString(raw.kind) ?? "all";

  const [observations, ideas, calendar, products, lastScan, monthlyAiSpendUsd] =
    await Promise.all([
      listCompetitorObservations({
        kind:
          kind === "initial" || kind === "changed" || kind === "removed" || kind === "all"
            ? kind
            : "all",
      }),
      listContentIdeas(),
      listApprovedIdeasCalendar(),
      listProductOptionsForMarketing(),
      getLastCompetitorScanSummary(),
      sumMonthlyAiSpendUsd(),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="adm-section-tag mb-3">[ SYN-ADM // MKT ]</p>
        <h1 className="adm-page-title">Marketing</h1>
        <p className="adm-page-subtitle">
          Competitor change feed and Reels idea calendar. Scan and generate are manual; approve
          before anything leaves the calendar.
        </p>
      </div>

      <MarketingCms
        initialKind={kind}
        products={products}
        lastScan={lastScan}
        monthlyAiSpendUsd={monthlyAiSpendUsd}
        initialObservations={observations.map((row) => ({
          id: row.id,
          brand: row.brand,
          domain: row.domain,
          url: row.url,
          fetchedAt: row.fetchedAt.toISOString(),
          kind: row.kind,
          price: row.price,
          currency: row.currency,
          source: row.source,
        }))}
        initialIdeas={ideas.map((idea) => ({
          id: idea.id,
          status: idea.status,
          locale: idea.locale,
          productIds: idea.productIds,
          signalIds: idea.signalIds,
          hook: idea.hook,
          script: idea.script,
          shotList: Array.isArray(idea.shotList)
            ? (idea.shotList as string[])
            : [],
          caption: idea.caption,
          plannedFor: idea.plannedFor?.toISOString() ?? null,
        }))}
        initialCalendar={calendar.map((week) => ({
          weekKey: week.weekKey,
          weekStart: week.weekStart.toISOString(),
          ideas: week.ideas.map((idea) => ({
            id: idea.id,
            status: idea.status,
            locale: idea.locale,
            productIds: idea.productIds,
            signalIds: idea.signalIds,
            hook: idea.hook,
            script: idea.script,
            shotList: Array.isArray(idea.shotList)
              ? (idea.shotList as string[])
              : [],
            caption: idea.caption,
            plannedFor: idea.plannedFor?.toISOString() ?? null,
          })),
        }))}
      />
    </div>
  );
}

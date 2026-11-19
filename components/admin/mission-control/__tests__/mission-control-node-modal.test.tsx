import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MissionControlNodeModal } from "@/components/admin/mission-control/mission-control-node-modal";
import {
  CLARITY_BOT_NOTE,
  GA_CONSENT_NOTE,
} from "@/lib/mission-control/analytics/types";
import { formatRevenue } from "@/lib/mission-control/analytics/ga-weekly-summary";
import { getMissionControlWiringConfig } from "@/lib/mission-control/wiring";

const NOW = new Date("2026-10-20T12:00:00.000Z");

describe("Mission Control node details", () => {
  it("shows counters, environment metadata, docs, and navigable connections", async () => {
    const user = userEvent.setup();
    const config = getMissionControlWiringConfig();
    const node = config.nodes.find((item) => item.widgetKey === "site-health")!;
    const onSelectNode = vi.fn();
    render(<MissionControlNodeModal node={node} status={{ nodeKey: node.widgetKey, level: "warn", message: "Health check slow", counters: { latencyMs: 420 }, href: "/api/health", checkedAt: NOW, updatedAt: NOW }} config={config} environment="production" liveEnvironment="staging" onClose={vi.fn()} onSelectNode={onSelectNode} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("latencyMs")).toBeInTheDocument();
    expect(screen.getByText(/Health is from the current/)).toHaveTextContent("staging");
    expect(screen.getByRole("link", { name: /Open Production/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Postgres$/i }));
    expect(onSelectNode).toHaveBeenCalledWith("db");
  });

  it("labels missing external links as an owner TODO", () => {
    const config = getMissionControlWiringConfig();
    const node = config.nodes.find((item) => item.env.production.href === "")!;
    render(<MissionControlNodeModal node={node} config={config} environment="production" liveEnvironment="staging" onClose={vi.fn()} onSelectNode={vi.fn()} />);
    expect(screen.getAllByText(/Owner TODO/).length).toBeGreaterThan(0);
  });

  it("formats weekly summary revenue with formatRevenue (same as provider)", () => {
    const config = getMissionControlWiringConfig();
    const node = config.nodes.find((item) => item.widgetKey === "analytics")!;
    const revenue = 200.5;
    render(
      <MissionControlNodeModal
        node={node}
        status={{
          nodeKey: node.widgetKey,
          level: "ok",
          message: "GA weekly",
          href: "https://analytics.google.com/analytics/web/#/p123/reports/intelligenthome",
          checkedAt: NOW,
          updatedAt: NOW,
          counters: {
            analytics: {
              connection: "connected",
              level: "ok",
              message: "GA weekly",
              issues: [],
              notices: [],
              checkedAt: NOW.toISOString(),
              clarityDataAsOf: null,
              gaConsentNote: GA_CONSENT_NOTE,
              clarityBotNote: CLARITY_BOT_NOTE,
              limits: {
                clarityCallsUsedToday: 0,
                clarityBudgetPerDay: 4,
                clarityHardLimitPerDay: 10,
                gaLookbackDays: 28,
                clarityNumOfDays: 3,
              },
              sources: { ga: "connected", clarity: "not_connected" },
              figures: [],
              weeklySummary: {
                current: {
                  users: 80,
                  sessions: 100,
                  purchases: 4,
                  revenue,
                  conversionRate: 0.04,
                },
                previous: {
                  users: 60,
                  sessions: 80,
                  purchases: 2,
                  revenue: 90,
                  conversionRate: 0.025,
                },
                sources: [],
                pages: [],
              },
              gaOpenUrl:
                "https://analytics.google.com/analytics/web/#/p123/reports/intelligenthome",
            },
          },
        }}
        config={config}
        environment="staging"
        liveEnvironment="staging"
        onClose={vi.fn()}
        onSelectNode={vi.fn()}
      />,
    );

    const summary = screen.getByRole("region", { name: /GA weekly summary/i });
    const revenueRow = within(summary)
      .getAllByRole("listitem")
      .find((item) => within(item).queryByText("Revenue"));
    expect(revenueRow).toBeTruthy();
    expect(within(revenueRow!).getByText(formatRevenue(revenue))).toBeInTheDocument();
    expect(formatRevenue(revenue)).toBe("200.50");
    expect(within(revenueRow!).queryByText(String(revenue))).not.toBeInTheDocument();
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(`${ROOT}/${rel}`, "utf8");
}

function walkClientFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = abs.slice(ROOT.length + 1);
    if (statSync(abs).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walkClientFiles(abs, out);
      continue;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(name)) continue;
    out.push(rel);
  }
  return out;
}

describe("Analytics client/server boundary", () => {
  it("keeps hub client components off server analytics modules", () => {
    const forbidden = [
      "providers/analytics",
      "analytics/ga-jwt",
      "analytics/ga-client",
      "analytics/clarity-client",
      "analytics/ga-visit-pulse",
      // formatRevenue from ga-weekly-summary is client-safe (pure number format).
      "fetchGaVisitPulse",
      "fetchGaEventCounts",
      "fetchGaWeeklySummary",
    ];
    const clientFiles = [
      "components/admin/mission-control/mission-control-node-modal.tsx",
      "components/admin/mission-control/mission-control-hub.tsx",
      "components/admin/mission-control/mission-control-status-node.tsx",
      "components/admin/mission-control/mission-control-canvas.tsx",
      "components/admin/mission-control/mission-control-copy-report-button.tsx",
      "app/admin/(admin)/mission-control/page.tsx",
      "app/admin/(admin)/page.tsx",
      "lib/mission-control/live-snapshot.ts",
      "lib/mission-control/analytics/admin-home-badge.ts",
    ];
    for (const file of clientFiles) {
      const source = read(file);
      for (const bad of forbidden) {
        expect(source, `${file} must not import ${bad}`).not.toContain(bad);
      }
    }
  });

  it("hub page loads collector-persisted snapshot only (no GA client)", () => {
    const page = read("app/admin/(admin)/mission-control/page.tsx");
    expect(page).toContain("loadMissionControlSnapshot");
    expect(page).not.toContain("getAnalyticsStatus");
    expect(page).not.toContain("runReport");
  });

  it("admin home reads saved analytics node state only (no GA poll)", () => {
    const page = read("app/admin/(admin)/page.tsx");
    expect(page).toContain("readServiceNodeStatus");
    expect(page).toContain("analyticsHomeBadgeFromStatus");
    expect(page).not.toContain("getAnalyticsStatus");
    expect(page).not.toContain("fetchGaWeeklySummary");
    expect(page).not.toContain("runReport");
  });

  it("exposes client-safe payload readers without node/server imports", () => {
    const payload = read("lib/mission-control/analytics/payload.ts");
    expect(payload).not.toMatch(
      /from ["']node:crypto["']|import ["']server-only["']|googleapis/,
    );
    expect(payload).toContain("readAnalyticsPayloadFromCounters");
    expect(payload).toContain("readAnalyticsReportMarkdown");
  });

  it("forbids GA_* env / NEXT_PUBLIC_GA in client UI code", () => {
    const roots = [
      join(ROOT, "components/admin"),
      join(ROOT, "app/admin"),
    ];
    const files = roots.flatMap((root) => walkClientFiles(root));
    for (const file of files) {
      const source = read(file);
      expect(source, `${file} must not read GA_* env`).not.toMatch(
        /process\.env\.GA_[A-Z0-9_]+/,
      );
      expect(source, `${file} must not use NEXT_PUBLIC_GA`).not.toMatch(
        /NEXT_PUBLIC_GA/,
      );
      expect(source, `${file} must not import googleapis`).not.toContain(
        "googleapis",
      );
    }
  });
});


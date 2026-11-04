import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(`${ROOT}/${rel}`, "utf8");
}

describe("Analytics client/server boundary", () => {
  it("marks GA/Clarity clients and analytics provider as server-only", () => {
    for (const rel of [
      "lib/mission-control/analytics/ga-jwt.ts",
      "lib/mission-control/analytics/ga-client.ts",
      "lib/mission-control/analytics/clarity-client.ts",
      "lib/mission-control/providers/analytics.ts",
    ]) {
      expect(read(rel), rel).toMatch(/^import ["']server-only["'];/m);
    }
  });

  it("keeps hub client components off server analytics modules", () => {
    const forbidden = [
      "providers/analytics",
      "analytics/ga-jwt",
      "analytics/ga-client",
      "analytics/clarity-client",
    ];
    const clientFiles = [
      "components/admin/mission-control/mission-control-node-modal.tsx",
      "components/admin/mission-control/mission-control-hub.tsx",
      "components/admin/mission-control/mission-control-status-node.tsx",
      "components/admin/mission-control/mission-control-canvas.tsx",
      "components/admin/mission-control/mission-control-copy-report-button.tsx",
    ];
    for (const file of clientFiles) {
      const source = read(file);
      for (const bad of forbidden) {
        expect(source, `${file} must not import ${bad}`).not.toContain(bad);
      }
    }
  });

  it("exposes client-safe payload readers without node/server imports", () => {
    const payload = read("lib/mission-control/analytics/payload.ts");
    expect(payload).not.toMatch(
      /from ["']node:crypto["']|import ["']server-only["']|googleapis/,
    );
    expect(payload).toContain("readAnalyticsPayloadFromCounters");
    expect(payload).toContain("readAnalyticsReportMarkdown");
  });
});


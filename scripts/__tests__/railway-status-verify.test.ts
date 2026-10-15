import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  readRailwayEnvironmentId,
  readRailwayEnvironmentName,
  readRailwayProjectId,
  verifyRailwayLink,
  verifyRailwayLinkFromJson,
  verifyRailwayStagingLink,
  verifyRailwayStagingLinkFromJson,
} from "../lib/railway-status-verify.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const stagingFixturePath = join(dir, "fixtures/railway-status-staging.json");
const productionFixturePath = join(
  dir,
  "fixtures/railway-status-production.json",
);

describe("railway status --json staging shape", () => {
  it("reads project id and stage from GraphQL edges connection", () => {
    const raw = readFileSync(stagingFixturePath, "utf8");
    const status = JSON.parse(raw);
    expect(readRailwayProjectId(status)).toBe(
      "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    );
    expect(readRailwayEnvironmentName(status)).toBe("staging");
    expect(
      verifyRailwayStagingLink(status, {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "staging",
      }),
    ).toMatchObject({
      ok: true,
      projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
      environmentName: "staging",
    });
    expect(
      verifyRailwayStagingLinkFromJson(raw, {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "staging",
      }).ok,
    ).toBe(true);
  });

  it("fails closed when edges are missing", () => {
    const result = verifyRailwayStagingLink(
      { id: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b" },
      {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "staging",
      },
    );
    expect(result.ok).toBe(false);
  });

  it("rejects production stage name when staging expected", () => {
    const status = {
      id: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    };
    status["environments"] = { edges: [{ node: { name: "production" } }] };
    const result = verifyRailwayStagingLink(status, {
      projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
      environmentName: "staging",
    });
    expect(result.ok).toBe(false);
  });
});

describe("railway status --json production shape (Stage 6)", () => {
  it("reads project id, production name, and immutable environment id", () => {
    const raw = readFileSync(productionFixturePath, "utf8");
    const status = JSON.parse(raw);
    expect(readRailwayProjectId(status)).toBe(
      "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    );
    expect(readRailwayEnvironmentName(status)).toBe("production");
    expect(readRailwayEnvironmentId(status)).toBe(
      "d8cb7dd8-5c26-4255-a8c5-7795f1993de6",
    );
    expect(
      verifyRailwayLink(status, {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "production",
        environmentId: "d8cb7dd8-5c26-4255-a8c5-7795f1993de6",
      }),
    ).toEqual({
      ok: true,
      projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
      environmentName: "production",
      environmentId: "d8cb7dd8-5c26-4255-a8c5-7795f1993de6",
    });
    expect(
      verifyRailwayLinkFromJson(raw, {
        projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
        environmentName: "production",
        environmentId: "d8cb7dd8-5c26-4255-a8c5-7795f1993de6",
      }).ok,
    ).toBe(true);
  });

  it("rejects wrong production environment id", () => {
    const status = JSON.parse(readFileSync(productionFixturePath, "utf8"));
    const result = verifyRailwayLink(status, {
      projectId: "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
      environmentName: "production",
      environmentId: "00000000-0000-0000-0000-000000000000",
    });
    expect(result.ok).toBe(false);
  });
});

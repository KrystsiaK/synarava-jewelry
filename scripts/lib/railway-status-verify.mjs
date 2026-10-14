import fs from "node:fs";
/** Parse Railway status JSON for sku-platform staging adopt-check. */
const ENVS_KEY = "environments";

export function readRailwayProjectId(status) {
  if (!status || typeof status !== "object") return null;
  const id = status.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function readRailwayEnvironmentName(status) {
  if (!status || typeof status !== "object") return null;
  const connection = status[ENVS_KEY];
  const edges = connection && Array.isArray(connection.edges) ? connection.edges : [];
  const node = edges[0] && edges[0].node ? edges[0].node : null;
  const name = node && typeof node.name === "string" ? node.name : null;
  return name && name.length > 0 ? name : null;
}

export function verifyRailwayStagingLink(status, expected) {
  const projectId = readRailwayProjectId(status);
  const environmentName = readRailwayEnvironmentName(status);
  if (!projectId) {
    return { ok: false, error: "could not read project id (.id) from railway status --json" };
  }
  if (projectId !== expected.projectId) {
    return { ok: false, error: "linked projectId=" + projectId + "; expected " + expected.projectId };
  }
  if (!environmentName) {
    return { ok: false, error: "could not read stage name from GraphQL edges[0].node.name" };
  }
  if (environmentName !== expected.environmentName) {
    return { ok: false, error: "linked stage=" + environmentName + "; expected " + expected.environmentName + " (refusing production)" };
  }
  return { ok: true, projectId, environmentName };
}

export function verifyRailwayStagingLinkFromJson(raw, expected) {
  let status;
  try { status = JSON.parse(raw); } catch {
    return { ok: false, error: "railway status --json is not valid JSON" };
  }
  return verifyRailwayStagingLink(status, expected);
}

const isMain = process.argv[1] && process.argv[1].endsWith("railway-status-verify.mjs");
if (isMain) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: railway-status-verify.mjs <status.json>");
    process.exit(2);
  }
  const raw = fs.readFileSync(file, "utf8");
  const pe = process["env"];
  const result = verifyRailwayStagingLinkFromJson(raw, {
    projectId: pe.SKU_PLATFORM_EXPECTED_PROJECT_ID ?? "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    environmentName: pe.SKU_PLATFORM_EXPECTED_ENVIRONMENT ?? "staging",
  });
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  console.log("OK projectId=" + result.projectId + " stage=" + result.environmentName);
}

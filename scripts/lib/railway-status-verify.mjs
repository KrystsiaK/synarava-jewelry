import fs from "node:fs";
/** Parse Railway status JSON for sku-platform adopt-check (staging + production). */
const ENVS_KEY = "environments";

export function readRailwayProjectId(status) {
  if (!status || typeof status !== "object") return null;
  const id = status.id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

export function readRailwayEnvironmentNode(status) {
  if (!status || typeof status !== "object") return null;
  const connection = status[ENVS_KEY];
  const edges = connection && Array.isArray(connection.edges) ? connection.edges : [];
  const node = edges[0] && edges[0].node ? edges[0].node : null;
  if (!node || typeof node !== "object") return null;
  return node;
}

export function readRailwayEnvironmentName(status) {
  const node = readRailwayEnvironmentNode(status);
  const name = node && typeof node.name === "string" ? node.name : null;
  return name && name.length > 0 ? name : null;
}

export function readRailwayEnvironmentId(status) {
  const node = readRailwayEnvironmentNode(status);
  const id = node && typeof node.id === "string" ? node.id : null;
  return id && id.length > 0 ? id : null;
}

/**
 * @param {unknown} status
 * @param {{
 *   projectId: string,
 *   environmentName: string,
 *   environmentId?: string,
 * }} expected
 */
export function verifyRailwayLink(status, expected) {
  const projectId = readRailwayProjectId(status);
  const environmentName = readRailwayEnvironmentName(status);
  const environmentId = readRailwayEnvironmentId(status);

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
    return {
      ok: false,
      error:
        "linked stage=" +
        environmentName +
        "; expected " +
        expected.environmentName,
    };
  }
  if (expected.environmentId) {
    if (!environmentId) {
      return {
        ok: false,
        error: "could not read environment id from GraphQL edges[0].node.id",
      };
    }
    if (environmentId !== expected.environmentId) {
      return {
        ok: false,
        error:
          "linked environmentId=" +
          environmentId +
          "; expected " +
          expected.environmentId,
      };
    }
  }
  return { ok: true, projectId, environmentName, environmentId };
}

/** @deprecated Prefer verifyRailwayLink — kept for staging call sites. */
export function verifyRailwayStagingLink(status, expected) {
  return verifyRailwayLink(status, expected);
}

export function verifyRailwayLinkFromJson(raw, expected) {
  let status;
  try {
    status = JSON.parse(raw);
  } catch {
    return { ok: false, error: "railway status --json is not valid JSON" };
  }
  return verifyRailwayLink(status, expected);
}

/** @deprecated Prefer verifyRailwayLinkFromJson */
export function verifyRailwayStagingLinkFromJson(raw, expected) {
  return verifyRailwayLinkFromJson(raw, expected);
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
  const expected = {
    projectId: pe.SKU_PLATFORM_EXPECTED_PROJECT_ID ?? "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    environmentName: pe.SKU_PLATFORM_EXPECTED_ENVIRONMENT ?? "staging",
  };
  if (pe.SKU_PLATFORM_EXPECTED_ENVIRONMENT_ID) {
    expected.environmentId = pe.SKU_PLATFORM_EXPECTED_ENVIRONMENT_ID;
  }
  const result = verifyRailwayLinkFromJson(raw, expected);
  if (!result.ok) {
    console.error(result.error);
    process.exit(1);
  }
  const envIdPart = result.environmentId
    ? " environmentId=" + result.environmentId
    : "";
  console.log(
    "OK projectId=" +
      result.projectId +
      " stage=" +
      result.environmentName +
      envIdPart,
  );
}

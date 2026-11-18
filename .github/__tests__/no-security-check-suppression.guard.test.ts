import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Never suppress or weaken dependency audit / security checks.
 * Менять только с письменного решения владельца (dated allowlist below).
 */

const ROOT = process.cwd();
const WORKFLOWS_DIR = join(ROOT, ".github/workflows");
const WORKSPACE_YAML = "pnpm-workspace.yaml";

type AuditIgnoreException = {
  id: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  reason: string;
};

/**
 * Owner-written audit-ignore allowlist only. Bots must not add or extend.
 * Менять только с письменного решения владельца.
 */
const ALLOWED_AUDIT_IGNORE_EXCEPTIONS: readonly AuditIgnoreException[] = [
  {
    id: "GHSA-fc5q-39xc-vjpf",
    approvedBy: "owner",
    approvedAt: "2026-11-18",
    expiresAt: "2026-11-25",
    reason:
      "picomatch≤4.0.7 no patch; prod path only via @sentry/nextjs→rollup; owner rejected remove-Sentry/wait",
  },
];

/** Workflow weaken flags: no exceptions. Менять только с письменного решения владельца. */
const ALLOWED_WORKFLOW_WEAKEN_EXCEPTIONS: readonly string[] = [];

const CONFIG_CANDIDATES = [
  WORKSPACE_YAML,
  "package.json",
  ".npmrc",
  ".pnpmfile.cjs",
  ".pnpmfile.js",
  ".pnpmfile.mjs",
] as const;

const ADVISORY_ID_RE = /\b(?:GHSA-[a-z0-9-]+|CVE-\d{4}-\d+)\b/gi;

const IGNORE_SECTION_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "audit.ignore", re: /\baudit\s*:\s*[\s\S]*?\bignore\s*:/m },
  { id: "auditConfig.ignoreGhsas", re: /\bignores?Ghsas\b/i },
  { id: "ignoreCves", re: /\bignores?Cves\b/i },
];

const AUDIT_SECURITY_STEP_RE =
  /\b(pnpm|npm|yarn)\s+audit\b|dependency security|secret.?scan|security.?lint|osv-scanner|gitleaks|trivy|npm-audit/i;

const WEAKEN_CHECKS: ReadonlyArray<{ id: string; re: RegExp }> = [
  { id: "continue-on-error", re: /continue-on-error\s*:\s*true/i },
  { id: "|| true", re: /\|\|\s*true\b/ },
  { id: "--ignore", re: /(?:^|\s)--ignore(?:\s|=|$)/m },
  {
    id: "lowered --audit-level",
    re: /--audit-level(?:=|\s+)(moderate|low|info|none)\b/i,
  },
];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function readIfExists(rel: string): string | null {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function extractAdvisoryIds(src: string): string[] {
  const ids = new Set<string>();
  for (const match of src.matchAll(ADVISORY_ID_RE)) {
    const raw = match[0];
    const id = raw.toUpperCase().startsWith("GHSA-")
      ? `GHSA-${raw.slice(5).toLowerCase()}`
      : raw.toUpperCase();
    ids.add(id);
  }
  return [...ids].toSorted();
}

function configHasIgnoreMechanism(src: string): boolean {
  return IGNORE_SECTION_PATTERNS.some(({ re }) => re.test(src));
}

/** Advisory IDs listed under any audit-ignore mechanism across config candidates. */
function findIgnoredAdvisoryIds(): string[] {
  const ids = new Set<string>();
  for (const rel of CONFIG_CANDIDATES) {
    const src = readIfExists(rel);
    if (src === null || !configHasIgnoreMechanism(src)) continue;
    for (const id of extractAdvisoryIds(src)) {
      ids.add(id);
    }
  }
  return [...ids].toSorted();
}

function workspaceIgnoresAdvisory(id: string): boolean {
  const src = readIfExists(WORKSPACE_YAML);
  if (src === null || !/\baudit\s*:\s*[\s\S]*?\bignore\s*:/m.test(src)) {
    return false;
  }
  return extractAdvisoryIds(src).includes(id);
}

function findUnauthorizedIgnores(): string[] {
  const allowed = new Set(ALLOWED_AUDIT_IGNORE_EXCEPTIONS.map((e) => e.id));
  return findIgnoredAdvisoryIds().filter((id) => !allowed.has(id));
}

function findExpiredExceptions(today: string): string[] {
  return ALLOWED_AUDIT_IGNORE_EXCEPTIONS.filter((e) => today > e.expiresAt).map(
    (e) => e.id,
  );
}

function findStaleAllowlistEntries(): string[] {
  return ALLOWED_AUDIT_IGNORE_EXCEPTIONS.filter(
    (e) => !workspaceIgnoresAdvisory(e.id),
  ).map((e) => e.id);
}

function workflowFiles(): string[] {
  if (!existsSync(WORKFLOWS_DIR)) return [];
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => join(WORKFLOWS_DIR, name));
}

/**
 * Split a workflow into step-ish blocks (name + following lines until next
 * "- name:" boundary). Good enough for structural gates.
 */
function workflowSteps(src: string): Array<{ name: string; body: string }> {
  const lines = src.split(/\r?\n/);
  const steps: Array<{ name: string; body: string }> = [];
  let current: { name: string; body: string } | null = null;

  for (const line of lines) {
    const nameMatch = line.match(/^\s*-\s*name:\s*(.+)\s*$/);
    if (nameMatch) {
      if (current) steps.push(current);
      current = { name: nameMatch[1].trim(), body: "" };
      continue;
    }
    if (current) {
      current.body += `${line}\n`;
    }
  }
  if (current) steps.push(current);
  return steps;
}

function findWorkflowWeakenings(): string[] {
  const hits: string[] = [];
  for (const file of workflowFiles()) {
    const rel = file.replace(`${ROOT}/`, "");
    const src = readFileSync(file, "utf8");
    for (const step of workflowSteps(src)) {
      const blob = `${step.name}\n${step.body}`;
      if (!AUDIT_SECURITY_STEP_RE.test(blob)) continue;
      for (const { id, re } of WEAKEN_CHECKS) {
        if (re.test(blob)) {
          const hit = `${rel} «${step.name}»: ${id}`;
          if (!ALLOWED_WORKFLOW_WEAKEN_EXCEPTIONS.includes(hit)) {
            hits.push(hit);
          }
        }
      }
    }
  }
  return hits;
}

describe("no security-check suppression", () => {
  it("rejects audit ignores not on the owner allowlist", () => {
    // Менять только с письменного решения владельца.
    expect(findUnauthorizedIgnores()).toEqual([]);
  });

  it("rejects expired owner audit-ignore exceptions", () => {
    // Менять только с письменного решения владельца.
    const expired = findExpiredExceptions(todayUtc());
    expect(
      expired,
      expired.length > 0
        ? `Срок исключения истёк: нужен новый письменный выбор владельца или снять исключение (${expired.join(", ")})`
        : undefined,
    ).toEqual([]);
  });

  it("rejects allowlist entries missing from pnpm-workspace.yaml audit.ignore", () => {
    // Менять только с письменного решения владельца.
    expect(findStaleAllowlistEntries()).toEqual([]);
  });

  it("rejects weaken flags on audit/security workflow steps", () => {
    // Менять только с письменного решения владельца.
    expect(findWorkflowWeakenings()).toEqual([]);
    expect(ALLOWED_WORKFLOW_WEAKEN_EXCEPTIONS).toEqual([]);
  });
});

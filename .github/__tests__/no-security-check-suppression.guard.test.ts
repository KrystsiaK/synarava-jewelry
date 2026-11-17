import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Never suppress or weaken dependency audit / security checks.
 * Allowed exceptions: empty — Менять только с письменного решения владельца.
 */

const ROOT = process.cwd();
const WORKFLOWS_DIR = join(ROOT, ".github/workflows");

/** Empty until the owner grants a written exception. */
const ALLOWED_AUDIT_IGNORE_EXCEPTIONS: readonly string[] = [];
/** Empty until the owner grants a written exception. */
const ALLOWED_WORKFLOW_WEAKEN_EXCEPTIONS: readonly string[] = [];

const CONFIG_CANDIDATES = [
  "pnpm-workspace.yaml",
  "package.json",
  ".npmrc",
  ".pnpmfile.cjs",
  ".pnpmfile.js",
  ".pnpmfile.mjs",
] as const;

const IGNORE_PATTERNS: ReadonlyArray<{ id: string; re: RegExp }> = [
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

function readIfExists(rel: string): string | null {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function findConfigSuppressions(): string[] {
  const hits: string[] = [];
  for (const rel of CONFIG_CANDIDATES) {
    const src = readIfExists(rel);
    if (src === null) continue;
    for (const { id, re } of IGNORE_PATTERNS) {
      if (re.test(src)) {
        hits.push(`${rel}: ${id}`);
      }
    }
  }
  return hits.filter((h) => !ALLOWED_AUDIT_IGNORE_EXCEPTIONS.includes(h));
}

function workflowFiles(): string[] {
  if (!existsSync(WORKFLOWS_DIR)) return [];
  return readdirSync(WORKFLOWS_DIR)
    .filter((name) => /\.ya?ml$/i.test(name))
    .map((name) => join(WORKFLOWS_DIR, name));
}

/**
 * Split a workflow into step-ish blocks (name + following lines until next
 * "- name:" / "- run:" / "jobs:" boundary). Good enough for structural gates.
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
  it("rejects audit.ignore / ignoreGhsas / ignoreCves in package config", () => {
    // Менять только с письменного решения владельца.
    expect(findConfigSuppressions()).toEqual([]);
  });

  it("rejects weaken flags on audit/security workflow steps", () => {
    // Менять только с письменного решения владельца.
    expect(findWorkflowWeakenings()).toEqual([]);
  });

  it("keeps exception allowlists empty until the owner decides in writing", () => {
    // Менять только с письменного решения владельца.
    expect(ALLOWED_AUDIT_IGNORE_EXCEPTIONS).toEqual([]);
    expect(ALLOWED_WORKFLOW_WEAKEN_EXCEPTIONS).toEqual([]);
  });
});

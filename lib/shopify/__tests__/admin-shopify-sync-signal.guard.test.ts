import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const signalSource = () =>
  readFileSync(
    path.join(process.cwd(), "components/admin/translations/admin-shopify-sync-signal.tsx"),
    "utf8",
  );

const globalsCss = () =>
  readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

describe("AdminShopifySyncSignal source guard", () => {
  it("checks requestError before the !run branch and resets run on poll catch", () => {
    const source = signalSource();
    const errorIdx = source.indexOf("if (requestError");
    const runIdx = source.indexOf("if (!run || isActiveRunStatus");
    expect(errorIdx).toBeGreaterThan(-1);
    expect(runIdx).toBeGreaterThan(-1);
    expect(errorIdx).toBeLessThan(runIdx);
    expect(source).toContain("setRun(null)");
    expect(source).toMatch(/poll failure/i);
  });

  it("keeps error detail in title/aria only — never in-flow under the chip", () => {
    const source = signalSource();
    expect(source).not.toContain("adm-sync-signal__detail");
    expect(source).not.toContain("adm-sync-signal-stack");
    expect(source).toContain("Languages missing in Shopify");
    expect(source).toContain("isLanguagesMissingReconcileWarning");
    expect(source).toContain("syncSignalDetail");
    expect(source).toContain("title={title}");
    expect(source).toMatch(/aria-label=\{linkAria\}/);
  });
});

describe("admin topbar height budget guard", () => {
  it("locks .adm-topbar to --adm-topbar-height with overflow clip", () => {
    const css = globalsCss();
    const blocks = [...css.matchAll(/\.adm-topbar\s*\{[^}]+\}/g)].map((m) => m[0]);
    expect(blocks.length).toBeGreaterThan(0);
    const enforcing = blocks.filter(
      (block) =>
        block.includes("max-height: var(--adm-topbar-height)")
        && /overflow:\s*clip/.test(block),
    );
    expect(enforcing.length).toBeGreaterThan(0);
    expect(css).not.toContain(".adm-sync-signal-stack");
    expect(css).not.toContain(".adm-sync-signal__detail");
  });
});

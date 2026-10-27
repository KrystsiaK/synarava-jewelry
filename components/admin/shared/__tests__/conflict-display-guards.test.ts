import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const ADMIN_ROOT = path.join(process.cwd(), "components/admin");

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      out.push(...walkTsx(full));
      continue;
    }
    if (/\.(tsx|ts)$/.test(name)) out.push(full);
  }
  return out;
}

describe("conflict display structural guards", () => {
  it("forbids useState(initial…Signals) under components/admin (use useSyncedState)", () => {
    const offenders: string[] = [];
    for (const file of walkTsx(ADMIN_ROOT)) {
      const source = readFileSync(file, "utf8");
      if (/useState\s*\(\s*initial\w*Signals\b/.test(source)) {
        offenders.push(path.relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps CatalogConflictStatus out of entity editors (lists only)", () => {
    const editorFiles = [
      "components/admin/products/product-edit-form.tsx",
      "components/admin/collections/collection-edit-form.tsx",
      "components/admin/pages/page-editor-form.tsx",
    ];
    const offenders: string[] = [];
    for (const rel of editorFiles) {
      const source = readFileSync(path.join(process.cwd(), rel), "utf8");
      if (/\bCatalogConflictStatus\b/.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("does not keep the product-specific locale conflict control", () => {
    expect(() => {
      readFileSync(
        path.join(process.cwd(), "components/admin/products/product-locale-conflict-control.tsx"),
        "utf8",
      );
    }).toThrow();
  });
});

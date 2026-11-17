import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildAdminNavItems,
  splitAdminHref,
} from "@/components/admin/shared/admin-nav-config";
import {
  ADMIN_SHARED_LEGACY_PATH,
  ADMIN_SHARED_PATH,
} from "@/components/admin/shared/admin-paths";

const root = process.cwd();
const adminRoot = join(root, "app/admin/(admin)");

function pageFor(pathname: string): string {
  if (pathname === "/admin") return join(adminRoot, "page.tsx");
  const rest = pathname.replace(/^\/admin\//, "");
  const [a, b] = rest.split("/");
  if (a === "pages" && b && b !== "new") return join(adminRoot, "pages/[slug]/page.tsx");
  if (a === "help" && b) return join(adminRoot, "help/[slug]/page.tsx");
  return join(adminRoot, ...rest.split("/"), "page.tsx");
}

function htmlIds(dir: string): Set<string> {
  const ids = new Set<string>();
  const re = /\bid=["']([^"']+)["']/g;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name === "__tests__") continue;
    if (name.endsWith(".tsx")) {
      for (const m of readFileSync(full, "utf8").matchAll(re)) ids.add(m[1]!);
    }
  }
  return ids;
}

describe("admin nav href guard", () => {
  const items = buildAdminNavItems({
    pages: [{ slug: "home", title: "Home" }],
  });
  const hrefs = items.flatMap((i) => [i.href, ...(i.children?.map((c) => c.href) ?? [])]);

  it("every menu href pathname has an admin page route", () => {
    expect(
      hrefs
        .map((h) => splitAdminHref(h).pathname)
        .filter((p) => !existsSync(pageFor(p)))
        .map((p) => p),
    ).toEqual([]);
  });

  it("Shared submenu hashes exist on Shared editors", () => {
    const shared = items.find((i) => i.id === "shared")!;
    expect(shared.href).toBe(ADMIN_SHARED_PATH);
    const ids = htmlIds(join(root, "components/admin/settings"));
    expect(
      (shared.children ?? [])
        .map((c) => splitAdminHref(c.href))
        .filter(({ pathname, hash }) => pathname !== ADMIN_SHARED_PATH || !hash || !ids.has(hash))
        .map(({ hash }) => hash),
    ).toEqual([]);
  });

  it("legacy /admin/settings permanently redirects to shared", () => {
    expect(ADMIN_SHARED_LEGACY_PATH).toBe("/admin/settings");
    expect(existsSync(join(adminRoot, "shared/page.tsx"))).toBe(true);
    const src = readFileSync(join(adminRoot, "settings/page.tsx"), "utf8");
    expect(src).toMatch(/permanentRedirect\s*\(\s*ADMIN_SHARED_PATH\s*\)/);
  });
});

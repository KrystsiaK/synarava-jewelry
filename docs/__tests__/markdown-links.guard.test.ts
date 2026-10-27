/**
 * Tiny guard: relative markdown links under docs/ must resolve on disk.
 * Skips http(s), mailto, anchors, glossary:, and absolute app paths (/admin/…).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const DOCS_ROOT = resolve(process.cwd(), "docs");
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) out.push(...listMarkdownFiles(path));
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
}

function shouldCheck(href: string): boolean {
  const raw = href.trim().split(/\s+/)[0] ?? "";
  if (!raw) return false;
  if (/^(https?:|mailto:|#|glossary:)/i.test(raw)) return false;
  if (raw.startsWith("/")) return false; // app routes e.g. /admin/help/…
  return true;
}

function stripCode(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "");
}

function collectDeadLinks(file: string): string[] {
  const text = stripCode(readFileSync(file, "utf8"));
  const dead: string[] = [];
  for (const match of text.matchAll(LINK_RE)) {
    const href = match[2] ?? "";
    if (!shouldCheck(href)) continue;
    const pathPart = href.trim().split(/\s+/)[0]?.split("#")[0] ?? "";
    if (!pathPart) continue;
    const target = resolve(dirname(file), pathPart);
    try {
      statSync(target);
    } catch {
      dead.push(`${href} (from ${file.slice(DOCS_ROOT.length + 1)})`);
    }
  }
  return dead;
}

describe("docs markdown relative links", () => {
  it("every relative link under docs/ resolves on disk", () => {
    const files = listMarkdownFiles(DOCS_ROOT);
    expect(files.length).toBeGreaterThan(10);
    const dead = files.flatMap(collectDeadLinks);
    expect(dead).toEqual([]);
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the architectural contract: Material lexicon cards come only from
 * `resolveLexiconMaterials(content)`. Featured collections must never be a
 * silent substitute — that made PT/RU home structure diverge from EN.
 */
describe("HomePage material lexicon isolation", () => {
  const source = readFileSync(
    join(process.cwd(), "components/home/home-page.tsx"),
    "utf8",
  );

  it("resolves lexicon only from page content", () => {
    expect(source).toContain("const lexiconMaterials = resolveLexiconMaterials(content);");
  });

  it("does not map featured collections into lexicon materials", () => {
    expect(source).not.toMatch(
      /configuredLexiconMaterials\.length\s*>\s*0/,
    );
    expect(source).not.toMatch(
      /name:\s*item\.title,\s*category:\s*item\.series,\s*description:\s*item\.description/,
    );
  });
});

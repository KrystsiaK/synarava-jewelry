import { describe, expect, it } from "vitest";

import {
  isRichTextEmpty,
  looksLikeHtml,
  normalizeRichTextForEditor,
  normalizeRichTextForStorage,
  richTextPlainLength,
  sanitizeHref,
  sanitizeRichTextHtml,
} from "@/lib/content/rich-text";

describe("rich-text helpers", () => {
  it("detects html vs plain text", () => {
    expect(looksLikeHtml("plain www.example.com")).toBe(false);
    expect(looksLikeHtml('<p><a href="https://example.com">x</a></p>')).toBe(true);
  });

  it("wraps plain text lines as paragraphs for the editor", () => {
    expect(normalizeRichTextForEditor("line one\nline two")).toBe(
      "<p>line one</p><p>line two</p>",
    );
  });

  it("keeps only safe tags and href schemes", () => {
    const dirty =
      '<p>Hi <a href="javascript:alert(1)">bad</a> <a href="https://ok.example">ok</a><script>x</script></p>';
    const clean = sanitizeRichTextHtml(dirty);
    expect(clean).toContain('href="https://ok.example"');
    expect(clean).toContain("target=\"_blank\"");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<script");
    expect(clean).toContain("bad");
    expect(clean).toContain(">ok</a>");
  });

  it("normalizes bare www hrefs and empties blank editors", () => {
    expect(sanitizeHref("www.centroarbitragemlisboa.pt")).toBe(
      "https://www.centroarbitragemlisboa.pt",
    );
    expect(normalizeRichTextForStorage("<p></p><p><br></p>")).toBe("");
    expect(isRichTextEmpty("<p> </p>")).toBe(true);
    expect(richTextPlainLength("<p>Hello <a href='https://x.test'>link</a></p>")).toBe(10);
  });
});

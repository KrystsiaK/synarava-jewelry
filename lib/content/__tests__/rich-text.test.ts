import { describe, expect, it } from "vitest";

import {
  isAllowedRichTextHref,
  isExternalHttpHref,
  isInternalHref,
  isRichTextEmpty,
  looksLikeHtml,
  looksLikeMarkdown,
  markdownToRichHtml,
  normalizeRichTextForEditor,
  normalizeRichTextForStorage,
  plainTextFromRichText,
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

  it("converts markdown lists and links for the editor", () => {
    expect(looksLikeMarkdown("- **Account data** — Name")).toBe(true);
    const html = markdownToRichHtml(
      "Intro paragraph.\n\n- **Account data** — Name\n- Order data\n\nEmail: [hi@x.test](mailto:hi@x.test)",
    );
    expect(html).toContain("<ul>");
    expect(html).toContain("<strong>Account data</strong>");
    expect(html).toContain('href="mailto:hi@x.test"');
    expect(normalizeRichTextForEditor("- item one\n- item two")).toContain("<ul>");
  });

  it("keeps only safe tags and href schemes", () => {
    const dirty =
      '<p>Hi <a href="javascript:alert(1)">bad</a> <a href="https://ok.example">ok</a><script>x</script></p>';
    const clean = sanitizeRichTextHtml(dirty);
    expect(clean).toContain('href="https://ok.example"');
    expect(clean).toContain('target="_blank"');
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("<script");
    expect(clean).toContain("bad");
    expect(clean).toContain(">ok</a>");
  });

  it("keeps internal paths same-tab and accepts them for TipTap", () => {
    const clean = sanitizeRichTextHtml(
      '<p><a href="/shipping">Shipping</a> <a href="#returns">Returns</a></p>',
    );
    expect(clean).toContain('href="/shipping"');
    expect(clean).toContain('href="#returns"');
    expect(clean).not.toContain("target=");
    expect(sanitizeHref("/shop")).toBe("/shop");
    expect(sanitizeHref("#section")).toBe("#section");
    expect(sanitizeHref("action:cookie-settings")).toBe("action:cookie-settings");
    expect(sanitizeHref("action:evil")).toBeNull();
    expect(isInternalHref("/care")).toBe(true);
    expect(isExternalHttpHref("https://example.com")).toBe(true);
    expect(isAllowedRichTextHref("/products/ring", () => false)).toBe(true);
    expect(isAllowedRichTextHref("javascript:alert(1)", () => false)).toBe(false);
    expect(plainTextFromRichText("<p>Hello <a href='/x'>there</a></p>")).toBe("Hello there");
  });

  it("normalizes bare www hrefs and empties blank editors", () => {
    expect(sanitizeHref("www.centroarbitragemlisboa.pt")).toBe(
      "https://www.centroarbitragemlisboa.pt",
    );
    expect(normalizeRichTextForStorage("<p></p><p><br></p>")).toBe("");
    expect(isRichTextEmpty("<p> </p>")).toBe(true);
    expect(richTextPlainLength("<p>Hello <a href='https://x.test'>link</a></p>")).toBe(10);
  });

  it("stores single plain paragraphs without wrapping HTML", () => {
    expect(normalizeRichTextForStorage("<p>Four pieces to begin.</p>")).toBe(
      "Four pieces to begin.",
    );
    expect(
      normalizeRichTextForStorage('<p>See <a href="/shop">the shop</a>.</p>'),
    ).toContain('<a href="/shop"');
    expect(normalizeRichTextForStorage("<ul><li><p>One</p></li></ul>")).toContain("<ul>");
  });
});

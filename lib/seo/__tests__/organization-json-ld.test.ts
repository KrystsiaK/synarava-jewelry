import { describe, expect, it } from "vitest";

import {
  buildOrganizationJsonLd,
  organizationDescription,
  organizationSameAs,
} from "../organization-json-ld";

describe("organizationSameAs", () => {
  it("keeps absolute http(s) URLs, drops relative paths, dedupes", () => {
    expect(
      organizationSameAs([
        { href: "https://instagram.com/synarava" },
        { href: "/about" },
        { href: "  https://instagram.com/synarava  " },
        { href: "http://pinterest.com/synarava" },
        { href: "" },
      ]),
    ).toEqual([
      "https://instagram.com/synarava",
      "http://pinterest.com/synarava",
    ]);
  });
});

describe("organizationDescription", () => {
  it("uses the Russian store positioning copy", () => {
    expect(organizationDescription("ru")).toBe(
      "Synarava — интернет-магазин украшений и аксессуаров с акцентом на материалы, форму, символику и повседневную носку.",
    );
  });

  it("uses the English and Portuguese store positioning copy", () => {
    expect(organizationDescription("en")).toBe(
      "Synarava is an online shop for jewellery and accessories focused on materials, form, symbolism and everyday wear.",
    );
    expect(organizationDescription("pt")).toBe(
      "Synarava é uma loja online de joalharia e acessórios com foco em materiais, forma, simbolismo e uso no dia a dia.",
    );
  });
});

describe("buildOrganizationJsonLd", () => {
  it("includes sameAs from social links and locale description", () => {
    expect(
      buildOrganizationJsonLd(
        [{ href: "https://instagram.com/synarava" }],
        "https://synarava.example",
        "ru",
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Synarava",
      url: "https://synarava.example",
      description:
        "Synarava — интернет-магазин украшений и аксессуаров с акцентом на материалы, форму, символику и повседневную носку.",
      sameAs: ["https://instagram.com/synarava"],
    });
  });
});

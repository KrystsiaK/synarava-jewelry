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

  it("falls back to English for unknown locales via en default", () => {
    expect(organizationDescription("en")).toContain("jewelry and accessories");
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

import { describe, expect, it } from "vitest";

import {
  buildOrganizationJsonLd,
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

describe("buildOrganizationJsonLd", () => {
  it("includes sameAs from social links", () => {
    expect(
      buildOrganizationJsonLd(
        [{ href: "https://instagram.com/synarava" }],
        "https://synarava.example",
      ),
    ).toEqual({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Synarava",
      url: "https://synarava.example",
      description:
        "Handcrafted couture jewelry rooted in folk symbolism and contemporary design.",
      sameAs: ["https://instagram.com/synarava"],
    });
  });
});

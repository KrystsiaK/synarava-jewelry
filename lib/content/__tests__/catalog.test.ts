import { describe, expect, it } from "vitest";

import { parseProductDetails } from "@/lib/content/catalog";

const legacyImage =
  "https://lh3.googleusercontent.com/aida-public/demo-product-image";

describe("parseProductDetails", () => {
  it("does not invent editorial product sections for empty CMS details", () => {
    expect(parseProductDetails({})).toEqual({
      materialsEyebrow: "",
      materialsTitle: "",
      materials: [],
      process: undefined,
      lookbookEyebrow: "",
      lookbookTitle: "",
      lookbook: [],
    });
  });

  it("removes legacy demo media that was previously persisted as fallback content", () => {
    expect(
      parseProductDetails({
        materials: [{ title: "Demo", body: "Demo body", image: legacyImage }],
        process: {
          eyebrow: "Process",
          title: "Demo process",
          mediaImage: legacyImage,
          stats: [{ value: "12", label: "Hours" }],
        },
        lookbook: [{ src: legacyImage, label: "Demo lookbook" }],
      }),
    ).toEqual({
      materialsEyebrow: "",
      materialsTitle: "",
      materials: [],
      process: undefined,
      lookbookEyebrow: "",
      lookbookTitle: "",
      lookbook: [],
    });
  });

  it("preserves editorial content entered through the product admin", () => {
    const details = {
      materialsEyebrow: "Material archive",
      materialsTitle: "The honest material",
      materials: [
        {
          title: "Lava stone",
          body: "Entered in the CMS.",
          image: "/media/uploads/products/lava.webp",
        },
      ],
      process: {
        eyebrow: "Process",
        title: "Hand finished",
        mediaImage: "/media/uploads/products/process.webp",
        stats: [{ value: "12", label: "Hours" }],
      },
      lookbookEyebrow: "Pairing guide",
      lookbookTitle: "The lookbook",
      lookbook: [
        {
          src: "/media/uploads/products/lookbook.webp",
          label: "Look 01",
          featured: true,
        },
      ],
    };

    expect(parseProductDetails(details)).toEqual(details);
  });
});

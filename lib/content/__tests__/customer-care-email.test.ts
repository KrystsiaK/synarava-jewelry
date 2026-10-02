import { describe, expect, it } from "vitest";

import {
  CUSTOMER_CARE_EMAIL,
  normalizeCustomerCareContent,
  replaceLegacyCustomerCareEmail,
} from "@/lib/content/customer-care-email";

describe("customer care email", () => {
  it("replaces the retired Gmail address in plain text and mailto links", () => {
    expect(replaceLegacyCustomerCareEmail(
      "Email SYNARAVA.SHOP@GMAIL.COM or mailto:synarava.shop@gmail.com",
    )).toBe(`Email ${CUSTOMER_CARE_EMAIL} or mailto:${CUSTOMER_CARE_EMAIL}`);
  });

  it("normalizes nested saved page JSON without mutating the source", () => {
    const source = {
      finalContactEmail: "synarava.shop@gmail.com",
      sections: [{ body: "Write to synarava.shop@gmail.com" }],
      unrelated: "support@synarava.com",
    };

    const normalized = normalizeCustomerCareContent(source);

    expect(normalized).toEqual({
      finalContactEmail: CUSTOMER_CARE_EMAIL,
      sections: [{ body: `Write to ${CUSTOMER_CARE_EMAIL}` }],
      unrelated: "support@synarava.com",
    });
    expect(source.finalContactEmail).toBe("synarava.shop@gmail.com");
  });
});

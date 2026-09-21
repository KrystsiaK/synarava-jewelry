import type { LegalSectionDefault, LegalSectionMeta } from "./legal-sections";

// Verbatim copy for the new /legal-notice page — these are the fallback
// values when a section has never been touched in Admin, not placeholder
// text. Mirrors the /offer pattern (single-language legal content; only the
// chrome around it, not the identity/contact text, could ever be localized).
//
// Anchor ids are derived from the numbered label (e.g. "3. Contact" ->
// "contact") — a different Legal Document page reusing the same id is fine,
// since each page is its own HTML document; only the id must be unique
// within a single page.
export const LEGAL_NOTICE_SECTIONS: LegalSectionMeta[] = [
  { id: "store-operator", label: "1. Store Operator" },
  { id: "online-store", label: "2. Online Store" },
  { id: "contact", label: "3. Contact" },
  { id: "consumer-information", label: "4. Consumer Information" },
];

export const LEGAL_NOTICE_INTRO_DEFAULT =
  "This Legal Notice provides the identification and contact information for the person responsible for operating Synarava Shop and this online store.";

export const LEGAL_NOTICE_EXCERPT_DEFAULT =
  "Legal and business information for Synarava Shop, including the identity and contact details of the seller operating this online store.";

export const LEGAL_NOTICE_LAST_UPDATED_DEFAULT = "21 September 2026";

export const LEGAL_NOTICE_SECTION_DEFAULTS: Record<string, LegalSectionDefault> = {
  "store-operator": {
    title: "Seller identification",
    body: [
      "Synarava Shop is operated by:",
      "Nadzeya Krystsia\\\nIndividual operating Synarava Shop",
      "Largo Girassol, Bloco B1, Apt. 17\\\nLombos\\\n2775-663 Carcavelos\\\nPortugal",
      "Portuguese Tax Identification Number (NIF): [NIF]",
      "Email: synarava.shop@gmail.com",
    ].join("\n\n"),
  },
  "online-store": {
    title: "About this website",
    body: [
      "Synarava Shop is an online shop operated from Portugal.",
      "The shop offers jewellery, accessories and related products to consumers. Product information, prices, applicable taxes and available delivery options are provided on the website and during checkout.",
      "Our online store is hosted on Shopify.",
    ].join("\n\n"),
  },
  contact: {
    title: "How to contact us",
    body: [
      "For questions about products, orders, deliveries, returns or the operation of this website, please contact:",
      "Email: synarava.shop@gmail.com",
      "Postal address:",
      "Synarava Shop\\\nNadzeya Krystsia\\\nLargo Girassol, Bloco B1, Apt. 17\\\nLombos\\\n2775-663 Carcavelos\\\nPortugal",
    ].join("\n\n"),
  },
  "consumer-information": {
    title: "Consumer information",
    body: [
      "Purchases made through Synarava Shop are subject to our Terms & Conditions and the applicable consumer protection laws.",
      "Information about delivery, returns, refunds, privacy, cookies and consumer dispute resolution is available on the corresponding pages of this website.",
      "You can also access the official Portuguese electronic complaints book through the Livro de Reclamações link available in the website footer.",
    ].join("\n\n"),
  },
};

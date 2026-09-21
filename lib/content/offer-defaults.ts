import type { LegalSectionDefault, LegalSectionMeta } from "./legal-sections";

// Verbatim extraction of the hardcoded copy that shipped on /offer before it
// became admin-editable — these are the fallback values when a section has
// never been touched in Admin, not placeholder text.

export const OFFER_SECTIONS: LegalSectionMeta[] = [
  { id: "definitions", label: "1. Definitions" },
  { id: "subject", label: "2. Subject of Agreement" },
  { id: "acceptance", label: "3. Acceptance" },
  { id: "order", label: "4. Order Placement" },
  { id: "price-payment", label: "5. Price & Payment" },
  { id: "delivery", label: "6. Delivery" },
  { id: "returns", label: "7. Returns & Refunds" },
  { id: "warranties", label: "8. Warranties" },
  { id: "liability", label: "9. Liability" },
  { id: "intellectual-property", label: "10. Intellectual Property" },
  { id: "dispute", label: "11. Dispute Resolution" },
  { id: "final", label: "12. Final Provisions" },
];

export const OFFER_INTRO_DEFAULT =
  "This document constitutes a public offer within the meaning of applicable civil law. " +
  "Placing an order signifies unconditional acceptance of all terms set out below.";

export const OFFER_LAST_UPDATED_DEFAULT = "1 June 2025";

export const OFFER_SECTION_DEFAULTS: Record<string, LegalSectionDefault> = {
  definitions: {
    title: "Terms used in this Agreement",
    body: [
      "- **Seller** — Synarava Jewelry, the operator of synarava.com and seller of all products listed therein.",
      "- **Buyer** — Any natural or legal person who places an order through the website, thereby accepting this offer.",
      "- **Website** — The online store located at synarava.com and all its subpages.",
      "- **Product** — Any item of handcrafted jewelry or related goods listed for sale on the Website.",
      "- **Order** — A completed request by the Buyer to purchase one or more Products, submitted through the checkout process.",
      "- **Agreement** — This Public Offer Agreement, accepted in full by the Buyer upon placing an Order.",
    ].join("\n"),
  },
  subject: {
    title: "What this Agreement covers",
    body: [
      "The Seller undertakes to transfer ownership of the ordered Products to the Buyer, and the Buyer undertakes to accept and pay for the Products in accordance with the terms of this Agreement.",
      "All Products are described on their respective product pages. Photographs are provided for informational purposes; due to the handcrafted nature of each piece, minor variations in colour, texture, or grain pattern are inherent and do not constitute a defect.",
      "Synarava reserves the right to modify the product range and prices at any time without prior notice. Changes do not affect Orders already confirmed.",
    ].join("\n\n"),
  },
  acceptance: {
    title: "How the Agreement is concluded",
    body: [
      'This document constitutes a public offer (hereinafter "Offer") under applicable civil law. The Offer is considered accepted (the Agreement is concluded) at the moment the Buyer completes the checkout process and submits an Order.',
      "By placing an Order the Buyer confirms that they:",
      [
        "- Have read and accept all terms of this Agreement in full",
        "- Are of legal age to enter into binding contracts in their jurisdiction",
        "- Provide accurate shipping and contact information",
        "- Acknowledge that handcrafted products may have natural material variations",
      ].join("\n"),
    ].join("\n\n"),
  },
  order: {
    title: "How to place and confirm an order",
    body: [
      "Orders are placed exclusively through the Website checkout. The Buyer selects Products, provides shipping details, and confirms the Order. A confirmation email is sent to the address provided.",
      "The Seller reserves the right to refuse or cancel an Order in the following cases:",
      [
        "- The Product is out of stock or unavailable after Order placement",
        "- Payment is not received within the specified period",
        "- The Buyer provides inaccurate, incomplete, or fraudulent information",
        "- There is a pricing error on the Website",
      ].join("\n"),
      "In the event of cancellation, any payment received will be refunded in full within 5 business days.",
    ].join("\n\n"),
  },
  "price-payment": {
    title: "Payment terms and methods",
    body: [
      "All prices are displayed in Euro (€) and include applicable VAT where required. Shipping costs are calculated at checkout and displayed before payment confirmation.",
      [
        "- **Credit / Debit Card** — Visa, Mastercard, Amex. Processed securely by the payment provider shown at checkout.",
        "- **Apple Pay / Google Pay** — Accepted at checkout where supported by your browser.",
        "- **Bank Transfer** — Available on request for orders above €500. Contact us before ordering.",
      ].join("\n"),
      "Payment must be received in full before the Order is dispatched. In the event of a failed payment the Order is automatically cancelled after 24 hours.",
    ].join("\n\n"),
  },
  delivery: {
    title: "Shipping terms and timelines",
    body: [
      "Synarava ships internationally. All items are made to order or assembled from in-house stock; dispatch takes place within **3–7 business days** of payment confirmation.",
      [
        "| Zone | Time | Notes |",
        "| --- | --- | --- |",
        "| European Union | 5–10 business days | Tracked shipping. Customs duties included. |",
        "| United Kingdom | 7–12 business days | Tracked. Import VAT may apply and is the Buyer's responsibility. |",
        "| United States & Canada | 10–16 business days | Tracked international parcel. Local import duties are the Buyer's responsibility. |",
        "| Rest of World | 12–21 business days | Tracked. Customs and import taxes are the Buyer's responsibility. |",
      ].join("\n"),
      "The Seller is not responsible for delays caused by customs clearance, force majeure, or errors in the delivery address provided by the Buyer.",
    ].join("\n\n"),
  },
  returns: {
    title: "Return and refund policy",
    body: [
      "You have the right to return any Product within **14 calendar days** of delivery, in accordance with EU consumer protection law (Directive 2011/83/EU).",
      [
        "**Conditions for return**",
        "- The item is unused and in its original condition with all packaging.",
        "- The return is initiated via email to synarava.shop@gmail.com within the 14-day window.",
        "- Custom or personalised pieces cannot be returned unless defective.",
      ].join("\n"),
      [
        "**Refund process**",
        "Once the returned item is received and inspected, the refund is processed to the original payment method within **5 business days**. Return shipping costs are borne by the Buyer unless the item is defective or incorrectly sent.",
      ].join("\n"),
      [
        "**Defective items**",
        "If an item arrives damaged or defective, contact us within **48 hours** of delivery with photographs. We will arrange a replacement or full refund at no additional cost to you.",
      ].join("\n"),
    ].join("\n\n"),
  },
  warranties: {
    title: "Product quality guarantee",
    body: [
      "All Products are handcrafted to the highest standards. Synarava warrants that each Product:",
      [
        "- Is free from manufacturing defects at the time of dispatch",
        "- Corresponds to its description on the product page",
        "- Is made from the stated natural materials (wood, lava stone, ceramic, silver elements)",
      ].join("\n"),
      "The statutory warranty period is **2 years** from delivery under EU consumer law. Natural material variations (wood grain, stone texture, colour nuance) are not covered by warranty as they are an inherent quality of handcrafted pieces.",
    ].join("\n\n"),
  },
  liability: {
    title: "Limitation of liability",
    body: [
      "The Seller's total liability to the Buyer for any claim arising out of or in connection with this Agreement shall not exceed the total amount paid by the Buyer for the relevant Order.",
      "The Seller is not liable for indirect, incidental, or consequential damages, including loss of profit, loss of data, or reputational harm, to the extent permitted by applicable law.",
      "Nothing in this Agreement limits our liability for fraud, personal injury caused by our negligence, or any other liability that cannot be excluded by law.",
    ].join("\n\n"),
  },
  "intellectual-property": {
    title: "Ownership of content and designs",
    body: [
      "All content on the Website — including photography, design, typography, product descriptions, and the Synarava brand identity — is the exclusive intellectual property of Synarava Jewelry and is protected under copyright law.",
      "No content may be reproduced, distributed, or used for commercial purposes without prior written consent from Synarava. Personal, non-commercial use of product photographs is permitted with attribution.",
    ].join("\n\n"),
  },
  dispute: {
    title: "How disputes are resolved",
    body: [
      "In the event of a dispute, we encourage you to contact us first at [synarava.shop@gmail.com](mailto:synarava.shop@gmail.com). We aim to resolve all issues amicably within 10 business days.",
      "If an amicable resolution cannot be reached, you may have access to alternative consumer dispute resolution services — see our Consumer Dispute Resolution page for the available channels.",
      "This Agreement is governed by the laws of the Republic of Lithuania (where Synarava's operations are registered). Disputes that cannot be resolved amicably shall be subject to the jurisdiction of the competent courts of Lithuania, without prejudice to mandatory consumer protection provisions in the Buyer's country of residence.",
    ].join("\n\n"),
  },
  final: {
    title: "Miscellaneous",
    body: [
      "This Agreement constitutes the entire agreement between the Seller and the Buyer with respect to the purchase of Products and supersedes all prior representations or understandings.",
      "If any provision of this Agreement is found to be unenforceable, the remaining provisions shall continue in full force and effect.",
      "Synarava reserves the right to modify this Agreement at any time. The version in effect at the time of Order placement governs that specific transaction. We recommend reviewing this page periodically.",
      "**Questions about this Agreement?**\nContact us at [synarava.shop@gmail.com](mailto:synarava.shop@gmail.com) and we will respond within 2 business days.",
    ].join("\n\n"),
  },
};

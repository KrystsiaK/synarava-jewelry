import type { LegalSectionDefault, LegalSectionMeta } from "./legal-sections";

// The Terms & Conditions Legal Document — replaces "Public Offer Agreement"
// (/offer) as the store's customer-facing contractual terms. /offer is left
// in place (still admin-editable, still reachable directly) but is no longer
// linked from navigation; see PRODUCT.md history for context. Single-language
// (EN) content, same as /offer and /legal-notice — PT goes through the
// existing page-translation/sync workflow rather than a hardcoded PT export.
//
// Anchor ids are derived from the numbered label (e.g. "2. Subject of
// Agreement" -> "subject-of-agreement"), matching /offer's section ids exactly
// since the section skeleton (order, numbering, wording) is unchanged — a
// different Legal Document page reusing the same id is fine, since each page
// is its own HTML document.

export const TERMS_SECTIONS: LegalSectionMeta[] = [
  { id: "definitions", label: "1. Definitions" },
  { id: "subject-of-agreement", label: "2. Subject of Agreement" },
  { id: "acceptance", label: "3. Acceptance" },
  { id: "order-placement", label: "4. Order Placement" },
  { id: "price-payment", label: "5. Price & Payment" },
  { id: "delivery", label: "6. Delivery" },
  { id: "returns-refunds", label: "7. Returns & Refunds" },
  { id: "warranties", label: "8. Warranties" },
  { id: "liability", label: "9. Liability" },
  { id: "intellectual-property", label: "10. Intellectual Property" },
  { id: "dispute-resolution", label: "11. Dispute Resolution" },
  { id: "final-provisions", label: "12. Final Provisions" },
];

export const TERMS_INTRO_DEFAULT =
  "These Terms & Conditions apply to purchases made through Synarava Shop. Please read them before placing an order.";

export const TERMS_EXCERPT_DEFAULT =
  "Terms and conditions governing purchases from Synarava Shop, including orders, payment, delivery, returns, consumer rights and legal guarantees.";

export const TERMS_LAST_UPDATED_DEFAULT = "21 September 2026";

export const TERMS_SECTION_DEFAULTS: Record<string, LegalSectionDefault> = {
  definitions: {
    title: "About these terms",
    body: [
      "These Terms & Conditions govern purchases made through Synarava Shop.",
      [
        "- **Seller** — Nadzeya Krystsia, an individual operating Synarava Shop from Portugal.",
        "- **Customer** — a person who places an order through Synarava Shop.",
        "- **Consumer** — a natural person acting for purposes outside their trade, business, craft or profession.",
        "- **Shop** — the Synarava Shop online store.",
        "- **Product** — any product offered for sale through the Shop.",
        "- **Order** — an order submitted through the Shop checkout.",
      ].join("\n"),
      "Nothing in these Terms & Conditions limits any mandatory rights that you have under applicable consumer protection law.",
    ].join("\n\n"),
  },
  "subject-of-agreement": {
    title: "Products and product information",
    body: [
      "Synarava Shop offers jewellery, accessories and related products. The main characteristics, materials, dimensions and other relevant information for each Product are provided on its product page.",
      "Some Products may contain natural, handmade or individually produced elements. Small variations in colour, shape, texture, surface, pattern or other characteristics may therefore occur where they are inherent to the material or production method and consistent with the product description.",
      "Product photographs are intended to represent Products as accurately as reasonably possible. Colours and appearance may vary slightly depending on lighting, photography and the display used to view the Shop.",
      "Availability, prices and the Product range may change before an Order is placed. Changes do not affect Orders already accepted, except where required or agreed in accordance with applicable law.",
    ].join("\n\n"),
  },
  acceptance: {
    title: "When these terms apply",
    body: [
      "By placing an Order through Synarava Shop, you agree that your purchase is subject to these Terms & Conditions and to the information provided during checkout.",
      "Before submitting an Order, you have the opportunity to review the Products selected, delivery information, available delivery method and total price.",
      "An Order is submitted when you complete the checkout process using the final order button indicating an obligation to pay.",
      "After the Order is submitted, we send an electronic confirmation to the email address provided at checkout.",
      "Mandatory consumer rights under applicable law remain unaffected by these Terms & Conditions.",
    ].join("\n\n"),
  },
  "order-placement": {
    title: "Orders and availability",
    body: [
      "Orders are placed through the Shop checkout. You are responsible for providing accurate and complete information necessary to process and deliver your Order.",
      "Products are subject to availability.",
      "In exceptional circumstances, we may be unable to fulfil an Order, for example because a Product has become unavailable, an obvious pricing or technical error has occurred, payment has not been authorised, or information necessary to fulfil the Order is incomplete.",
      "If we cannot fulfil an Order after payment has been received, we will inform you and refund the relevant amount using the original payment method, unless another method is expressly agreed.",
      "We reserve the right to take reasonable measures to prevent fraudulent, abusive or unlawful transactions.",
    ].join("\n\n"),
  },
  "price-payment": {
    title: "Prices and payment",
    body: [
      "Prices are displayed in EUR and include applicable taxes.",
      "Any delivery charges are shown separately before you submit your Order. The final amount payable is displayed at checkout before payment.",
      "Available payment methods are shown at checkout and may vary depending on your location, device or the payment services currently available through the Shop.",
      "Payments are processed through Shopify and the payment providers available at checkout. Synarava Shop does not receive or store your complete payment card details.",
      "If a payment is not successfully authorised or completed, the Order may not be processed.",
    ].join("\n\n"),
  },
  delivery: {
    title: "Delivery",
    body: [
      "We currently deliver to Portugal and selected destinations within the European Union.",
      "Available delivery methods, charges and estimated delivery times are shown at checkout for your destination.",
      "Preparation times may vary by Product. Where a Product has specific preparation or dispatch information, this is stated on its product page.",
      "When tracking is available, tracking information is sent to the email address used for the Order after the parcel has been handed to the carrier.",
      "Delivery estimates are not guarantees. Delays may occasionally occur due to carrier operations, exceptional circumstances or incorrect or incomplete delivery information provided with the Order.",
      "For further information, please see our [Shipping Policy](/shipping) and Shipping page.",
    ].join("\n\n"),
  },
  "returns-refunds": {
    title: "Right of withdrawal and returns",
    body: [
      "If you are a consumer, you generally have the right to withdraw from a distance purchase without giving a reason within 14 days from the day on which you, or a third party indicated by you other than the carrier, acquires physical possession of the goods.",
      "To exercise this right, you must inform us of your decision to withdraw before the applicable 14-day period expires.",
      "After notifying us of your withdrawal, the goods must be returned without undue delay and no later than 14 days from the date on which you communicated your decision.",
      "For a change-of-mind return, you are responsible for the direct cost of returning the goods, provided that you were informed of this before purchase.",
      "You may handle the goods only to the extent necessary to establish their nature, characteristics and functioning. You may be responsible for any reduction in value resulting from handling beyond what is necessary for that purpose.",
      "We will refund payments as required by applicable law, including the cost of our least expensive standard delivery method where applicable. Additional delivery costs resulting from your choice of a more expensive delivery method are not refundable.",
      "We may withhold the refund until we have received the returned goods or you provide evidence that they have been sent back, whichever occurs first.",
      "Certain statutory exceptions to the right of withdrawal may apply, including, where the legal requirements are met, to goods made to the consumer's specifications or clearly personalised.",
      "More detailed instructions are available in our [Return & Refund Policy](/returns).",
    ].join("\n\n"),
  },
  warranties: {
    title: "Legal guarantee of conformity",
    body: [
      "Products sold to consumers are covered by the legal guarantee of conformity provided by applicable Portuguese consumer law.",
      "For new movable goods, the Seller is responsible for a lack of conformity that becomes apparent within three years from delivery, subject to the conditions and rules established by applicable law.",
      "A lack of conformity that becomes apparent within two years from delivery is presumed to have existed at the time of delivery, unless this is incompatible with the nature of the goods or the nature of the lack of conformity.",
      "Depending on the circumstances and the requirements of applicable law, remedies for a lack of conformity may include repair, replacement, a proportionate reduction of the price or termination of the contract.",
      "Normal wear, accidental damage, misuse, failure to follow appropriate care instructions and changes resulting from the inherent characteristics of materials do not in themselves constitute a lack of conformity.",
      "Any commercial guarantee expressly offered for a particular Product is separate from, and does not limit, your statutory rights.",
    ].join("\n\n"),
  },
  liability: {
    title: "Liability",
    body: [
      "Nothing in these Terms & Conditions excludes or limits liability where such exclusion or limitation is prohibited by applicable law.",
      "Synarava Shop is responsible for performing its obligations under the purchase contract in accordance with applicable law.",
      "To the extent permitted by law, we are not responsible for losses resulting from circumstances outside our reasonable control or from information supplied incorrectly by the Customer, provided that this does not affect any mandatory consumer rights.",
      "Nothing in these Terms & Conditions limits your statutory rights relating to defective or non-conforming Products or any other rights that cannot lawfully be excluded or restricted.",
    ].join("\n\n"),
  },
  "intellectual-property": {
    title: "Intellectual property",
    body: [
      "The content of the Shop, including its original text, photography, graphics, visual design, branding and other original materials, may be protected by copyright, trade mark and other intellectual property rights.",
      "These materials may not be copied, reproduced, distributed, modified or used for commercial purposes without the permission of the relevant rights holder, except where such use is permitted by applicable law.",
      "Third-party names, trade marks, product names, images or other materials appearing in the Shop remain the property of their respective rights holders where applicable.",
      "Nothing on the Shop grants a licence to use the Synarava name, branding or other protected material except as expressly permitted.",
    ].join("\n\n"),
  },
  "dispute-resolution": {
    title: "Consumer disputes",
    body: [
      "If you have a question or complaint about an Order, please contact us first at synarava.shop@gmail.com so that we can try to resolve the matter directly.",
      "Consumers may also have access to alternative consumer dispute resolution mechanisms in accordance with applicable law.",
      "Information about the relevant consumer dispute resolution entity and available procedures is provided on our [Consumer Dispute Resolution](/dispute-resolution) page.",
      "You can also access the official Portuguese electronic complaints book through the Livro de Reclamações link available in the website footer.",
      "These Terms & Conditions are governed by Portuguese law, without depriving consumers residing in another country of any mandatory protections that apply to them under applicable law.",
    ].join("\n\n"),
  },
  "final-provisions": {
    title: "Final provisions",
    body: [
      "These Terms & Conditions apply together with the information provided on the relevant Product pages, during checkout and in the policies referenced on this website.",
      "If any provision of these Terms & Conditions is found to be invalid or unenforceable, the remaining provisions continue to apply to the extent permitted by law.",
      "We may update these Terms & Conditions from time to time to reflect changes to the Shop, our practices or applicable legal requirements. The version applicable to an Order is the version made available to you in connection with that purchase.",
      "Changes to these Terms & Conditions do not retroactively remove or reduce rights arising from an Order already placed.",
      "If you have questions about these Terms & Conditions, contact us at synarava.shop@gmail.com.",
    ].join("\n\n"),
  },
};

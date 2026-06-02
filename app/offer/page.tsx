import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Public Offer Agreement | Synarava",
  description: "Terms of the public offer for the purchase of Synarava Jewelry products.",
};

const sections = [
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

export default function OfferPage() {
  return (
    <main className="artifact-shell min-h-screen pt-24 pb-20 md:pt-28 md:pb-32">
      {/* Header */}
      <header className="site-shell border-b border-stroke pb-10 md:pb-14">
        <p className="label-mono mb-4 text-accent">Legal</p>
        <h1 className="font-serif text-[2.4rem] leading-tight sm:text-[3.2rem] md:text-[4.5rem]">
          Public Offer Agreement
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-foreground/60 md:mt-5 md:text-lg md:leading-8">
          This document constitutes a public offer within the meaning of applicable civil law.
          Placing an order signifies unconditional acceptance of all terms set out below.
        </p>
        <p className="mt-3 label-mono text-muted">Last updated: 1 June 2025</p>
      </header>

      <div className="site-shell mt-10 grid gap-12 md:mt-14 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Table of contents — sticky sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="label-caps mb-4 text-muted">Contents</p>
            <nav className="flex flex-col gap-2">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="label-mono text-muted transition-colors hover:text-foreground"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <article className="space-y-12 md:space-y-14">

          <section id="definitions" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">1. Definitions</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Terms used in this Agreement</h2>
            <div className="panel divide-y divide-stroke">
              {[
                { term: "Seller", def: "Synarava Jewelry, the operator of synarava.com and seller of all products listed therein." },
                { term: "Buyer", def: "Any natural or legal person who places an order through the website, thereby accepting this offer." },
                { term: "Website", def: "The online store located at synarava.com and all its subpages." },
                { term: "Product", def: "Any item of handcrafted jewelry or related goods listed for sale on the Website." },
                { term: "Order", def: "A completed request by the Buyer to purchase one or more Products, submitted through the checkout process." },
                { term: "Agreement", def: "This Public Offer Agreement, accepted in full by the Buyer upon placing an Order." },
              ].map((row) => (
                <div key={row.term} className="flex flex-col gap-1 p-5 sm:flex-row sm:gap-4 md:p-6">
                  <span className="label-caps shrink-0 text-foreground sm:w-36">{row.term}</span>
                  <p className="text-sm leading-7 text-foreground/70">{row.def}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="subject" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">2. Subject of Agreement</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">What this Agreement covers</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                The Seller undertakes to transfer ownership of the ordered Products to the Buyer,
                and the Buyer undertakes to accept and pay for the Products in accordance with the
                terms of this Agreement.
              </p>
              <p>
                All Products are described on their respective product pages. Photographs are
                provided for informational purposes; due to the handcrafted nature of each piece,
                minor variations in colour, texture, or grain pattern are inherent and do not
                constitute a defect.
              </p>
              <p>
                Synarava reserves the right to modify the product range and prices at any time
                without prior notice. Changes do not affect Orders already confirmed.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="acceptance" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">3. Acceptance</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How the Agreement is concluded</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                This document constitutes a public offer (hereinafter &ldquo;Offer&rdquo;) under applicable
                civil law. The Offer is considered accepted (the Agreement is concluded) at the
                moment the Buyer completes the checkout process and submits an Order.
              </p>
              <p>
                By placing an Order the Buyer confirms that they:
              </p>
              <ul className="space-y-2 pl-4">
                {[
                  "Have read and accept all terms of this Agreement in full",
                  "Are of legal age to enter into binding contracts in their jurisdiction",
                  "Provide accurate shipping and contact information",
                  "Acknowledge that handcrafted products may have natural material variations",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="order" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">4. Order Placement</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How to place and confirm an order</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                Orders are placed exclusively through the Website checkout. The Buyer selects
                Products, provides shipping details, and confirms the Order. A confirmation email is
                sent to the address provided.
              </p>
              <p>
                The Seller reserves the right to refuse or cancel an Order in the following cases:
              </p>
              <ul className="space-y-2 pl-4">
                {[
                  "The Product is out of stock or unavailable after Order placement",
                  "Payment is not received within the specified period",
                  "The Buyer provides inaccurate, incomplete, or fraudulent information",
                  "There is a pricing error on the Website",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p>
                In the event of cancellation, any payment received will be refunded in full within
                5 business days.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="price-payment" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">5. Price & Payment</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Payment terms and methods</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                All prices are displayed in Euro (€) and include applicable VAT where required.
                Shipping costs are calculated at checkout and displayed before payment confirmation.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { method: "Credit / Debit Card", note: "Visa, Mastercard, Amex. Processed securely by Stripe." },
                  { method: "Apple Pay / Google Pay", note: "Accepted at checkout where supported by your browser." },
                  { method: "Bank Transfer", note: "Available on request for orders above €500. Contact us before ordering." },
                ].map((m) => (
                  <div key={m.method} className="panel p-5">
                    <p className="label-caps mb-2 text-foreground">{m.method}</p>
                    <p className="text-sm leading-7 text-foreground/65">{m.note}</p>
                  </div>
                ))}
              </div>
              <p>
                Payment must be received in full before the Order is dispatched. In the event of a
                failed payment the Order is automatically cancelled after 24 hours.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="delivery" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">6. Delivery</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Shipping terms and timelines</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                Synarava ships internationally. All items are made to order or assembled from
                in-studio stock; dispatch takes place within <strong className="text-foreground">3–7 business days</strong> of payment confirmation.
              </p>
              <div className="panel divide-y divide-stroke">
                {[
                  { zone: "European Union", time: "5–10 business days", note: "Tracked shipping. Customs duties included." },
                  { zone: "United Kingdom", time: "7–12 business days", note: "Tracked. Import VAT may apply and is the Buyer's responsibility." },
                  { zone: "United States & Canada", time: "10–16 business days", note: "Tracked international parcel. Local import duties are the Buyer's responsibility." },
                  { zone: "Rest of World", time: "12–21 business days", note: "Tracked. Customs and import taxes are the Buyer's responsibility." },
                ].map((row) => (
                  <div key={row.zone} className="grid gap-1 p-5 sm:grid-cols-[8rem_7rem_1fr] sm:items-baseline sm:gap-4 md:p-6">
                    <span className="label-caps text-foreground">{row.zone}</span>
                    <span className="label-mono text-accent">{row.time}</span>
                    <p className="text-sm leading-7 text-foreground/65">{row.note}</p>
                  </div>
                ))}
              </div>
              <p>
                The Seller is not responsible for delays caused by customs clearance, force
                majeure, or errors in the delivery address provided by the Buyer.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="returns" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">7. Returns & Refunds</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Return and refund policy</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                You have the right to return any Product within <strong className="text-foreground">14 calendar days</strong> of
                delivery, in accordance with EU consumer protection law (Directive 2011/83/EU).
              </p>
              <div className="panel space-y-5 p-5 md:p-7">
                <div>
                  <p className="label-caps mb-2 text-foreground">Conditions for return</p>
                  <ul className="space-y-1 pl-4 text-sm leading-7 text-foreground/70">
                    <li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />The item is unused and in its original condition with all packaging.</li>
                    <li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />The return is initiated via email to studio@synarava.com within the 14-day window.</li>
                    <li className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />Custom or personalised pieces cannot be returned unless defective.</li>
                  </ul>
                </div>
                <div className="border-t border-stroke pt-5">
                  <p className="label-caps mb-2 text-foreground">Refund process</p>
                  <p className="text-sm leading-7 text-foreground/70">
                    Once the returned item is received and inspected, the refund is processed to
                    the original payment method within <strong className="text-foreground">5 business days</strong>.
                    Return shipping costs are borne by the Buyer unless the item is defective or
                    incorrectly sent.
                  </p>
                </div>
                <div className="border-t border-stroke pt-5">
                  <p className="label-caps mb-2 text-foreground">Defective items</p>
                  <p className="text-sm leading-7 text-foreground/70">
                    If an item arrives damaged or defective, contact us within <strong className="text-foreground">48 hours</strong> of
                    delivery with photographs. We will arrange a replacement or full refund at no
                    additional cost to you.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="warranties" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">8. Warranties</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Product quality guarantee</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                All Products are handcrafted to the highest standards. Synarava warrants that each
                Product:
              </p>
              <ul className="space-y-2 pl-4">
                {[
                  "Is free from manufacturing defects at the time of dispatch",
                  "Corresponds to its description on the product page",
                  "Is made from the stated natural materials (wood, lava stone, ceramic, silver elements)",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p>
                The statutory warranty period is <strong className="text-foreground">2 years</strong> from
                delivery under EU consumer law. Natural material variations (wood grain, stone
                texture, colour nuance) are not covered by warranty as they are an inherent quality
                of handcrafted pieces.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="liability" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">9. Liability</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Limitation of liability</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                The Seller&apos;s total liability to the Buyer for any claim arising out of or in
                connection with this Agreement shall not exceed the total amount paid by the Buyer
                for the relevant Order.
              </p>
              <p>
                The Seller is not liable for indirect, incidental, or consequential damages,
                including loss of profit, loss of data, or reputational harm, to the extent
                permitted by applicable law.
              </p>
              <p>
                Nothing in this Agreement limits our liability for fraud, personal injury caused by
                our negligence, or any other liability that cannot be excluded by law.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="intellectual-property" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">10. Intellectual Property</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Ownership of content and designs</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                All content on the Website — including photography, design, typography, product
                descriptions, and the Synarava brand identity — is the exclusive intellectual
                property of Synarava Jewelry and is protected under copyright law.
              </p>
              <p>
                No content may be reproduced, distributed, or used for commercial purposes without
                prior written consent from Synarava. Personal, non-commercial use of product
                photographs is permitted with attribution.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="dispute" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">11. Dispute Resolution</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How disputes are resolved</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                In the event of a dispute, we encourage you to contact us first at{" "}
                <a href="mailto:studio@synarava.com" className="text-accent underline underline-offset-4">studio@synarava.com</a>.
                We aim to resolve all issues amicably within 10 business days.
              </p>
              <p>
                If an amicable resolution cannot be reached, EU residents may refer the matter to
                the EU Online Dispute Resolution platform at{" "}
                <span className="label-mono text-muted">ec.europa.eu/consumers/odr</span>.
              </p>
              <p>
                This Agreement is governed by the laws of the Republic of Lithuania (where
                Synarava&apos;s operations are registered). Disputes that cannot be resolved via ODR
                shall be subject to the jurisdiction of the competent courts of Lithuania, without
                prejudice to mandatory consumer protection provisions in the Buyer&apos;s country of
                residence.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="final" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">12. Final Provisions</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Miscellaneous</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                This Agreement constitutes the entire agreement between the Seller and the Buyer
                with respect to the purchase of Products and supersedes all prior representations
                or understandings.
              </p>
              <p>
                If any provision of this Agreement is found to be unenforceable, the remaining
                provisions shall continue in full force and effect.
              </p>
              <p>
                Synarava reserves the right to modify this Agreement at any time. The version in
                effect at the time of Order placement governs that specific transaction. We
                recommend reviewing this page periodically.
              </p>
              <div className="panel p-6 md:p-8">
                <p className="label-caps mb-3 text-foreground">Questions about this Agreement?</p>
                <p className="text-sm leading-7 text-foreground/70">
                  Contact us at{" "}
                  <a href="mailto:studio@synarava.com" className="text-accent underline underline-offset-4">studio@synarava.com</a>
                  {" "}and we will respond within 2 business days.
                </p>
              </div>
            </div>
          </section>

          {/* Footer nav */}
          <div className="flex flex-wrap gap-4 border-t border-stroke pt-10">
            <Link href="/" className="label-caps text-muted transition-colors hover:text-foreground">← Back to store</Link>
            <Link href="/privacy" className="label-caps text-muted transition-colors hover:text-foreground">Privacy Policy →</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

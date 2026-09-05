import type { Metadata } from "next";
import Link from "next/link";
import { PrivacySettingsButton } from "@/components/privacy/privacy-settings-button";
import { PortuguesePrivacyPolicy } from "@/components/privacy/portuguese-privacy-policy";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  return locale === "pt" ? {
    title: "Política de Privacidade | Synarava",
    description: "Como a Synarava recolhe, utiliza e protege os seus dados pessoais.",
  } : {
    title: "Privacy Policy | Synarava",
    description: "How Synarava Jewelry collects, uses, and protects your personal data.",
  };
}

const sections = [
  { id: "controller", label: "1. Data Controller" },
  { id: "data-collected", label: "2. Data We Collect" },
  { id: "legal-basis", label: "3. Legal Basis" },
  { id: "how-we-use", label: "4. How We Use Your Data" },
  { id: "sharing", label: "5. Data Sharing" },
  { id: "retention", label: "6. Retention" },
  { id: "rights", label: "7. Your Rights" },
  { id: "cookies", label: "8. Cookies" },
  { id: "security", label: "9. Security" },
  { id: "contact", label: "10. Contact" },
];

export default async function PrivacyPage() {
  const legalName = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "Synarava Jewelry";
  const postalAddress = process.env.NEXT_PUBLIC_LEGAL_POSTAL_ADDRESS;
  const privacyEmail = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "studio@synarava.com";
  const locale = await getRequestLocale();

  if (locale === "pt") {
    return <PortuguesePrivacyPolicy legalName={legalName} postalAddress={postalAddress} privacyEmail={privacyEmail} />;
  }

  return (
    <main className="artifact-shell min-h-screen pt-24 pb-20 md:pt-28 md:pb-32">
      {/* Header */}
      <header className="site-shell border-b border-stroke pb-10 md:pb-14">
        <p className="label-mono mb-4 text-accent">Legal</p>
        <h1 className="font-serif text-[2.4rem] leading-tight sm:text-[3.2rem] md:text-[4.5rem]">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-foreground/60 md:mt-5 md:text-lg md:leading-8">
          Last updated: 5 September 2026
        </p>
      </header>

      <div className="site-shell mt-10 grid gap-12 md:mt-14 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[18rem_minmax(0,1fr)]">
        {/* Table of contents — sticky sidebar on desktop */}
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
        <article className="prose-legal space-y-12 md:space-y-14">

          <section id="controller" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">1. Data Controller</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Who is responsible for your data</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                The data controller for all personal information processed through this website is
                <strong className="text-foreground"> {legalName}</strong> (hereafter &ldquo;Synarava&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
              </p>
              <p>
                Email: <a href={`mailto:${privacyEmail}`} className="text-accent underline underline-offset-4">{privacyEmail}</a>
              </p>
              {postalAddress ? <p>Postal address: {postalAddress}</p> : null}
              <p>
                We are committed to protecting your privacy and handling your data in full compliance
                with the General Data Protection Regulation (GDPR) and applicable national data
                protection laws.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="data-collected" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">2. Data We Collect</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">What information we process</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>We collect only the information necessary to provide our services:</p>
              <div className="panel space-y-5 p-5 md:p-7">
                {[
                  {
                    category: "Account data",
                    items: "Name, email address, account identifiers, order history, and saved addresses. Customer sign-in uses a one-time code; Synarava does not collect or store a customer password.",
                  },
                  {
                    category: "Order data",
                    items: "Shipping address, phone number, order contents, payment status — collected at checkout.",
                  },
                  {
                    category: "Payment data",
                    items: "Payment status and limited transaction details. Card details are entered directly with the checkout or payment provider and are not stored on Synarava servers.",
                  },
                  {
                    category: "Usage data",
                    items: "Technical information needed to operate and secure the website, such as device, browser, IP address, and request logs. Optional analytics are used only when enabled and permitted by your consent choices.",
                  },
                  {
                    category: "Communication data",
                    items: "Content of messages you send us directly via email.",
                  },
                ].map((row) => (
                  <div key={row.category} className="border-b border-stroke pb-5 last:border-0 last:pb-0">
                    <p className="label-caps mb-2 text-foreground">{row.category}</p>
                    <p className="text-sm leading-7 text-foreground/70">{row.items}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="legal-basis" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">3. Legal Basis</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Why we are allowed to process your data</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>We process your data on the following legal bases under Article 6 GDPR:</p>
              <ul className="space-y-3 pl-4">
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" /><span><strong className="text-foreground">Contractual necessity</strong> — to fulfil your order and provide customer support.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" /><span><strong className="text-foreground">Legitimate interests</strong> — to improve the website, prevent fraud, and ensure security.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" /><span><strong className="text-foreground">Consent</strong> — for optional analytics cookies and marketing communications, which you may withdraw at any time.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-accent" /><span><strong className="text-foreground">Legal obligation</strong> — to comply with applicable tax, accounting, and consumer-protection laws.</span></li>
              </ul>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="how-we-use" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">4. How We Use Your Data</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Purposes of processing</h2>
            <div className="space-y-3 text-base leading-8 text-foreground/75">
              <p>Your information is used solely for the following purposes:</p>
              <ul className="space-y-2 pl-4">
                {[
                  "Processing and fulfilling your orders",
                  "Managing your account and authentication",
                  "Sending order confirmations and shipping notifications",
                  "Responding to your enquiries and support requests",
                  "Preventing fraudulent transactions and maintaining site security",
                  "Complying with legal and regulatory obligations",
                  "Sending marketing emails only if you have explicitly opted in",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4">
                We do not sell, rent, or trade your personal data to third parties for their own
                marketing purposes.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="sharing" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">5. Data Sharing</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Third parties we work with</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                We share data only where necessary with trusted service providers bound by
                data-processing agreements:
              </p>
              <div className="panel divide-y divide-stroke">
                {[
                  { name: "Shopify", role: "Commerce and customer accounts", note: "Shopify group entities, including Shopify International Limited for customers in the EEA, support customer authentication, cart, checkout, order processing, and related commerce services when the Shopify storefront is enabled." },
                  { name: "Stripe, Inc.", role: "Payment processing", note: "Stripe processes payment details when the local checkout is used." },
                  { name: "Object storage provider", role: "File and media storage", note: "Product images and uploaded assets are stored using access-controlled object storage." },
                  { name: "Hosting provider", role: "Infrastructure", note: "Our server infrastructure provider processes operational data as a data processor." },
                ].map((p) => (
                  <div key={p.name} className="p-5 md:p-6">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="label-caps text-foreground">{p.name}</span>
                      <span className="label-mono text-muted">{p.role}</span>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-foreground/65">{p.note}</p>
                  </div>
                ))}
              </div>
              <p>
                If required by law, we may disclose data to competent authorities (courts, law
                enforcement, tax authorities) without prior notice.
              </p>
              <p>
                Some providers may process data outside the European Economic Area. Where this
                happens, we use an applicable transfer mechanism such as an adequacy decision or
                the European Commission&apos;s Standard Contractual Clauses, together with additional
                safeguards where required. Contact us for information about the safeguards relevant
                to your data.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="retention" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">6. Retention</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How long we keep your data</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                We retain personal data only as long as necessary for the purposes it was collected
                for, or as required by law:
              </p>
              <ul className="space-y-2 pl-4">
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Account data</strong> — retained while your account is active and afterward only as needed to close the account, resolve disputes, or meet legal obligations.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Order data</strong> — retained for the period required by applicable accounting, tax, consumer-protection, and warranty laws.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Technical and analytics data</strong> — retained only as long as needed for security, operation, and the applicable analytics settings.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Support communications</strong> — 2 years from last contact.</span></li>
              </ul>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="rights" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">7. Your Rights</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Rights under GDPR</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>Under the GDPR you have the following rights, which you may exercise free of charge:</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { right: "Access", desc: "Request a copy of the personal data we hold about you." },
                  { right: "Rectification", desc: "Ask us to correct inaccurate or incomplete data." },
                  { right: "Erasure", desc: "Request deletion of your data where there is no lawful reason to retain it." },
                  { right: "Restriction", desc: "Ask us to limit processing of your data in certain circumstances." },
                  { right: "Portability", desc: "Receive your data in a structured, machine-readable format." },
                  { right: "Objection", desc: "Object to processing based on legitimate interests or for direct marketing." },
                ].map((r) => (
                  <div key={r.right} className="panel p-5">
                    <p className="label-caps mb-2 text-accent">{r.right}</p>
                    <p className="text-sm leading-7 text-foreground/70">{r.desc}</p>
                  </div>
                ))}
              </div>
              <p>
                To exercise any right, contact us at{" "}
                <a href={`mailto:${privacyEmail}`} className="text-accent underline underline-offset-4">{privacyEmail}</a>.
                We will respond within 30 days. You also have the right to lodge a complaint with
                your national supervisory authority. In Portugal, this is the{" "}
                <a href="https://www.cnpd.pt/" rel="noreferrer" target="_blank" className="text-accent underline underline-offset-4">Comissão Nacional de Proteção de Dados (CNPD)</a>.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="cookies" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">8. Cookies</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How we use cookies</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                Optional storage and destinations remain disabled until you consent. Rejecting them
                does not prevent you from browsing, creating an account, or completing a purchase.
              </p>
              <div className="overflow-x-auto border border-stroke">
                <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
                  <thead className="bg-foreground/[0.04]">
                    <tr>
                      {['Name / provider', 'Purpose', 'Category', 'Duration'].map((heading) => (
                        <th key={heading} scope="col" className="label-caps border-b border-stroke p-4 text-foreground">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['synarava-consent · Synarava', 'Records your consent choices so the banner does not reappear on every page.', 'Necessary', '180 days'],
                      ['synarava-locale · Synarava', 'Remembers the language after you choose it.', 'Preference', '1 year'],
                      ['synarava-theme · Synarava', 'Remembers light, dark, or system appearance after you choose it.', 'Preference', '1 year'],
                      ['Session and cart cookies · Synarava / Shopify', 'Keeps authentication, security, cart, and checkout working.', 'Necessary', 'Session or provider-defined'],
                      ['_ga, _gid, _gat and related identifiers · Google', 'Measures site usage and commerce journeys through the configured Google tag.', 'Analytics', 'Up to 2 years'],
                      ['_fbp, _fbc and related identifiers · Meta', 'Measures advertising performance and attribution.', 'Marketing', 'Up to 90 days'],
                    ].map(([name, purpose, category, duration]) => (
                      <tr key={name} className="border-b border-stroke last:border-0">
                        <th scope="row" className="p-4 align-top font-medium text-foreground">{name}</th>
                        <td className="p-4 align-top text-foreground/70">{purpose}</td>
                        <td className="p-4 align-top text-foreground/70">{category}</td>
                        <td className="p-4 align-top text-foreground/70">{duration}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                Analytics and marketing rows apply only when those integrations are configured and
                you enable the corresponding category. You can withdraw consent at any time; the
                withdrawal applies from that point onward.
              </p>
              <div className="inline-flex border border-stroke px-4 py-3">
                <PrivacySettingsButton />
              </div>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="security" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">9. Security</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How we protect your data</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                We implement appropriate technical and organisational measures to protect your
                personal data against unauthorised access, accidental loss, destruction, or damage.
                These include:
              </p>
              <ul className="space-y-2 pl-4">
                {[
                  "Encrypted data transmission via HTTPS (TLS 1.2+)",
                  "Passwordless customer sign-in using one-time codes",
                  "Customer passwords are not collected or stored by Synarava",
                  "Payment card details are handled directly by the checkout or payment provider",
                  "Database access restricted to application layer only",
                  "Regular security reviews and dependency updates",
                ].map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="contact" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">10. Contact</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">Get in touch</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>
                For any questions about this Privacy Policy or your personal data, please contact us:
              </p>
              <div className="panel p-6 md:p-8">
                <p className="label-caps mb-4 text-foreground">{legalName}</p>
                <p>Email: <a href={`mailto:${privacyEmail}`} className="text-accent underline underline-offset-4">{privacyEmail}</a></p>
                {postalAddress ? <p>Postal address: {postalAddress}</p> : null}
              </div>
              <p>
                We do not make decisions that produce legal or similarly significant effects using
                solely automated processing. Information required for an order is necessary to enter
                into and perform the sale; without it, we may be unable to complete the purchase.
              </p>
              <p className="text-sm text-foreground/55">
                We may update this notice when our processing changes. We will identify the update
                date and provide an appropriate notice for material changes. Where the law requires
                consent for a new purpose, we will ask for it before that processing begins.
              </p>
            </div>
          </section>

          {/* Footer nav */}
          <div className="flex flex-wrap gap-4 border-t border-stroke pt-10">
            <Link href="/" className="label-caps text-muted transition-colors hover:text-foreground">← Back to store</Link>
            <Link href="/offer" className="label-caps text-muted transition-colors hover:text-foreground">Public Offer Agreement →</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

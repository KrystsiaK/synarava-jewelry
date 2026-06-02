import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Synarava",
  description: "How Synarava Jewelry collects, uses, and protects your personal data.",
};

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

export default function PrivacyPage() {
  return (
    <main className="artifact-shell min-h-screen pt-24 pb-20 md:pt-28 md:pb-32">
      {/* Header */}
      <header className="site-shell border-b border-stroke pb-10 md:pb-14">
        <p className="label-mono mb-4 text-accent">Legal</p>
        <h1 className="font-serif text-[2.4rem] leading-tight sm:text-[3.2rem] md:text-[4.5rem]">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-foreground/60 md:mt-5 md:text-lg md:leading-8">
          Last updated: 1 June 2025
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
                <strong className="text-foreground"> Synarava Jewelry</strong> (hereafter &ldquo;Synarava&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;).
              </p>
              <p>
                Contact address: <a href="mailto:studio@synarava.com" className="text-accent underline underline-offset-4">studio@synarava.com</a>
              </p>
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
                    items: "Name, email address, hashed password — provided when you register.",
                  },
                  {
                    category: "Order data",
                    items: "Shipping address, phone number, order contents, payment status — collected at checkout.",
                  },
                  {
                    category: "Payment data",
                    items: "We do not store card details. Payments are processed by Stripe, Inc., who acts as an independent data controller under their own privacy policy.",
                  },
                  {
                    category: "Usage data",
                    items: "Anonymous analytics (page visits, device type, browser) collected only with your cookie consent.",
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
                  { name: "Stripe, Inc.", role: "Payment processing", note: "Stripe processes payment card data under their own PCI-DSS certified environment." },
                  { name: "Amazon Web Services (S3)", role: "File and media storage", note: "Product images and uploaded assets are stored on AWS infrastructure." },
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
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Account data</strong> — retained for the lifetime of your account, plus 30 days after deletion.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Order data</strong> — 7 years, as required for accounting and tax compliance.</span></li>
                <li className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-stroke" /><span><strong className="text-foreground">Analytics data</strong> — aggregated and anonymised after 14 months.</span></li>
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
                <a href="mailto:studio@synarava.com" className="text-accent underline underline-offset-4">studio@synarava.com</a>.
                We will respond within 30 days. You also have the right to lodge a complaint with
                your national supervisory authority.
              </p>
            </div>
          </section>

          <div className="embroidery-separator" />

          <section id="cookies" className="scroll-mt-28">
            <p className="label-caps mb-3 text-accent">8. Cookies</p>
            <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">How we use cookies</h2>
            <div className="space-y-4 text-base leading-8 text-foreground/75">
              <p>We use the following types of cookies:</p>
              <div className="panel divide-y divide-stroke">
                {[
                  { type: "Essential", required: "Required", desc: "Session management, authentication, cart state. Cannot be disabled." },
                  { type: "Preference", required: "Required", desc: "Theme selection (light/dark mode). Stored locally." },
                  { type: "Analytics", required: "Optional", desc: "Anonymous visitor statistics to improve the website. Requires your consent." },
                ].map((c) => (
                  <div key={c.type} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-start sm:gap-4 md:p-6">
                    <div className="flex shrink-0 items-center gap-3 sm:w-40">
                      <span className="label-caps text-foreground">{c.type}</span>
                      <span className={`label-mono text-[10px] px-2 py-0.5 border ${c.required === "Required" ? "border-stroke text-muted" : "border-accent/40 text-accent"}`}>
                        {c.required}
                      </span>
                    </div>
                    <p className="text-sm leading-7 text-foreground/70">{c.desc}</p>
                  </div>
                ))}
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
                  "Bcrypt password hashing — we never store plain-text passwords",
                  "Payment card data never touches our servers (handled by Stripe)",
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
                <p className="label-caps mb-4 text-foreground">Synarava Jewelry</p>
                <p>Email: <a href="mailto:studio@synarava.com" className="text-accent underline underline-offset-4">studio@synarava.com</a></p>
              </div>
              <p className="text-sm text-foreground/55">
                We reserve the right to update this Privacy Policy. Material changes will be
                communicated via email to registered users. Continued use of our services after any
                changes constitutes acceptance of the updated policy.
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

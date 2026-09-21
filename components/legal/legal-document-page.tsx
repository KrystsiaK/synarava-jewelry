import { Fragment } from "react";
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { PageHeroImage } from "@/components/ui";
import { LegalSectionScroll } from "@/components/legal/legal-section-scroll";
import { LegalActionLink } from "@/components/legal/legal-action-link";
import { isLegalActionHref, parseLegalActionHref } from "@/lib/content/legal-actions";
import { cn } from "@/lib/ui";
import type { ResolvedLegalSection } from "@/lib/content/legal-sections";

const markdownComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto border border-stroke">
      <table>{children}</table>
    </div>
  ),
  // Anchor (#id), mailto:, relative in-app links (/shipping), and
  // action:<id> links (a fixed allowlist of website actions, e.g. opening
  // the Cookie Preferences modal — see lib/content/legal-actions.ts) stay
  // same-tab, no navigation. An action: href with an unrecognized id fails
  // safely to plain text rather than rendering a dead or arbitrary link.
  // Only genuine absolute http(s) links to another site open in a new tab,
  // with rel="noopener noreferrer" so the opened page can't reach back into
  // window.opener.
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href && isLegalActionHref(href)) {
      const actionId = parseLegalActionHref(href);
      return actionId ? <LegalActionLink actionId={actionId}>{children}</LegalActionLink> : <>{children}</>;
    }
    const isExternal = href ? /^https?:\/\//.test(href) : false;
    return (
      <a href={href} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : null)}>
        {children}
      </a>
    );
  },
};

// react-markdown's default URL sanitizer only allows the http(s)/irc(s)/
// mailto/xmpp schemes and silently empties anything else — including our
// action: scheme — as an XSS guard. Explicitly allow action: through here;
// markdownComponents.a still validates the id against the fixed allowlist
// before treating it as anything but plain text.
function legalUrlTransform(url: string): string {
  return isLegalActionHref(url) ? url : defaultUrlTransform(url);
}

// Shared chrome for /offer and /privacy: hero, sticky table of contents, and
// a list of markdown-rendered sections. Section ids/order/TOC labels are
// code-defined (see lib/content/*-defaults.ts) — only each section's title
// and body are admin-editable, via Admin -> Pages.
export function LegalDocumentPage({
  heroImage,
  eyebrowLabel,
  title,
  intro,
  lastUpdatedLabel,
  lastUpdated,
  contentsLabel,
  sections,
  backHref,
  backLabel,
  nextHref,
  nextLabel,
}: {
  heroImage?: string;
  eyebrowLabel: string;
  title: string;
  intro?: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  contentsLabel: string;
  sections: ResolvedLegalSection[];
  backHref: string;
  backLabel: string;
  nextHref: string;
  nextLabel: string;
}) {
  return (
    <main className="artifact-shell min-h-screen pb-20 md:pb-32">
      <LegalSectionScroll />
      <header className={cn("relative overflow-hidden border-b border-stroke", heroImage ? "flex min-h-[68svh] items-end py-12 pt-24 md:min-h-[76svh] md:py-16 md:pt-28" : "pt-24 md:pt-28")}>
        <PageHeroImage src={heroImage} />
        <div className="site-shell relative z-10 w-full pb-10 md:pb-14">
          <p className={cn("label-mono mb-4", heroImage ? "text-white/75" : "text-accent")}>{eyebrowLabel}</p>
          <h1 className={cn("font-serif text-[2.4rem] leading-tight sm:text-[3.2rem] md:text-[4.5rem]", heroImage && "text-white")}>
            {title}
          </h1>
          {intro ? (
            <p className={cn("mt-4 max-w-2xl text-base leading-7 md:mt-5 md:text-lg md:leading-8", heroImage ? "text-white/75" : "text-foreground/60")}>
              {intro}
            </p>
          ) : null}
          <p className={cn("mt-3 label-mono", heroImage ? "text-white/60" : "text-muted")}>{lastUpdatedLabel}: {lastUpdated}</p>
        </div>
      </header>

      <div className="site-shell mt-10 grid gap-12 md:mt-14 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-1">
            <p className="label-caps mb-4 text-muted">{contentsLabel}</p>
            <nav className="flex flex-col gap-2">
              {sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className="label-mono text-muted transition-colors hover:text-foreground">
                  {s.label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <article className="space-y-12 md:space-y-14">
          {sections.map((s, index) => (
            <Fragment key={s.id}>
              <section id={s.id} className="scroll-mt-28">
                <p className="label-caps mb-3 text-accent">{s.label}</p>
                <h2 className="mb-5 font-serif text-[1.8rem] leading-tight md:text-[2.2rem]">{s.title}</h2>
                <div className="legal-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} urlTransform={legalUrlTransform}>{s.body}</ReactMarkdown>
                </div>
              </section>
              {index < sections.length - 1 ? <div className="embroidery-separator" /> : null}
            </Fragment>
          ))}

          <div className="flex flex-wrap gap-4 border-t border-stroke pt-10">
            <Link href={backHref} className="label-caps text-muted transition-colors hover:text-foreground">{backLabel}</Link>
            <Link href={nextHref} className="label-caps text-muted transition-colors hover:text-foreground">{nextLabel}</Link>
          </div>
        </article>
      </div>
    </main>
  );
}

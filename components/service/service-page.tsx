"use client";

import { ArtifactLink, PageHeroImage } from "@/components/ui";
import { useTranslations } from "@/lib/i18n/context";
import { cn } from "@/lib/ui";

type ServiceSection = {
  title: string;
  body: string;
};

type ServicePageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: ServiceSection[];
  heroImage?: string;
};

export function ServicePage({ eyebrow, title, intro, sections, heroImage }: ServicePageProps) {
  const { t } = useTranslations();
  return (
    <main data-component="ServicePage" className="artifact-shell min-h-screen bg-background pb-24 text-foreground">
      <header
        className={cn(
          "relative overflow-hidden border-b border-stroke",
          heroImage ? "flex min-h-[68svh] items-end pb-12 pt-32 md:min-h-[76svh] md:pb-16" : "pb-12 pt-32 md:pb-16 md:pt-40",
        )}
      >
        <PageHeroImage src={heroImage} />
        <div className="site-shell relative z-10 w-full">
          <div className="max-w-4xl">
            <p className={cn("label-caps", heroImage ? "text-white/75" : "text-accent")}>{eyebrow}</p>
            <h1 className={cn("mt-5 text-balance font-serif text-[clamp(3.2rem,8vw,7rem)] leading-[0.9] tracking-[-0.04em]", heroImage && "text-white")}>
              {title}
            </h1>
            <p className={cn("mt-7 max-w-2xl text-pretty text-base leading-8 md:text-lg", heroImage ? "text-white/75" : "text-muted")}>
              {intro}
            </p>
          </div>
        </div>
      </header>

      <div className="site-shell">
        <div className="grid gap-px border-b border-stroke bg-stroke md:grid-cols-2">
          {sections.map((section, index) => (
            <section key={section.title} className="min-h-64 bg-background px-0 py-10 md:p-10">
              <p className="label-caps text-accent">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-4 font-serif text-3xl leading-tight">{section.title}</h2>
              <p className="mt-5 max-w-[58ch] whitespace-pre-line text-sm leading-7 text-muted">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        <aside className="mt-12 flex flex-col gap-5 border border-stroke bg-panel p-6 sm:flex-row sm:items-center sm:justify-between md:p-8">
          <div>
            <p className="label-caps text-accent">{t("service.contactTitle")}</p>
            <p className="mt-2 text-sm text-muted">{t("service.contactBody")}</p>
          </div>
          <ArtifactLink href="mailto:studio@synarava.com" variant="inverse" size="md">
            {t("service.contactCta")}
          </ArtifactLink>
        </aside>
      </div>
    </main>
  );
}

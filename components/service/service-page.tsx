import { ArtifactLink } from "@/components/ui";

type ServiceSection = {
  title: string;
  body: string;
};

type ServicePageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: ServiceSection[];
};

export function ServicePage({ eyebrow, title, intro, sections }: ServicePageProps) {
  return (
    <main className="artifact-shell min-h-screen bg-background pb-24 pt-32 text-foreground md:pt-40">
      <div className="site-shell">
        <header className="max-w-4xl border-b border-stroke pb-12 md:pb-16">
          <p className="label-caps text-accent">{eyebrow}</p>
          <h1 className="mt-5 text-balance font-serif text-[clamp(3.2rem,8vw,7rem)] leading-[0.9] tracking-[-0.04em]">
            {title}
          </h1>
          <p className="mt-7 max-w-2xl text-pretty text-base leading-8 text-muted md:text-lg">
            {intro}
          </p>
        </header>

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
            <p className="label-caps text-accent">Need a specific answer?</p>
            <p className="mt-2 text-sm text-muted">Tell us which product and destination you are considering.</p>
          </div>
          <ArtifactLink href="mailto:studio@synarava.com" variant="inverse" size="md">
            Contact the studio
          </ArtifactLink>
        </aside>
      </div>
    </main>
  );
}

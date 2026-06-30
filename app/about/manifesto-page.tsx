/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";

import { ArtifactButton } from "@/components/ui/artifact-button";
import { CapsLabel } from "@/components/ui/caps-label";
import { EditorialHeading } from "@/components/ui/editorial-heading";
import { MonoMeta } from "@/components/ui/mono-meta";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { getPageBySlug } from "@/lib/content/catalog";

export const metadata: Metadata = {
  title: "The Manifesto",
  description:
    "The editorial manifesto of Synarava — an act of preservation between the ancient Slavic soul and contemporary high fashion.",
  alternates: { canonical: "/about/manifesto" },
  openGraph: {
    url: "/about/manifesto",
    images: [
      {
        url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAsOpilx95kk9tsj12r0FFG2UFEpnvVCSCj8zjj1_un-K347C_bYyfjiBfHqVhN7zzUIZ6ozazQxs49HgYM0nwLxVV_V-oCjDAD6QJftXKg4uJF9VXZZMF7SnXTuGUbTcXPb8YpkhuyReJ5XbM6cmIPd1_ZewFgYq_eM3-SzvrzxvrGS91YDoHIO1EY-VONHmNa2LsvHgEWNqfyALYgIDXy_TuRnrTrcjodxqPvTs-9GvTow0A7s7QXartwC2wPcxedNcDYyDBOZOpL",
        width: 1200,
        height: 630,
        alt: "Synarava manifesto editorial",
      },
    ],
  },
};

const heritagePoints = [
  { index: "01", label: "Geometric purity" },
  { index: "02", label: "Material symbolism" },
  { index: "03", label: "Luxury as memory" },
];

const identityStats = [
  { value: "24", label: "Collections" },
  { value: "12", label: "Master artisans" },
  { value: "∞", label: "Heritage" },
];

export default async function ManifestoPage() {
  const page = await getPageBySlug("manifesto");
  const content = page?.content ?? {};

  return (
    <main className="artifact-shell relative overflow-hidden pt-24 md:pt-28">
      <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center opacity-[0.03]">
        <span className="font-serif text-[40vw] leading-none select-none">S</span>
      </div>

      {/* Section 1 — Hero */}
      <section className="site-shell relative z-10 flex min-h-screen flex-col justify-center py-16 md:py-24">
        <div className="artifact-grid">
          <div className="col-span-12 space-y-6 md:col-span-7 md:space-y-8">
            <MonoMeta className="text-accent">{content.eyebrow ?? "01 / Manifesto"}</MonoMeta>
            <h1 className="max-w-2xl font-serif text-[2.8rem] leading-none sm:text-[3.5rem] md:text-[5.5rem]">
              {page?.title ?? "The Soul of Belarusian Couture"}
            </h1>
            <p className="max-w-xl text-lg leading-8 text-foreground/70">
              {page?.excerpt ??
                "SYNARAVA is not jewelry. It is an act of preservation. Each piece is a material dialogue between the ancient Slavic soul and the rigor of contemporary high fashion."}
            </p>
          </div>

          <div className="col-span-12 md:col-span-5 md:pt-12">
            <div className="relative">
              <div className="aspect-[3/4] overflow-hidden bg-[color:var(--color-stone-beige)]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsOpilx95kk9tsj12r0FFG2UFEpnvVCSCj8zjj1_un-K347C_bYyfjiBfHqVhN7zzUIZ6ozazQxs49HgYM0nwLxVV_V-oCjDAD6QJftXKg4uJF9VXZZMF7SnXTuGUbTcXPb8YpkhuyReJ5XbM6cmIPd1_ZewFgYq_eM3-SzvrzxvrGS91YDoHIO1EY-VONHmNa2LsvHgEWNqfyALYgIDXy_TuRnrTrcjodxqPvTs-9GvTow0A7s7QXartwC2wPcxedNcDYyDBOZOpL"
                  alt="An atmospheric editorial artifact composition"
                  className="h-full w-full object-cover transition-transform duration-[3000ms] hover:scale-105"
                />
              </div>

              <div className="panel absolute -bottom-8 left-0 hidden p-6 md:block lg:-left-12 lg:p-8">
                <MonoMeta className="mb-2 block">Coord: 53.9° N, 27.5° E</MonoMeta>
                <CapsLabel className="text-muted">Minsk archive</CapsLabel>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Craftsmanship */}
      <section className="relative z-10 bg-[color:var(--color-linen)] py-16 md:py-24">
        <div className="site-shell">
          <div className="mb-16 flex flex-col gap-10 md:mb-24 md:flex-row md:items-end">
            <ScrollReveal className="w-full md:w-1/2" direction="left">
              <EditorialHeading className="mb-6 text-[2.2rem] md:mb-8 md:text-[3.2rem]">
                Hands of the Artisan
              </EditorialHeading>
              <div className="embroidery-separator mb-6 md:mb-8" />
              <p className="mb-8 text-lg leading-8 text-foreground/70 md:mb-12">
                The rhythm of the loom meets the precision of the goldsmith. Every bead is selected
                for its material honesty, lava stone for grounding, ceramic for purity, and
                hand-woven threads that carry the warmth of human touch. We reject the industrial
                pulse in favor of the human breath.
              </p>
              <ArtifactButton>View the process</ArtifactButton>
            </ScrollReveal>

            <ScrollReveal className="grid w-full grid-cols-2 gap-gutter md:w-1/2" direction="right" delay={150}>
              <div className="aspect-square overflow-hidden bg-[color:var(--color-stone-beige)]">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA1Q9Y5mTOg4JUp7ltbWF7UCVszQDvMhK4HkZeiKBH0sIaPUR-UTsap-qKNQrRxs3rB5Sowo82wlYmwo20D0nqr3Q4-7pfoZRCeaIDPtyLX3ZNXQP2Xz_nQCkprKPJvwx5TIja3QNWzei9N-hLk51vB7X_GuDh0Dtn3IRJ5H0M3pC8kYZjTik5LWwFsa8rBwH1PRScpi6BvuAPPBFPF1GUuoCg209ofG6zTPdWg2QGoWwmmKGn39ArL0g7Yf8IdHxBlM8rPqTOo4DIV"
                  alt="Artisan hands and threads"
                  className="h-full w-full object-cover grayscale transition-all duration-700 hover:grayscale-0"
                />
              </div>
              <div className="mt-10 aspect-square overflow-hidden bg-[color:var(--color-stone-beige)] md:mt-12">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuD7W843EHQdZY1jBm55opNlIRmN9QiRAMGmzyqF5zdXt2cwigQhhPV4qkXKAVtEaBfzwdxIpmBR2KOfDI2ymoCQvaPh_dNvuOGRdGSXTg0Nk2edENnTUcURfnB3uKsA53ByrmrUpL-UceWrVoGdW_31a6BwydIalVlC2sofkQtrybUuGmpNKQufRtbC-d-3eEV70YQZVGpjPvf8FUjpEmI3DWVcC1LpNQJJTwyJnvnaxErGyVGWp-5VFVIMQJiReO8VcV4dJQsO_axC"
                  alt="Raw jewelry materials in archive composition"
                  className="h-full w-full object-cover"
                />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* Section 3 — Heritage */}
      <section className="site-shell relative z-10 overflow-hidden py-20 md:py-32">
        <div className="pointer-events-none absolute right-0 top-0 -translate-y-12 translate-x-6 select-none opacity-[0.05] md:translate-x-[calc(var(--spacing-page-x-desktop))]">
          <span className="font-serif text-[5rem] leading-none md:text-[12rem]">
            HERITAGE
          </span>
        </div>

        <div className="artifact-grid items-center">
          <ScrollReveal className="col-span-12 space-y-6 md:order-2 md:col-span-5 md:space-y-8" direction="right">
            <MonoMeta className="text-accent">02 / Heritage</MonoMeta>
            <EditorialHeading className="text-[2.2rem] leading-tight md:text-[3.2rem]">
              From Ornament to Architecture
            </EditorialHeading>
            <p className="text-base leading-8 text-foreground/70 md:text-lg">
              The &quot;KOD RODA&quot; (Ancestral Code) is our foundational motif. Once found only on ceremonial linens, we have distilled its geometric essence into structural luxury. It is not a pattern; it is a cipher of resilience and identity.
            </p>
            <div className="mt-8 flex flex-col gap-5 md:mt-12">
              {heritagePoints.map((point, i) => (
                <ScrollReveal key={point.index} delay={i * 80} direction="none">
                  <div className="flex items-center gap-4">
                    <MonoMeta className="text-foreground/30">{point.index}</MonoMeta>
                    <CapsLabel>{point.label}</CapsLabel>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal className="relative col-span-12 md:order-1 md:col-span-6" direction="left" delay={100}>
            <div className="grid grid-cols-2 gap-4">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuB2bzj_Kwa15jaUTfnpQ74fpNyH8oR-ka1zPvi4y5EYwfqQGycU5PY7ov2VsofrBIraiU8YHmwXHaFFxfa54THQO5e7jbNdofGkc237LsCdRCuudHo3palaWRyr17uyHspNWYL2D3KZoWPIZVn1SO89RSDvBKhlFuOjdxcrmijL8FSYFy3_vkSTS0mReFPYKla38QSAfzGOi_BITgn_rwnCTbBz2vXrG3738a4AZEbxICC1QciJvVK3TQt5W6R4WpSQoo5HimIvoela"
                alt="Heritage textile and jewelry comparison"
                className="aspect-square w-full object-cover shadow-2xl"
              />
              <div className="flex aspect-square items-center justify-center bg-[color:var(--color-charcoal)] p-8 text-background md:p-12">
                <span className="text-5xl md:text-6xl">✦</span>
              </div>
            </div>

            {/* Floating caption — hidden on mobile to prevent overflow */}
            <div className="absolute -bottom-10 right-0 hidden h-36 w-36 items-center justify-center border border-[color:var(--color-border-subtle)] bg-background p-4 text-center sm:flex md:-bottom-12 md:-right-8 md:h-48 md:w-48">
              <CapsLabel className="text-[10px] tracking-[0.2em]">
                The evolution of the ancestral cipher
              </CapsLabel>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Section 4 — Identity */}
      <section className="relative z-10 bg-[color:var(--color-charcoal)] py-20 text-background md:py-40">
        <ScrollReveal className="site-shell max-w-4xl text-center" direction="none">
          <div className="mb-8 text-4xl text-[color:var(--color-stone-beige)] md:mb-12 md:text-5xl">✶</div>
          <h2 className="mb-8 font-serif text-[2.6rem] leading-none md:mb-12 md:text-[5rem]">
            Identity &amp; Memory
          </h2>
          <div className="mx-auto mb-8 h-px w-16 bg-[color:var(--color-couture-red)] md:mb-12 md:w-24" />
          <p className="mb-12 text-base leading-8 text-white/60 italic md:mb-16 md:text-lg">
            &quot;We do not inherit the earth from our ancestors; we borrow it from our children. We do the same with our stories. SYNARAVA is the vessel for the stories that refuse to be forgotten.&quot;
          </p>
          <div className="grid grid-cols-3 gap-6 border-t border-white/10 pt-12 md:gap-8 md:pt-16">
            {identityStats.map((stat) => (
              <div key={stat.label}>
                <p className="mb-2 font-serif text-[1.8rem] md:text-[2.4rem]">{stat.value}</p>
                <CapsLabel className="text-white/60">{stat.label}</CapsLabel>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </section>

      {/* Section 5 — Exhibition */}
      <section className="site-shell relative z-10 py-20 md:py-32">
        <div className="flex flex-col gap-gutter md:flex-row">
          <ScrollReveal className="group relative flex-1 overflow-hidden" direction="left">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHaoUd-Rm7sOtHmb7DqP0M9OBv7dVOeIrBaE0HeI7OBXaGfWpDZ-Rydjig7P70HXomp3svTh1hAwUXUsAVSBjU5XjcXsfg8B3AK0ZyL-1_ULgDFpb-5IemGJkyXlntN3f-ihPcc1u86fbTV48rKP9E6HYYe53wCujXW5Yy4jVQ7fvgqcipoQSMO0V7fwxVedwilASfgNwSlcTU4FHWCQyj2cT_-Uetg5LcpKBkJ0LbTtRcCKlG63G2PXW1UtqsGCgiQKVOZn1a-NUv"
              alt="Synarava exhibition gallery"
              className="aspect-[16/9] w-full object-cover transition-transform duration-1000 group-hover:scale-110 md:h-96 md:aspect-auto"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <button className="border border-white px-6 py-3 font-sans text-[0.76rem] font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-white hover:text-black">
                The calendar
              </button>
            </div>
          </ScrollReveal>

          <ScrollReveal className="flex flex-1 flex-col justify-center bg-[color:var(--color-stone-beige)]/30 p-8 md:p-12" direction="right" delay={120}>
            <h3 className="mb-4 font-serif text-[1.8rem] md:mb-6 md:text-[2.4rem]">
              Experience the Archive
            </h3>
            <p className="mb-6 text-base leading-8 text-foreground/70 md:mb-8">
              Our collections travel as exhibitions. Discover the physical presence of SYNARAVA in curated galleries from Minsk to Paris.
            </p>
            <Link href="/" className="label-caps flex items-center gap-2 text-accent">
              Upcoming exhibitions
              <span aria-hidden="true">→</span>
            </Link>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
}

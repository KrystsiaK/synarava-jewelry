/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";

import { ArtifactLink } from "@/components/ui/artifact-button";
import { ArtifactPanel } from "@/components/ui/artifact-panel";
import { BodyLead } from "@/components/ui/body-lead";
import { CapsLabel } from "@/components/ui/caps-label";
import { DividerOrnament } from "@/components/ui/divider-ornament";
import { EditorialHeading } from "@/components/ui/editorial-heading";
import { InfoList } from "@/components/ui/info-list";
import { MonoMeta } from "@/components/ui/mono-meta";
import { getPageBySlug } from "@/lib/content/catalog";

export const metadata: Metadata = {
  title: "About the Studio",
  description:
    "Learn about Synarava studio — its materials, process, and editorial point of view. Collectible jewelry rooted in Belarusian heritage.",
  alternates: { canonical: "/about" },
  openGraph: {
    url: "/about",
    images: [
      {
        url: "https://lh3.googleusercontent.com/aida-public/AB6AXuAsOpilx95kk9tsj12r0FFG2UFEpnvVCSCj8zjj1_un-K347C_bYyfjiBfHqVhN7zzUIZ6ozazQxs49HgYM0nwLxVV_V-oCjDAD6QJftXKg4uJF9VXZZMF7SnXTuGUbTcXPb8YpkhuyReJ5XbM6cmIPd1_ZewFgYq_eM3-SzvrzxvrGS91YDoHIO1EY-VONHmNa2LsvHgEWNqfyALYgIDXy_TuRnrTrcjodxqPvTs-9GvTow0A7s7QXartwC2wPcxedNcDYyDBOZOpL",
        width: 1200,
        height: 630,
        alt: "Synarava studio composition",
      },
    ],
  },
};

const principles = [
  {
    label: "Studio first",
    body: "Synarava is built as a small atelier with a fashion-editorial eye, not as a mass catalog of interchangeable accessories.",
  },
  {
    label: "Material honesty",
    body: "Wood should look like wood, lava like lava, ceramic like fired earth. The material carries meaning before ornament does.",
  },
  {
    label: "Wearable clarity",
    body: "Even when the symbolism runs deep, the object still needs to feel easy to wear, easy to understand, and easy to choose.",
  },
];

const infoItems = [
  { label: "What we make", value: "Bracelets, necklace studies, symbolic objects, and collection-led editorial releases." },
  { label: "How we work", value: "Small-batch production, material-first design, and story-led collections instead of endless product drops." },
  { label: "What matters", value: "Clarity of form, emotional durability, and a respectful link to Belarusian visual memory." },
];

export default async function AboutPage() {
  const page = await getPageBySlug("about");
  const content = page?.content ?? {};

  return (
    <main className="artifact-shell min-h-screen pt-28">
      <section className="site-shell section-space grid gap-14 lg:grid-cols-12 lg:items-end">
        <div className="space-y-8 lg:col-span-6">
          <div className="space-y-3">
            <MonoMeta>{content.eyebrow ?? "About the studio"}</MonoMeta>
            <h1 className="font-serif text-[3.8rem] leading-[0.92] md:text-[5.5rem]">
              {page?.title ?? "A jewelry studio shaped like an exhibition."}
            </h1>
          </div>
          <BodyLead>
            {page?.excerpt ??
              "Synarava makes collectible jewelry with a calm, editorial point of view. The brand sits between store and archive, pairing accessible product browsing with a deeper world of material stories, folk geometry, and atelier process."}
          </BodyLead>
          <div className="flex flex-wrap gap-4 pt-2">
            <ArtifactLink href={content.ctaHref ?? "/shop"} variant="primary">
              {content.ctaLabel ?? "Shop all products"}
            </ArtifactLink>
            <ArtifactLink href="/about/manifesto" variant="secondary">
              Read the manifesto
            </ArtifactLink>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative overflow-hidden bg-stone-beige">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsOpilx95kk9tsj12r0FFG2UFEpnvVCSCj8zjj1_un-K347C_bYyfjiBfHqVhN7zzUIZ6ozazQxs49HgYM0nwLxVV_V-oCjDAD6QJftXKg4uJF9VXZZMF7SnXTuGUbTcXPb8YpkhuyReJ5XbM6cmIPd1_ZewFgYq_eM3-SzvrzxvrGS91YDoHIO1EY-VONHmNa2LsvHgEWNqfyALYgIDXy_TuRnrTrcjodxqPvTs-9GvTow0A7s7QXartwC2wPcxedNcDYyDBOZOpL"
              alt="Synarava studio composition"
              className="aspect-[4/5] h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      <section className="bg-[color:var(--color-stone-beige)]/20 py-28">
        <div className="site-shell grid gap-10 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <CapsLabel className="text-muted">What kind of brand this is</CapsLabel>
            <EditorialHeading className="text-[2.5rem] md:text-[3.3rem]">
              A clear store first, with deeper editorial layers behind it.
            </EditorialHeading>
          </div>

          <div className="grid gap-6 lg:col-span-8 md:grid-cols-3">
            {principles.map((principle) => (
              <ArtifactPanel key={principle.label} className="grid gap-4 p-6">
                <CapsLabel className="text-accent">{principle.label}</CapsLabel>
                <p className="text-base leading-7 text-foreground/82">{principle.body}</p>
              </ArtifactPanel>
            ))}
          </div>
        </div>
      </section>

      <section className="site-shell py-32">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start">
          <div className="space-y-8 lg:col-span-5">
            <CapsLabel className="text-muted">How to use the site</CapsLabel>
            <EditorialHeading className="max-w-lg">
              Shop by product, browse by collection, learn through story.
            </EditorialHeading>
            <BodyLead className="max-w-xl">
              {content.secondaryBody ??
                "The idea is simple: if someone wants to buy, they should go to Shop. If they want the broader aesthetic context, they should go to Collections. If they want to understand the studio itself, they should come here. The manifesto remains available, but it no longer replaces the About page."}
            </BodyLead>
            <DividerOrnament />
            <InfoList items={infoItems} />
          </div>

          <div className="grid gap-8 lg:col-span-7">
            <ArtifactPanel className="grid gap-6 p-8 md:grid-cols-3">
              <div>
                <CapsLabel className="text-accent">Home</CapsLabel>
                <p className="mt-3 text-base leading-7 text-foreground/80">
                  Entry point into the brand and featured products.
                </p>
              </div>
              <div>
                <CapsLabel className="text-accent">Shop</CapsLabel>
                <p className="mt-3 text-base leading-7 text-foreground/80">
                  The practical product listing page with filters and direct product links.
                </p>
              </div>
              <div>
                <CapsLabel className="text-accent">Collections</CapsLabel>
                <p className="mt-3 text-base leading-7 text-foreground/80">
                  Editorial groupings that explain themes like Belarus Heritage or Earth Rituals.
                </p>
              </div>
            </ArtifactPanel>

            <div className="overflow-hidden bg-black/5">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHaoUd-Rm7sOtHmb7DqP0M9OBv7dVOeIrBaE0HeI7OBXaGfWpDZ-Rydjig7P70HXomp3svTh1hAwUXUsAVSBjU5XjcXsfg8B3AK0ZyL-1_ULgDFpb-5IemGJkyXlntN3f-ihPcc1u86fbTV48rKP9E6HYYe53wCujXW5Yy4jVQ7fvgqcipoQSMO0V7fwxVedwilASfgNwSlcTU4FHWCQyj2cT_-Uetg5LcpKBkJ0LbTtRcCKlG63G2PXW1UtqsGCgiQKVOZn1a-NUv"
                alt="Synarava exhibition-style space"
                className="aspect-[16/10] h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

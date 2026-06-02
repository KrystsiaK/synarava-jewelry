/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { getPageBySlug, listCollections } from "@/lib/content/catalog";

export const metadata: Metadata = {
  title: { absolute: "Synarava — Handcrafted Belarusian Couture Jewelry" },
  description:
    "Handcrafted jewelry that bridges ancient Slavic mysticism and contemporary architectural avant-garde. Explore our couture collections.",
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    images: [
      {
        url: "https://lh3.googleusercontent.com/aida-public/AB6AXuDnsVq-0rj6MUqa5fbd7AAEe7cTiEGdTbjaX0-QqyRfQDJrorZweFoBNZ9jrp4c5G9YxZY1YWEUDZj3h6LEwB8covlq0TcBcRfzSY4jFtqnYKLYse3lFNPVEc424F0tMy1wYDp092U7vCp5UzzIntBvw7JQ59n6WrUHpbCWeChOdTgF_4v06jNFD2JXKrfMDAkHrNMfBf0IPjfNxpQZ6r8uZbhg3XInDox3KcDlWb6Aph9_5uCM04fmHM8cLz5jVaCrlmvjRqx1YyIr",
        width: 1200,
        height: 630,
        alt: "Synarava — Belarusian Couture Jewelry",
      },
    ],
  },
};

const materials = [
  {
    label: "Oak Wood",
    description:
      "Sourced from fallen trees in the Belarusian hinterlands, our wood is stabilized for eternity, retaining the memory of the forest.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDORFzCaK5ga8pkzlAwZYWMU2z64gFNP5F_qwDv32eJ3MjiMxsQsff_uuJTlUH7zL4wu1o3r5uo3FwjWu-2kULI8AeWf4jN3BCC3KLJygyY4eLJDtWYfN6KfQK1VoAvgyKw8yKxohzATNUKxt2682K7sbMvqKgCgL15vee2GhfqyeTEmVHv2BKJZvhjxZyGgEb-V6xWeGKnG2xXMnVsD_NxXHUefb1dhoS1BSR2KG6BDDD3D1xNm6DWA4G2zsVnuhC47Hdg2zR0ZLbm",
  },
  {
    label: "Basalt Lava",
    description:
      "A symbol of earth's inner heat. Porous, raw, and grounding. Each stone is unique, hand-picked for its textural narrative.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDMgOKfd2_B3AIp_p0D3jKhJismvSHILQBQKi2Q8D9785qgaAk7HYETSyVpL8LofIPN4DFwdWvMlj5_CvPiB60Ou1aTpnidGu_O2CcYkFdAccdSzgShazbsFuXGMhOpgmChRJ1A-AOh1fzw4gGhrakpiI2Ybr128tZhUTAj4xKWn8fQJHc59mt_mxnc2cQ2Xf0UslNcUDSDogwEhx7FfqMhAxlYC-cMZlGxmTN4ps",
    offset: true,
  },
  {
    label: "White Ceramic",
    description:
      "Fired at extreme temperatures, our ceramic elements serve as a canvas for traditional geometric symbols of protection.",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB_a_1Phcz40zke_-Uel89PioA3qn5DrGc9p5jnbDgJbGZUOnbweh7Y1PLGrphzU4oGU0lWcSCW4fjvUS-AGMauldiFcZZBn9CT1A_xD-Ffvi7p-yryS4keihwtlufkMvDEjv7Zwd8PSn23AxafszUTm2gG65efEKoitFTlKPNgPDAE9L5uz32ktbiS_kHVEgkU5x5mjQ4HuhPL_WysRFSQq17EqPLTapMszcgnC6jOYYUFiaDuq2UZO-jJsLgA-MxchL9fGVpU9KWj",
  },
];

const symbolism = [
  { color: "bg-couture-red", label: "The Sun (Kola) — Energy & Life" },
  { color: "bg-charcoal", label: "The Earth (Ziamla) — Fertility & Origin" },
  { color: "bg-stone-beige", label: "The Ancestors (Dziedy) — Wisdom & Continuity" },
];

export default async function HomePage() {
  const [page, collectionData] = await Promise.all([getPageBySlug("home"), listCollections()]);
  const collections = collectionData.slice(0, 3).map((collection, index) => ({
    series: collection.eyebrow,
    title: collection.name,
    price: index === 0 ? "€240" : index === 1 ? "€185" : "€310",
    image: collection.heroImage,
    offset: index === 1,
    href: `/collections/${collection.slug}`,
  }));
  const content = page?.content ?? {};

  return (
    <main className="artifact-shell min-h-screen overflow-x-hidden">
      {/* Hero */}
      <header className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-0 pt-24 md:pt-20">
        <div className="pointer-events-none absolute inset-0 opacity-10">
          <div
            className="h-full w-full"
            style={{
              backgroundImage: "radial-gradient(circle, #A6192E 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        <div className="site-shell relative z-10 grid grid-cols-12 items-center gap-y-12">
          <div className="z-20 col-span-12 space-y-5 md:col-span-6 md:space-y-8">
            <p className="font-mono text-[0.82rem] uppercase tracking-[0.28em] text-couture-red">
              {content.eyebrow ?? "Couture Collection №01"}
            </p>
            <h1 className="font-serif text-[2.6rem] leading-[0.95] sm:text-[3.5rem] md:text-[5.5rem]">
              {page?.title?.split(" ").slice(0, 1).join(" ") ?? "Ethereal"} <br />{" "}
              {page?.title?.split(" ").slice(1).join(" ") ?? "Artifacts"}
            </h1>
            <p className="max-w-md text-base leading-7 text-foreground/70 md:text-lg md:leading-8">
              {page?.excerpt ??
                "Handcrafted jewelry that bridges the gap between ancient Slavic mysticism and the contemporary architectural avant-garde."}
            </p>
            <Link
              href={content.ctaHref ?? "/shop"}
              className="inline-block w-full bg-foreground px-8 py-4 text-center font-sans text-[0.76rem] font-semibold uppercase tracking-[0.15em] text-background transition-colors duration-500 hover:bg-couture-red hover:text-linen sm:w-auto sm:px-10 sm:py-5"
            >
              {content.ctaLabel ?? "Explore Archive"}
            </Link>
          </div>

          <div className="relative col-span-12 md:col-span-6">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-[20rem] sm:max-w-sm md:max-w-md">
              <img
                alt="SYNARAVA Bracelet"
                className="h-full w-full object-cover brightness-90 contrast-110 grayscale"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDnsVq-0rj6MUqa5fbd7AAEe7cTiEGdTbjaX0-QqyRfQDJrorZweFoBNZ9jrp4c5G9YxZY1YWEUDZj3h6LEwB8covlq0TcBcRfzSY4jFtqnYKLYse3lFNPVEc424F0tMy1wYDp092U7vCp5UzzIntBvw7JQ59n6WrUHpbCWeChOdTgF_4v06jNFD2JXKrfMDAkHrNMfBf0IPjfNxpQZ6r8uZbhg3XInDox3KcDlWb6Aph9_5uCM04fmHM8cLz5jVaCrlmvjRqx1YyIr"
              />
            </div>
            {/* Decorative diamond — hidden on very small screens to prevent overflow */}
            <div className="absolute -right-1 top-4 hidden h-28 w-28 items-center justify-center border border-charcoal/10 sm:flex sm:h-36 sm:w-36 md:-right-12 md:-top-12 md:h-48 md:w-48">
              <div className="flex h-24 w-24 rotate-45 items-center justify-center border border-couture-red">
                <div className="h-8 w-8 -rotate-45 border border-charcoal/10 sm:h-10 sm:w-10 md:h-12 md:w-12" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 flex-col items-center md:flex">
          <span className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em]">Scroll</span>
          <div className="h-24 w-px bg-charcoal/20" />
        </div>
      </header>

      {/* Manifesto Quote */}
      <section className="relative overflow-hidden bg-background py-16 md:py-32">
        <div className="site-shell">
          <div className="grid grid-cols-12 gap-6">
            <ScrollReveal className="col-span-12 text-center md:col-span-8 md:col-start-3">
              <span className="label-caps mb-6 block text-couture-red md:mb-8">The Manifesto</span>
              <h2 className="mb-8 font-serif text-[1.7rem] italic leading-snug md:mb-12 md:text-[3rem]">
                &ldquo;
                {content.quote ??
                  "We do not create accessories. We archive the soul of materials—wood that has witnessed centuries, stone that holds the earth's heat, and the silent rhythm of folk geometry."}
                &rdquo;
              </h2>
              <div className="flex items-center justify-center gap-4">
                <div className="h-px w-16 bg-stone-beige md:w-24" />
                <div className="h-2 w-2 rotate-45 border border-couture-red" />
                <div className="h-px w-16 bg-stone-beige md:w-24" />
              </div>
            </ScrollReveal>
          </div>
        </div>
        <div
          className="pointer-events-none absolute -right-20 top-1/2 -translate-y-1/2 select-none opacity-5"
          style={{ writingMode: "vertical-rl" }}
        >
          <span className="font-serif text-[6rem] leading-none md:text-[10rem]">BELARUSIAN FOLK COUTURE</span>
        </div>
      </section>

      {/* Collections Horizontal Scroll */}
      <section className="overflow-hidden pb-16 md:pb-32">
        <ScrollReveal className="site-shell mb-8 flex flex-col gap-4 md:mb-12 md:flex-row md:items-end md:justify-between" direction="none">
          <div>
            <p className="mb-2 font-mono text-[0.82rem] uppercase tracking-[0.14em] opacity-50">
              Collections 2024
            </p>
            <h3 className="font-serif text-[1.8rem] md:text-[2rem]">{content.secondaryTitle ?? "Current Archive"}</h3>
          </div>
          <Link
            href="/collections"
            className="label-caps w-fit border-b border-charcoal pb-2 transition-all hover:border-couture-red hover:text-couture-red"
          >
            View All Series
          </Link>
        </ScrollReveal>

        <div className="flex gap-4 overflow-x-auto pb-8 pl-5 pr-5 md:gap-6 md:pl-16 md:pr-16 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {collections.map((item, i) => (
            <ScrollReveal
              key={item.series}
              className={`w-[80vw] max-w-[22rem] flex-none md:w-[360px]${item.offset ? " md:mt-12" : ""}`}
              delay={i * 120}
            >
              <Link href={item.href} className="block w-full cursor-pointer group">
                <div className="mb-5 aspect-[3/4] overflow-hidden bg-stone-beige">
                  <img
                    alt={item.title}
                    className="h-full w-full object-cover grayscale transition-transform duration-1000 group-hover:scale-105"
                    src={item.image}
                  />
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="mb-1 font-mono text-[0.82rem] uppercase tracking-[0.14em] opacity-50">
                      {item.series}
                    </p>
                    <h4 className="font-serif text-[1.4rem] md:text-[1.6rem]">{item.title}</h4>
                  </div>
                  <span className="font-mono text-[0.82rem] uppercase tracking-[0.14em]">
                    {item.price}
                  </span>
                </div>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Material Philosophy — dark */}
      <section className="bg-foreground py-16 text-background md:py-32">
        <div className="site-shell">
          <div className="grid grid-cols-1 items-start gap-12 md:gap-24 md:grid-cols-3">
            {materials.map((mat, i) => (
              <ScrollReveal
                key={mat.label}
                className={`group${(mat as { offset?: boolean }).offset ? " md:mt-24" : i === 1 ? " md:mt-24" : ""}`}
                delay={i * 150}
              >
                <div className="mb-6 aspect-square w-full overflow-hidden grayscale transition-all duration-700 group-hover:grayscale-0">
                  <img alt={mat.label} className="h-full w-full object-cover" src={mat.image} />
                </div>
                <h5 className="label-caps mb-3 text-couture-red">{mat.label}</h5>
                <p className="text-base leading-8 opacity-70">{mat.description}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Mirror Installation */}
      <section className="relative flex min-h-[28rem] items-center justify-center overflow-hidden bg-surface py-16 md:h-[700px] md:py-0">
        <div className="absolute inset-0">
          <img
            alt="Gallery Space"
            className="h-full w-full object-cover opacity-20 grayscale"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBlRjmhQRA-wxjueCOYYPh4npb_AwMuPibdeIi2xBnyzR6aYtnPozn9EXkqQs10M5j72a9Atq1kDdq_5pSYtM-T0IB5fPIEHyJeAuFNam5J8DWrxnTvLIF7IBocQHDm2RM38UDGNVZkP5F-iaJ7Ak7cEckBiQiR5WlNdz2CQAOR_HNTAVMF6Ffgge-YsqtxlAnWX_NgFcmd9MEIUgbno4x7uc6zMgiJk8mH649KBJetEKbQkt75J8_hBuYsX8S7b7_cVJ0ytra6MdMc"
          />
        </div>
        <ScrollReveal className="relative z-10 max-w-4xl px-5 text-center" direction="none">
          <div className="mb-8 inline-block md:mb-12">
            <div
              className="relative z-10 flex h-24 w-24 items-center justify-center border border-charcoal/10 p-5 sm:h-32 sm:w-32 sm:p-6 md:h-48 md:w-48 md:p-8"
              style={{ backdropFilter: "blur(12px)", background: "rgba(249,248,246,0.7)" }}
            >
              <div className="flex h-full w-full rotate-45 items-center justify-center border border-couture-red">
                <span className="text-xl -rotate-45 md:text-2xl">✦</span>
              </div>
            </div>
          </div>
          <h2 className="mb-6 font-serif text-[1.9rem] md:mb-8 md:text-[3.2rem]">Reflections of Heritage</h2>
          <p className="mb-8 text-base leading-7 md:mb-12 md:text-lg md:leading-8">
            Visit our immersive installation at the National Art Center. A space where jewelry meets
            sculpture, and tradition meets the infinite.
          </p>
          <button className="label-caps w-full border border-foreground px-8 py-4 transition-all duration-500 hover:bg-foreground hover:text-background sm:w-auto sm:px-10 sm:py-5">
            Book Private Tour
          </button>
        </ScrollReveal>
      </section>

      {/* Heritage & Symbolism */}
      <section className="bg-background py-16 md:py-32">
        <div className="site-shell">
          <div className="flex flex-col items-center gap-10 md:gap-24 md:flex-row">
            <ScrollReveal className="w-full md:w-1/2" direction="left">
              <img
                alt="Traditional Craft"
                className="aspect-square w-full object-cover grayscale"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCvzmn_KZdPb6CdGEC3uL8HdtuKxg8WUf3LnoaVDDhPOT3gKrvfnVFQFxT8r0o_cdgcsE9aRgs9KAao94bSsLFBGwv591fMSL6P1nngA2_go2UMnAs0qWdxSv9bFVZd2q1Q9s46OGI_dNEYf-WCJ6XBMjJEvg-3LG3SL3xkyIEqiBcY4fASsetRU5jQHeUkZiSMoTqqINuUKXU7n7v2JvcGfdP89dHn_KKEazFy7mWTn9Jqmy3H4Jrd1-2-ZDTF9pZs81z7dip0gn"
              />
            </ScrollReveal>
            <ScrollReveal
              className="etched-glass relative z-10 w-full border border-charcoal/5 p-6 sm:p-8 md:-ml-32 md:mt-48 md:w-1/2 md:p-16"
              direction="right"
              delay={100}
            >
              <span className="mb-4 block font-mono text-[0.82rem] uppercase tracking-[0.14em] text-couture-red md:mb-6">
                03 // Symbolism
              </span>
              <h3 className="mb-6 font-serif text-[1.8rem] md:mb-8 md:text-[2.4rem]">The Geometry of Protection</h3>
              <p className="mb-6 text-base leading-7 text-foreground/80 md:mb-8 md:text-lg md:leading-8">
                Every pattern is a word. Every knot is a prayer. We integrate ancestral embroidery
                motifs into modern jewelry designs, transforming adornment into a talisman for the
                modern world.
              </p>
              <ul className="space-y-3 font-mono text-[0.82rem] uppercase tracking-[0.14em]">
                {symbolism.map((pt) => (
                  <li key={pt.label} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rotate-45 shrink-0 ${pt.color}`} />
                    <span>{pt.label}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </main>
  );
}

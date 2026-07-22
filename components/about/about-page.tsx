/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef } from "react";

import { PrimaryCtaButton } from "@/components/ui";
import {
  KodRodaStatic,
  KolaStatic,
  ZiamlaStatic,
} from "@/components/ui/folk-patterns";

const ease = [0.22, 1, 0.36, 1] as const;
const scrollSpring = { stiffness: 72, damping: 22, mass: 0.7 } as const;

const HERO_POSTER = "/videos/model-hero-section.png";
const HERO_VIDEO = "/videos/Man_bracelet_hero_web.mp4";
const MATERIAL_VIDEO = "/videos/synarava-materials.mp4";
const CUFF_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCBX63WCgWtPnScacT2NdSX0EXxTLNA95jHIIkVfY1Fhxfa_tNgorlYdDTKcQu28PFCfFxuVr2dfa__XKYWebZyvt6mCthqPE0YN8c8QpKX4Ge6z363LyMizVS2x-rcrcmGIrzR9ExiDST3DRKgZJ8xhXOwA3ZmFWhCH6OC-Zcq8mpEyCNnt-Pi2r2PyfKB5bOGVAM9azkLweV_1zkNAJ7xShSTvruw5sNV_WDWHMrtNa_lT8dT3iVBFC2XV1rjXB8UI1Iw6uz5xpV3";
const HERITAGE_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCeoC4s0GytU2DJHgrs3Y0VtvzJzV8XnZqdlM-zu7Pj5SOSNmgf2fH0UUWquiyWXIKpNLyYe7uIZO3_8XVObSjX88ucZFaSmB7RmcgsRhsPnG7tPGc0n0_G6K7x3a5mstC1CRokMdByQ5QzcXX2nFedtwx42wOm2YsJwOSo6OzbspMc5J8qdpMsI2dZi4z_wUwpmA0QdXlFyhLvOkujl25D4nxEsU7IcGhDLxyZA3K6CO9_k9Sx1YFGtL1eqQjnZEl_HFLyG9-8uxkN";
const DARK_IMAGE =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCt_d_ebEGOWp1ihdn9E9rOzPoAp47x8VK2oL2u1osFvrQrI82dVRunrsFTkmF6e79LX4G83igcALJUo5v5SceK_LnOAXpuLcDGxmdguwDbzYZfYfT4Kk-H2rFkGCuvXFHelznWeIfm0Cz4PhL0-R3AdSg-sflr3SXMGyiug95M4h2kaYuM_QxNL-4sy_cYB6svoR3ufc6WqLHbzfRc2go7AndpuUWUDAsC6jmigW4FSDC2IrDbxXCxpbXO78mXwNxpHUWKfTI1Efka";

const CHAPTERS = [
  {
    number: "01",
    eyebrow: "Material before ornament",
    title: "Honest matter",
    italic: "keeps its voice.",
    body: "Lava stays porous. Oak keeps its grain. Ceramic carries the trace of the hand. We compose with what a material already knows instead of disguising it.",
    image: "/uploads/home/wood-lava-hero.jpg",
    Symbol: ZiamlaStatic,
  },
  {
    number: "02",
    eyebrow: "Memory without costume",
    title: "The past is a",
    italic: "living language.",
    body: "Belarusian geometry enters through rhythm, proportion, and coded detail. Heritage is not copied; it is translated into pieces that belong to the present.",
    image: HERITAGE_IMAGE,
    Symbol: KodRodaStatic,
  },
  {
    number: "03",
    eyebrow: "Made to leave the archive",
    title: "An object becomes",
    italic: "personal in use.",
    body: "The work is complete only on a body. Weight, movement, touch, and daily wear turn an edition into something intimate and entirely your own.",
    image: CUFF_IMAGE,
    Symbol: KolaStatic,
  },
] as const;

function AboutHero({
  title,
  excerpt,
  eyebrow,
  ctaHref,
  ctaLabel,
  heroVideoSrc,
}: {
  title: string;
  excerpt: string;
  eyebrow: string;
  ctaHref: string;
  ctaLabel: string;
  heroVideoSrc: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const smooth = useSpring(scrollYProgress, scrollSpring);
  const imageScale = useTransform(smooth, [0, 1], [1.02, 1.12]);
  const copyY = useTransform(smooth, [0, 0.75], [0, -80]);
  const copyOpacity = useTransform(smooth, [0, 0.62], [1, 0]);

  return (
    <header
      ref={ref}
      className="relative flex min-h-[100svh] items-end overflow-hidden bg-[#08090b] text-[#f2efe9]"
    >
      <motion.div
        className="absolute inset-0"
        style={{ scale: reduceMotion ? 1 : imageScale }}
      >
        <video
          className="h-full w-full object-cover object-[58%_center]"
          autoPlay={!reduceMotion}
          muted
          loop
          playsInline
          poster={HERO_POSTER}
          aria-hidden="true"
        >
          <source src={heroVideoSrc} type="video/mp4" />
        </video>
      </motion.div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,10,.15)_0%,rgba(7,8,10,.22)_35%,rgba(7,8,10,.94)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,10,.52),transparent_62%)]" />

      <motion.div
        className="site-shell relative z-10 grid w-full grid-cols-1 gap-8 pb-12 pt-40 md:grid-cols-12 md:pb-16"
        style={{
          y: reduceMotion ? 0 : copyY,
          opacity: reduceMotion ? 1 : copyOpacity,
        }}
      >
        <div className="md:col-span-9 xl:col-span-8">
          <motion.p
            className="mb-5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#d65b7a]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            {eyebrow} · Minsk / Belarus
          </motion.p>
          <motion.h1
            className="max-w-[12ch] font-serif text-[clamp(3.25rem,8.2vw,7.6rem)] leading-[0.84] tracking-[-0.04em]"
            initial={{ opacity: 0, y: 36 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.08, ease }}
          >
            {title}
          </motion.h1>
        </div>

        <motion.div
          className="flex flex-col items-start gap-6 md:col-span-5 md:col-start-8 md:items-end"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, delay: 0.42, ease }}
        >
          <p className="max-w-md text-sm leading-[1.75] text-[#f2efe9]/68 md:text-right md:text-base">
            {excerpt}
          </p>
          <PrimaryCtaButton href={ctaHref}>{ctaLabel}</PrimaryCtaButton>
        </motion.div>

        <div className="mt-2 flex items-center gap-3 text-[0.62rem] uppercase tracking-[0.24em] text-white/45 md:col-span-4">
          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          Scroll to enter the studio
        </div>
      </motion.div>
    </header>
  );
}

function Manifesto({ secondaryBody }: { secondaryBody: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#0a0a0b] py-24 text-[#eeeae3] md:py-40">
      <div className="site-shell grid grid-cols-1 gap-16 md:grid-cols-12 md:items-center">
        <div className="md:col-span-7">
          <motion.p
            className="font-serif text-[clamp(2.8rem,6.3vw,6.7rem)] leading-[0.92] tracking-[-0.04em]"
            initial={{ opacity: 0, y: 38 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease }}
          >
            Not nostalgia.
            <br />
            Not decoration.
            <br />
            <em className="font-normal text-[#d45c7b]">A material memory.</em>
          </motion.p>
        </div>

        <motion.div
          className="md:col-span-4 md:col-start-9"
          initial={{ opacity: 0, y: 26 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, delay: 0.22, ease }}
        >
          <div className="mb-8 h-px w-full bg-white/18" />
          <p className="text-base leading-[1.9] text-white/62">{secondaryBody}</p>
          <Link
            href="/about/manifesto"
            className="mt-9 inline-flex items-center gap-3 border-b border-white/20 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white transition-colors hover:border-[#d45c7b] hover:text-[#d45c7b]"
          >
            Read the full manifesto <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

function Chapter({ chapter }: { chapter: (typeof CHAPTERS)[number] }) {
  const { Symbol } = chapter;
  return (
    <article className="relative h-full w-[88vw] shrink-0 overflow-hidden bg-[#111216] sm:w-[78vw] md:w-screen">
      <img
        src={chapter.image}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,10,.92)_0%,rgba(7,8,10,.68)_48%,rgba(7,8,10,.16)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(7,8,10,.65),transparent_54%)]" />
      <Symbol className="absolute -right-12 top-1/2 h-[44vw] w-[44vw] -translate-y-1/2 text-white/[0.07]" />

      <div className="relative z-10 flex h-full max-w-3xl flex-col justify-between p-7 pb-10 pt-24 sm:p-12 sm:pt-28 md:p-16 md:pt-36 lg:p-24 lg:pt-40">
        <div className="flex items-center gap-5">
          <span className="font-serif text-4xl text-[#d45c7b]">{chapter.number}</span>
          <span className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-white/62">
            {chapter.eyebrow}
          </span>
        </div>
        <div>
          <h3 className="max-w-[9ch] font-serif text-[clamp(2.6rem,5.4vw,6.4rem)] leading-[0.88] tracking-[-0.04em] text-[#f2efe9]">
            {chapter.title} <em className="font-normal text-[#d45c7b]">{chapter.italic}</em>
          </h3>
          <p className="mt-8 max-w-xl text-sm leading-[1.85] text-white/68 md:text-base">
            {chapter.body}
          </p>
        </div>
      </div>
    </article>
  );
}

function ScrollChapters() {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, scrollSpring);
  const x = useTransform(progress, [0, 1], ["0%", "-66.6667%"]);

  return (
    <>
      <section className="bg-[#08090b] px-4 py-16 text-white md:hidden">
        <div className="mb-8 flex items-end justify-between px-2">
          <div>
            <p className="text-[0.62rem] uppercase tracking-[0.24em] text-[#d45c7b]">Studio principles</p>
            <h2 className="mt-3 font-serif text-4xl">Three acts</h2>
          </div>
          <span className="text-[0.6rem] uppercase tracking-[0.2em] text-white/40">Swipe</span>
        </div>
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHAPTERS.map((chapter) => (
            <div key={chapter.number} className="h-[72svh] snap-center">
              <Chapter chapter={chapter} />
            </div>
          ))}
        </div>
      </section>

      <section ref={ref} className="relative hidden h-[400vh] bg-[#08090b] md:block">
        <div className="sticky top-0 h-screen overflow-hidden">
          <div className="pointer-events-none absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-8 pt-28 lg:px-12">
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.24em] text-white/62">
              Studio principles / scroll to move
            </p>
            <p className="font-serif text-xl text-white/48">01 — 03</p>
          </div>
          <motion.div
            className="absolute left-0 top-0 z-20 h-px w-full origin-left bg-[#d45c7b]"
            style={{ scaleX: reduceMotion ? 1 : progress }}
          />
          <motion.div
            className="flex h-full w-[300vw]"
            style={{ x: reduceMotion ? "-66.6667%" : x }}
          >
            {CHAPTERS.map((chapter) => (
              <Chapter chapter={chapter} key={chapter.number} />
            ))}
          </motion.div>
        </div>
      </section>
    </>
  );
}

function OnTheBody({ materialVideoSrc }: { materialVideoSrc: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const reduceMotion = useReducedMotion();

  return (
    <section ref={ref} className="relative min-h-[100svh] overflow-hidden bg-[#0a0a0b] text-white">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        poster={HERO_POSTER}
        aria-hidden="true"
      >
        <source src={materialVideoSrc} type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,11,.22),rgba(8,9,11,.92))]" />

      <div className="site-shell relative z-10 flex min-h-[100svh] flex-col justify-between py-28 md:py-36">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease }}
        >
          <p className="text-[0.64rem] font-semibold uppercase tracking-[0.24em] text-[#d45c7b]">The object in motion</p>
        </motion.div>

        <motion.div
          className="max-w-4xl"
          initial={{ opacity: 0, y: 42 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, delay: 0.16, ease }}
        >
          <h2 className="font-serif text-[clamp(3rem,7vw,7rem)] leading-[0.88] tracking-[-0.04em]">
            Jewelry is not still.
            <br />
            <em className="font-normal text-[#d45c7b]">It remembers touch.</em>
          </h2>
          <p className="mt-8 max-w-lg text-sm leading-[1.85] text-white/68 md:text-base">
            Every decision is tested against the body: how the piece catches light, how it settles, and how its materials change through wear.
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function FinalInvitation() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <section ref={ref} className="relative overflow-hidden bg-[#0a0a0b] py-28 text-[#f2efe9] md:py-44">
      <img
        src={DARK_IMAGE}
        alt="Dark symbolic Synarava bracelet"
        className="absolute -right-[10%] top-1/2 h-[72%] w-[62%] -translate-y-1/2 object-cover opacity-32 grayscale md:w-[48%]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#0a0a0b_28%,rgba(10,10,11,.78)_62%,#0a0a0b)]" />

      <div className="site-shell relative z-10">
        <motion.p
          className="max-w-5xl font-serif text-[clamp(3.2rem,7.8vw,7.8rem)] leading-[0.86] tracking-[-0.04em]"
          initial={{ opacity: 0, y: 44 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 1, ease }}
        >
          The archive is not a room.
          <br />
          <em className="font-normal text-[#d45c7b]">It is what you carry.</em>
        </motion.p>
        <motion.div
          className="mt-12 flex flex-col items-start gap-5 sm:flex-row sm:items-center"
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.24, ease }}
        >
          <PrimaryCtaButton href="/shop">Enter the collection</PrimaryCtaButton>
          <Link
            href="/collections"
            className="inline-flex items-center gap-3 border-b border-white/20 px-1 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-white hover:border-[#d45c7b] hover:text-[#d45c7b]"
          >
            Browse the worlds <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

export function AboutPage({
  title,
  excerpt,
  eyebrow,
  ctaHref,
  ctaLabel,
  secondaryBody,
  heroVideoSrc = HERO_VIDEO,
  materialVideoSrc = MATERIAL_VIDEO,
}: {
  title: string;
  excerpt: string;
  eyebrow: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryBody: string;
  heroVideoSrc?: string;
  materialVideoSrc?: string;
}) {
  return (
    <main className="about-experience min-h-screen overflow-x-clip bg-[#08090b]">
      <AboutHero
        title={title}
        excerpt={excerpt}
        eyebrow={eyebrow}
        ctaHref={ctaHref}
        ctaLabel={ctaLabel}
        heroVideoSrc={heroVideoSrc}
      />
      <Manifesto secondaryBody={secondaryBody} />
      <ScrollChapters />
      <OnTheBody materialVideoSrc={materialVideoSrc} />
      <FinalInvitation />
    </main>
  );
}

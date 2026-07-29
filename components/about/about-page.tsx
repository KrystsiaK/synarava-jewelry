"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import { PerformanceVideo } from "@/components/media/performance-video";
import { PrimaryCtaButton } from "@/components/ui";

const ease = [0.22, 1, 0.36, 1] as const;

type AboutPageProps = {
  title: string;
  excerpt: string;
  eyebrow: string;
  ctaHref: string;
  ctaLabel: string;
  secondaryTitle?: string;
  secondaryBody: string;
  quote?: string;
  heroVideoSrc?: string;
  heroImage?: string;
  materialVideoSrc?: string;
};

function AboutHero({
  title,
  excerpt,
  eyebrow,
  ctaHref,
  ctaLabel,
  heroVideoSrc,
  heroImage,
}: Pick<
  AboutPageProps,
  "title" | "excerpt" | "eyebrow" | "ctaHref" | "ctaLabel" | "heroVideoSrc" | "heroImage"
>) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="relative flex min-h-[100svh] items-end overflow-hidden bg-[#08090b] text-[#f2efe9]">
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={reduceMotion ? undefined : { scale: [1.02, 1.08] }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
      >
        {heroImage ? (
          <Image
            src={heroImage}
            alt=""
            fill
            preload
            sizes="100vw"
            quality={85}
            className="object-cover object-center"
            aria-hidden="true"
          />
        ) : heroVideoSrc ? (
          <PerformanceVideo
            src={heroVideoSrc}
            eager
            className="h-full w-full object-cover"
            autoPlay={!reduceMotion}
            muted
            loop
            playsInline
            aria-hidden="true"
          />
        ) : null}
      </motion.div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,8,10,.18),rgba(7,8,10,.96))]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,8,10,.58),transparent_68%)]" />

      <div className="site-shell relative z-10 grid w-full gap-8 pb-14 pt-40 md:grid-cols-12 md:pb-20">
        <motion.div
          className="md:col-span-9"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
        >
          {eyebrow ? (
            <p className="mb-5 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#d65b7a]">
              {eyebrow}
            </p>
          ) : null}
          {title ? (
            <h1 className="max-w-[12ch] font-serif text-[clamp(3.25rem,8.2vw,7.6rem)] leading-[0.84] tracking-[-0.04em]">
              {title}
            </h1>
          ) : null}
        </motion.div>

        <motion.div
          className="md:col-span-5 md:col-start-8"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.18, ease }}
        >
          {excerpt ? <p className="text-base leading-8 text-white/70">{excerpt}</p> : null}
          {ctaHref && ctaLabel ? (
            <div className="mt-8">
              <PrimaryCtaButton href={ctaHref}>{ctaLabel}</PrimaryCtaButton>
            </div>
          ) : null}
        </motion.div>
      </div>
    </header>
  );
}

function StudioCopy({
  title,
  body,
}: {
  title?: string;
  body: string;
}) {
  if (!title && !body) return null;

  return (
    <section className="bg-[#f0ede7] py-24 text-[#111114] md:py-40">
      <div className="site-shell grid gap-10 md:grid-cols-12">
        {title ? (
          <h2 className="text-balance font-serif text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.035em] md:col-span-7">
            {title}
          </h2>
        ) : null}
        {body ? (
          <p className="max-w-xl text-pretty text-base leading-8 text-black/68 md:col-span-5 md:pt-4 md:text-lg">
            {body}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MovementStory({
  title,
  videoSrc,
}: {
  title?: string;
  videoSrc?: string;
}) {
  const reduceMotion = useReducedMotion();
  if (!title || !videoSrc) return null;

  return (
    <section className="relative min-h-[100svh] overflow-hidden bg-[#0a0a0b] text-white">
      <PerformanceVideo
        src={videoSrc}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,9,11,.22),rgba(8,9,11,.92))]" />
      <div className="site-shell relative z-10 flex min-h-[100svh] items-end py-28 md:py-36">
        <h2 className="max-w-4xl font-serif text-[clamp(3rem,7vw,7rem)] leading-[0.88] tracking-[-0.04em]">
          {title}
        </h2>
      </div>
    </section>
  );
}

export function AboutPage(props: AboutPageProps) {
  return (
    <main className="about-experience min-h-screen overflow-x-clip bg-[#08090b]">
      <AboutHero
        title={props.title}
        excerpt={props.excerpt}
        eyebrow={props.eyebrow}
        ctaHref={props.ctaHref}
        ctaLabel={props.ctaLabel}
        heroVideoSrc={props.heroVideoSrc}
        heroImage={props.heroImage}
      />
      <StudioCopy title={props.secondaryTitle} body={props.secondaryBody} />
      <MovementStory title={props.quote} videoSrc={props.materialVideoSrc} />
    </main>
  );
}

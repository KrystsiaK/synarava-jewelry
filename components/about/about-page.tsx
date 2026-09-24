"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";

import { PerformanceVideo } from "@/components/media/performance-video";
import { VideoPlaybackButton } from "@/components/media/video-playback-button";
import { PrimaryCtaButton } from "@/components/ui";
import { useVideoPlayback } from "@/lib/hooks/use-video-playback";
import { resolveHeroBackdrop } from "@/lib/media/hero-media";

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
  heroVideoSrc,
  heroImage,
}: Pick<AboutPageProps, "title" | "excerpt" | "eyebrow" | "heroVideoSrc" | "heroImage">) {
  const reduceMotion = useReducedMotion();
  const { videoRef, isPlaying, onPlay, onPause, toggle } = useVideoPlayback(Boolean(reduceMotion));
  const backdrop = resolveHeroBackdrop({ videoSrc: heroVideoSrc, imageSrc: heroImage });

  return (
    <header data-component="AboutHero" className="about-hero relative flex min-h-[100svh] items-end overflow-hidden bg-background text-foreground">
      <motion.div
        className="absolute inset-0"
        initial={false}
        animate={reduceMotion ? undefined : { scale: [1.02, 1.08] }}
        transition={{ duration: 12, ease: "linear", repeat: Infinity, repeatType: "mirror" }}
      >
        {backdrop.mode === "video" ? (
          <PerformanceVideo
            ref={videoRef}
            src={backdrop.sources[0]}
            poster={backdrop.poster}
            eager
            className="h-full w-full object-cover"
            autoPlay={!reduceMotion}
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            onPlay={onPlay}
            onPause={onPause}
          />
        ) : backdrop.mode === "image" ? (
          <Image
            src={backdrop.src}
            alt=""
            fill
            preload
            sizes="100vw"
            quality={85}
            className="object-cover object-center"
            aria-hidden="true"
          />
        ) : null}
      </motion.div>

      {backdrop.mode === "video" ? (
        <VideoPlaybackButton isPlaying={isPlaying} onToggle={toggle} className="absolute right-4 top-28 z-20 grid size-11 place-items-center border border-white/35 bg-black/45 text-white transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />
      ) : null}

      <div className="about-hero-overlay absolute inset-0" />

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
          {excerpt ? <p className="text-base leading-8 text-foreground/70">{excerpt}</p> : null}
        </motion.div>
      </div>
    </header>
  );
}

function AboutCopy({
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  title?: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  if (!title && !body) return null;

  return (
    <section data-component="AboutCopy" className="bg-surface py-24 text-foreground md:py-40">
      <div className="site-shell grid gap-10 md:grid-cols-12">
        {title ? (
          <h2 className="text-balance font-serif text-[clamp(3rem,7vw,6.5rem)] leading-[0.9] tracking-[-0.035em] md:col-span-7">
            {title}
          </h2>
        ) : null}
        {body ? (
          <p className="max-w-xl text-pretty text-base leading-8 text-foreground/68 md:col-span-5 md:pt-4 md:text-lg">
            {body}
          </p>
        ) : null}
        {ctaHref && ctaLabel ? (
          <div className="md:col-span-12">
            <PrimaryCtaButton href={ctaHref}>{ctaLabel}</PrimaryCtaButton>
          </div>
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
  const { videoRef, isPlaying, onPlay, onPause, toggle } = useVideoPlayback(Boolean(reduceMotion));
  if (!title || !videoSrc) return null;

  return (
    <section data-component="MovementStory" className="about-movement relative min-h-[100svh] overflow-hidden bg-background text-foreground">
      <PerformanceVideo
        ref={videoRef}
        src={videoSrc}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        onPlay={onPlay}
        onPause={onPause}
      />
      <div className="about-movement-overlay absolute inset-0" />
      <VideoPlaybackButton isPlaying={isPlaying} onToggle={toggle} className="absolute right-4 top-4 z-20 grid size-11 place-items-center border border-white/35 bg-black/45 text-white transition-colors hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" />
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
    <main data-component="AboutPage" className="about-experience min-h-screen overflow-x-clip bg-background text-foreground">
      <AboutHero
        title={props.title}
        excerpt={props.excerpt}
        eyebrow={props.eyebrow}
        heroVideoSrc={props.heroVideoSrc}
        heroImage={props.heroImage}
      />
      <AboutCopy
        title={props.secondaryTitle}
        body={props.secondaryBody}
        ctaHref={props.ctaHref}
        ctaLabel={props.ctaLabel}
      />
      <MovementStory title={props.quote} videoSrc={props.materialVideoSrc} />
    </main>
  );
}

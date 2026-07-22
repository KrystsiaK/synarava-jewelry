"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  cubicBezier,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import { ease } from "@/lib/animation";
import { useTranslations } from "@/lib/i18n/context";
import { PrimaryCtaButton } from "@/components/ui";

export interface CollectionItem {
  series: string;
  title: string;
  price: string;
  image: string;
  href: string;
}

export interface HomePageProps {
  title?: string;
  excerpt?: string;
  content?: Record<string, string>;
  collections: CollectionItem[];
  heroVideoSrc?: string | string[];
}

const HERO_IMAGE = "https://lh3.googleusercontent.com/aida/AP1WRLv3TGm4IeeKlLUiQxW8Hc3nSncMdMHyfmCzU9wpUE4H6DZ2__vML46WGDGCpf_R3lcpvCQiTRGvLXUF72WHO40QXtyITJqlFUXF42Q0ZuzCsAnsWC58PasoEcf9X6NnNz6m7Q5HwKljf6J9CwLDdNGADnKbaeLw3oBsfyBLFxuVOlns79WfDTYP7_JMzXnpBxNSiz1lGPIE0IZJd63qtBQT0-0TohGViEDXlnUdhoYktnLq3ii4UwcQck8";
const HERO_VIDEOS = [
  "/videos/synarava-beads.mp4",
  "/videos/Model_woomen_hero.mp4",
  "/videos/Man_bracelet_hero_web.mp4",
  "/videos/synarava-materials.mp4",
] as const;
const HERO_POSTER = "/videos/model-hero-section.png";
const LAVA_CONSTRUCT_IMAGE = "https://lh3.googleusercontent.com/aida/AP1WRLvg_bkn6bvxAkNEsIJ5_yzxXX6ldISFGygqcEk3uncUMoan5A52LxZ4eGlil6FLlWw9sVu8RRFFF841LexUxAHrcbNkv3_ukNq0Iee8cDZS1iRCuh1tNVzLW7Tjx6LqWy9uGeWeBi9kTJck5aon69PCAQDX2wMZfpl36XxA0K5u92ZVEXAA6HgwCF4ioCIqBRtDNsoFdUq7qD8mpU76aYNOb4c-LmDOYw_fy0NYMf9LS53FM1RER28T_Ww";
const FRACTURED_QUARTZ_IMAGE = "https://lh3.googleusercontent.com/aida-public/AB6AXuChB26VkIkJfAS3suudP3zDdmZoI0ZbrsARVGw6isbyHNWuyApo5Z0x9Jd8gAWIJbUnjblDLmLwSsQc-TTeAgpKirYU7FiWgEHg1gprSFl-1XSsQCCOYpzhtXBZNT_UUmNcC8gmjNVdCkLXrvzY7ITzxE0pxjuv8hfnnni6al-gOWHc9n98SpVBkAy3MY1-zmS7Pa-g92ROigpPArvsBAgZ4ErsYKcE_PoEY_yrJXrFGI2cNQ2Ur7U-h1APrD8MLZJCnN6t_RD0E30";

const LEXICON_MATERIALS = [
  {
    name: "White Ceramic",
    category: "Kiln Fired / Matte",
    description: "Unglazed porcelain, hand-shaped to retain subtle human imperfections before high-heat vitrification. Analyzed for structural integrity and tactile response. The matte surface absorbs light, providing a stark contrast to highly polished metals.",
    image: FRACTURED_QUARTZ_IMAGE,
    symbol: "CER / 01",
    properties: ["Vitrified", "Light-absorbing", "Hand-shaped"],
  },
  {
    name: "Ancient Oak",
    category: "Petrified / Dense",
    description: "Reclaimed timber submerged for centuries, yielding a density approaching stone. Carbon dating confirmed. The natural grain is preserved, yet the material behaves with the unyielding strength of mineral composites.",
    image: HERO_IMAGE,
    symbol: "OAK / 02",
    properties: ["300+ years", "Carbon-rich", "Grain intact"],
  },
  {
    name: "Raw Obsidian",
    category: "Volcanic / Porous",
    description: "Rapidly cooled volcanic glass, resulting in a vesicular texture. Extremely lightweight yet structurally sound. The porous nature creates a micro-landscape on the surface of each bead, absorbing ambient sound and reflecting a deep, matte blackness.",
    image: LAVA_CONSTRUCT_IMAGE,
    symbol: "OBS / 03",
    properties: ["Volcanic glass", "Micro-porous", "Sound-softening"],
  }
];

const STAMP_CLASS = "border-[3px] border-couture-red text-couture-red px-4 py-2 inline-block uppercase font-bold tracking-[0.2em] bg-[#0a0a0b] select-none shadow-sm";

const SCROLL_SPRING = {
  stiffness: 92,
  damping: 26,
  mass: 0.42,
  restDelta: 0.0005,
} as const;

const MATERIAL_LAB_SPRING = {
  stiffness: 72,
  damping: 20,
  mass: 0.75,
  restDelta: 0.0005,
} as const;

const FINAL_SCENE_SPRING = {
  stiffness: 80,
  damping: 17,
  mass: 0.6,
  restDelta: 0.0005,
} as const;

const FINAL_SCENE_EASE = cubicBezier(0.33, 0, 0.2, 1);

type HomeScrollOffset =
  | "cover"
  | "hero"
  | "sticky"
  | "record-exit";

interface HomeScrollContextValue {
  scrollY: MotionValue<number>;
  isIOSWebKit: boolean;
}

const HomeScrollContext = createContext<HomeScrollContextValue | null>(null);

function ActiveHomeScrollProvider({ children }: { children: ReactNode }) {
  const { scrollY } = useScroll();
  const value = useMemo(() => ({ scrollY, isIOSWebKit: false }), [scrollY]);

  return <HomeScrollContext.Provider value={value}>{children}</HomeScrollContext.Provider>;
}

function IOSHomeScrollProvider({ children }: { children: ReactNode }) {
  // iOS WebKit keeps page scrolling on its compositor thread only while JS
  // isn't scrubbing a graph of MotionValues on every touch-scroll frame.
  const scrollY = useMotionValue(0);
  const value = useMemo(() => ({ scrollY, isIOSWebKit: true }), [scrollY]);

  return <HomeScrollContext.Provider value={value}>{children}</HomeScrollContext.Provider>;
}

function isIOSWebKitBrowser() {
  if (typeof navigator === "undefined") return false;

  const appleMobileDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const touchEnabledIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return appleMobileDevice || touchEnabledIPad;
}

function HomeScrollProvider({ children }: { children: ReactNode }) {
  const [isIOSWebKit] = useState(isIOSWebKitBrowser);

  return isIOSWebKit
    ? <IOSHomeScrollProvider>{children}</IOSHomeScrollProvider>
    : <ActiveHomeScrollProvider>{children}</ActiveHomeScrollProvider>;
}

function resolveScrollRange(
  elementTop: number,
  elementHeight: number,
  viewportHeight: number,
  offset: HomeScrollOffset,
): [number, number] {
  switch (offset) {
    case "cover":
      // Motion offset: ["start end", "end start"]
      return [elementTop - viewportHeight, elementTop + elementHeight];
    case "hero":
      // Motion offset: ["start start", "end start"]
      return [elementTop, elementTop + elementHeight];
    case "sticky":
      // Motion offset: ["start start", "end end"]
      return [elementTop, elementTop + elementHeight - viewportHeight];
    case "record-exit":
      // Motion offset: ["start 20vh", "start -12vh"]
      return [elementTop - viewportHeight * 0.2, elementTop + viewportHeight * 0.12];
  }
}

function useElementScrollProgress<T extends HTMLElement>(
  ref: RefObject<T | null>,
  offset: HomeScrollOffset,
) {
  const context = useContext(HomeScrollContext);
  const [range, setRange] = useState<[number, number]>([0, 1]);

  if (!context) {
    throw new Error("useElementScrollProgress must be used inside HomeScrollProvider");
  }

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let frame = 0;
    let lastViewportWidth = window.innerWidth;

    const measure = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      const viewportHeight = document.documentElement.clientHeight;
      const nextRange = resolveScrollRange(
        rect.top + window.scrollY,
        rect.height,
        viewportHeight,
        offset,
      );

      setRange((currentRange) =>
        currentRange[0] === nextRange[0] && currentRange[1] === nextRange[1]
          ? currentRange
          : nextRange,
      );
    };

    const scheduleMeasure = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };

    const handleResize = () => {
      // Safari's collapsing browser chrome can emit height-only resize events
      // during touch scroll. Those must not bring layout reads back into the
      // hot path. Width changes and orientation changes still remeasure.
      if (window.innerWidth === lastViewportWidth) return;
      lastViewportWidth = window.innerWidth;
      scheduleMeasure();
    };

    measure();

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(element);
    resizeObserver.observe(document.body);
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("orientationchange", scheduleMeasure, { passive: true });
    document.fonts?.ready.then(scheduleMeasure).catch(() => undefined);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", scheduleMeasure);
    };
  }, [offset, ref]);

  return useTransform(context.scrollY, range, [0, 1], { clamp: true });
}

/**
 * Scroll-linked sticky scenes are expensive for WebKit while a touch gesture is
 * active. Keep them for pointer/desktop layouts, where they add value, and
 * switch to the same content without a scroll timeline on compact viewports.
 */
function useDesktopViewport() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

// Image Component with dynamic GPU-accelerated Parallax scroll behavior
function ParallaxImage({ src, alt, clipPath }: { src: string; alt: string; clipPath: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const scrollYProgress = useElementScrollProgress(ref, "cover");

  const smoothProgress = useSpring(scrollYProgress, SCROLL_SPRING);
  const transform = useTransform(
    reduceMotion ? scrollYProgress : smoothProgress,
    [0, 1],
    reduceMotion
      ? ["translate3d(0, 0%, 0)", "translate3d(0, 0%, 0)"]
      : ["translate3d(0, -8%, 0)", "translate3d(0, 8%, 0)"],
  );

  return (
    <div ref={ref} className="w-full h-full relative overflow-hidden" style={{ clipPath }}>
      <motion.div
        style={{ transform }}
        className="absolute -top-[8%] left-0 h-[116%] w-full transform-gpu [backface-visibility:hidden]"
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 55vw"
          className="h-full w-full object-cover grayscale brightness-[0.7] transition-[filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:grayscale-0 hover:brightness-95"
        />
      </motion.div>
    </div>
  );
}

// 2. ASYMMETRIC HERO
function HeroSection({
  heroVideoSrc,
}: Pick<HomePageProps, "heroVideoSrc">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const videoSources = heroVideoSrc
    ? Array.isArray(heroVideoSrc)
      ? heroVideoSrc
      : [heroVideoSrc]
    : HERO_VIDEOS;
  const hasVideo = videoSources.length > 0;
  const activeVideoSrc = hasVideo
    ? videoSources[activeVideoIndex % videoSources.length]
    : undefined;

  const scrollYProgress = useElementScrollProgress(containerRef, "hero");
  const smoothProgress = useSpring(scrollYProgress, SCROLL_SPRING);
  const progress = reduceMotion ? scrollYProgress : smoothProgress;

  const mediaTransform = useTransform(
    progress,
    [0, 1],
    reduceMotion
      ? ["translate3d(0,0,0) scale(1)", "translate3d(0,0,0) scale(1)"]
      : ["translate3d(0,0,0) scale(1.035)", "translate3d(0,32px,0) scale(0.97)"],
  );
  const textOpacity = useTransform(progress, [0, 0.66], [1, 0]);
  const textTransform = useTransform(
    progress,
    [0, 0.66],
    reduceMotion
      ? ["translate3d(0,0,0)", "translate3d(0,0,0)"]
      : ["translate3d(0,0,0)", "translate3d(0,-24px,0)"],
  );

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-[108svh] w-full items-end overflow-hidden bg-transparent px-5 pb-40 pt-24 md:min-h-[112vh] md:px-[4vw]"
      style={{
        "--color-linen": "#f9f8f6",
        "--color-stone-beige": "#d9d4cc",
        "--color-couture-red": "#e44b61",
      } as CSSProperties}
    >
      <motion.div
        className="absolute -right-[9%] top-[4.5rem] z-0 h-[75svh] w-[96%] overflow-hidden transform-gpu [backface-visibility:hidden] md:-right-[2%] md:top-[5.5rem] md:h-[86vh] md:w-[72%]"
        style={{
          clipPath: "polygon(13% 4%, 93% 0, 100% 84%, 78% 100%, 0 91%, 5% 23%)",
        }}
      >
        <motion.div className="relative h-full w-full transform-gpu [backface-visibility:hidden]" style={{ transform: mediaTransform }}>
          {activeVideoSrc ? (
            <video
              key={activeVideoSrc}
              autoPlay
              muted
              loop={videoSources.length === 1}
              playsInline
              preload="metadata"
              poster={HERO_POSTER}
              src={activeVideoSrc}
              className="h-full w-full object-cover grayscale contrast-[1.08] brightness-[0.68]"
              aria-hidden="true"
              onEnded={() => setActiveVideoIndex((index) => (index + 1) % videoSources.length)}
              onError={() => setActiveVideoIndex((index) => (index + 1) % videoSources.length)}
            />
          ) : (
            <Image
              src={HERO_IMAGE}
              alt="Handcrafted Synarava jewelry"
              fill
              priority
              loading="eager"
              sizes="100vw"
              className="h-full w-full object-cover grayscale contrast-[1.08] brightness-[0.68]"
            />
          )}
        </motion.div>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(8,8,10,0.1)_20%,transparent_48%,rgba(8,8,10,0.65)_100%)]" />
        <div className="pointer-events-none absolute inset-[5%] border border-linen/20 [clip-path:polygon(7%_0,100%_0,100%_82%,78%_100%,0_89%,0_21%)]" />
        <div className="pointer-events-none absolute -bottom-[14%] left-[23%] h-[46%] w-[18%] -rotate-[18deg] border-x border-linen/15 bg-linen/[0.035] backdrop-blur-[2px]" aria-hidden="true" />
      </motion.div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[58%]"
        style={{ background: "linear-gradient(to top, transparent 0%, rgba(9,9,10,0.88) 34%, transparent 100%)" }}
        aria-hidden="true"
      />

      <motion.div
        className="relative z-10 w-full transform-gpu [backface-visibility:hidden] md:pl-[4vw]"
        style={{ opacity: textOpacity, transform: textTransform }}
      >
        <div className="mb-5 flex items-center gap-4 md:mb-7">
          <span className="h-px w-10 bg-couture-red" aria-hidden="true" />
          <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-linen/75">
            Synarava · Belarus
          </p>
        </div>

        <h1 className="max-w-[9ch] text-balance font-serif text-[clamp(3.4rem,9vw,6rem)] uppercase leading-[0.86] tracking-[-0.035em] text-linen">
          Artifacts<br />of <span className="italic font-light text-couture-red">time</span>
        </h1>

        <p className="mt-6 max-w-[31rem] text-pretty font-sans text-sm font-medium leading-relaxed text-stone-beige/80 md:mt-8 md:text-base">
          Hand-shaped couture where raw matter becomes a private relic.
        </p>

        <div className="mt-7 pl-8 sm:pl-14 md:mt-9">
          <PrimaryCtaButton href="/shop">
            Shop the collection
          </PrimaryCtaButton>
        </div>
      </motion.div>

      <p className="absolute bottom-7 right-5 z-10 hidden font-serif text-sm italic text-linen/70 sm:block md:right-[4vw]">
        Matter, held in tension.
      </p>
    </section>
  );
}

// 3. CINEMATIC SCROLL PATHWAY (Transparent background, Parallax images + individual loading scroll reveal)
function ArchivePathway({ collections }: { collections: CollectionItem[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRecordRef = useRef<HTMLDivElement>(null);
  const secondRecordRef = useRef<HTMLDivElement>(null);
  const thirdRecordRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  const firstRecordProgress = useElementScrollProgress(firstRecordRef, "record-exit");
  const secondRecordProgress = useElementScrollProgress(secondRecordRef, "record-exit");
  const thirdRecordProgress = useElementScrollProgress(thirdRecordRef, "record-exit");

  const firstRecordDim = useTransform(
    firstRecordProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 0.58],
  );
  const secondRecordDim = useTransform(
    secondRecordProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 0.58],
  );
  const thirdRecordDim = useTransform(
    thirdRecordProgress,
    [0, 1],
    reduceMotion ? [0, 0] : [0, 0.58],
  );

  const items = useMemo(() => {
    const list = [...collections];
    if (list.length < 1) {
      list.push({
        series: "No. 001",
        title: "The Lava Construct",
        price: "Limited",
        image: LAVA_CONSTRUCT_IMAGE,
        href: "/shop",
      });
    }
    if (list.length < 2) {
      list.push({
        series: "No. 002",
        title: "Fractured Quartz",
        price: "Limited",
        image: FRACTURED_QUARTZ_IMAGE,
        href: "/shop",
      });
    }
    if (list.length < 3) {
      list.push({
        series: "No. 003",
        title: "Petrified Oak",
        price: "Limited",
        image: HERO_IMAGE,
        href: "/shop",
      });
    }
    return list.slice(0, 3);
  }, [collections]);

  return (
    <section
      ref={containerRef}
      className="relative z-20 -mt-[18svh] bg-transparent px-6 pb-24 pt-[calc(6rem+18svh)] text-linen md:px-[4vw]"
      id="archive-pathway"
    >
      {/* Giant background text */}
      <div className="absolute -right-20 top-40 z-0 opacity-5 rotate-[270deg] clipped-text pointer-events-none select-none">
        <h1 className="font-serif text-[15vw] text-linen leading-none uppercase">RECORDED</h1>
      </div>

      <div className="max-w-[90rem] mx-auto flex flex-col gap-32 md:gap-48 relative z-10">

        {/* Item 001: Left text block overlapping Right image */}
        <div className="relative w-full min-h-[90vh] flex flex-col justify-center items-end">

          {/* Overlapping Text Card with Scroll reveal (loading effect) */}
          <motion.div
            ref={firstRecordRef}
            initial={{ opacity: 0, y: 50, x: -20 }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.85, ease }}
            className="relative z-20 w-full self-start overflow-hidden p-8 md:absolute md:left-10 md:top-[10%] md:w-5/12 md:p-12"
          >
            <div className="archive-record-surface absolute inset-0 z-0" aria-hidden="true" />

            <div className="relative z-10 w-full h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="font-sans text-couture-red tracking-widest text-[10px] font-bold">No. 001 // LAVA</span>
                <span className="font-sans text-[9px] text-stone-beige/65 text-right uppercase">
                  LOC:<br />53.90° N, 27.56° E
                </span>
              </div>
              <h2 className="font-serif text-5xl md:text-7xl text-linen mb-6 uppercase leading-[0.95] tracking-tighter">
                The Lava<br />
                <span className="italic font-light text-couture-red">Construct</span>
              </h2>
              <p className="font-sans text-[10px] text-stone-beige/80 leading-relaxed mb-8 text-justify uppercase font-bold">
                [OBSERVATION LOG]<br />
                Porous obsidian captured in perfect spheres, contrasting with the smooth rigidity of aged oak. A tactile meditation on impermanence. Material stress tests indicate high durability alongside visual fragility.
              </p>

              {/* Technical Parameters Table */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-linen/10 py-4 font-sans text-[10px] text-linen uppercase font-bold">
                <div>
                  <span className="text-couture-red block mb-1 font-bold">TYPE</span>
                  Igneous / Porous
                </div>
                <div>
                  <span className="text-couture-red block mb-1 font-bold">ORIGIN</span>
                  Dormant calderas
                </div>
              </div>

            </div>
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 bg-black"
              style={{ opacity: firstRecordDim }}
              aria-hidden="true"
            />
          </motion.div>

          {/* Right Image with Scroll Reveal + Parallax scroll */}
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1.1, ease }}
            className="w-full md:w-3/4 h-[60vh] md:h-[80vh] relative z-10 mt-6 md:mt-0"
          >
            <Link
              href={items[0].href}
              aria-label={`View ${items[0].title} collection`}
              className="group relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
            >
              <ParallaxImage src={items[0].image} alt={items[0].title} clipPath="polygon(15% 5%, 95% 0, 100% 90%, 0% 100%)" />
              <span className="absolute bottom-7 right-7 z-10 inline-flex items-center gap-2 bg-[#09090a]/90 px-3 py-2 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-linen opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                View collection
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>

        </div>

        {/* Item 002: Right text block overlapping Left image */}
        <div className="relative w-full min-h-[90vh] flex flex-col justify-center items-start">

          {/* Left Image with Scroll Reveal + Parallax scroll */}
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1.1, ease }}
            className="w-full md:w-3/4 h-[60vh] md:h-[80vh] relative z-10"
          >
            <Link
              href={items[1].href}
              aria-label={`View ${items[1].title} collection`}
              className="group relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
            >
              <ParallaxImage src={items[1].image} alt={items[1].title} clipPath="polygon(0 20%, 100% 0, 85% 100%, 5% 80%)" />
              <span className="absolute bottom-7 right-7 z-10 inline-flex items-center gap-2 bg-[#09090a]/90 px-3 py-2 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-linen opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                View collection
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>

          {/* Overlapping Text Card with Scroll reveal (loading effect) */}
          <motion.div
            ref={secondRecordRef}
            initial={{ opacity: 0, y: 50, x: 20 }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.85, ease }}
            className="relative z-20 mt-6 w-full self-end overflow-hidden p-8 text-linen md:absolute md:right-10 md:top-[15%] md:mt-0 md:w-5/12 md:p-12"
          >
            <div className="archive-record-surface absolute inset-0 z-0" aria-hidden="true" />

            <div className="relative z-10 w-full h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="font-sans text-[9px] text-stone-beige/65 uppercase">
                  COORD:<br />53.90° N, 27.56° E
                </span>
                <span className="font-sans text-couture-red tracking-widest text-[10px] font-bold text-right">No. 002 // QUARTZ</span>
              </div>
              <h2 className="font-serif text-5xl md:text-7xl text-linen mb-6 uppercase leading-[0.95] tracking-tighter text-right">
                Fractured<br />
                <span className="italic font-light text-stone-beige">Quartz</span>
              </h2>
              <p className="font-sans text-[10px] text-stone-beige/70 leading-relaxed mb-8 text-justify uppercase font-bold">
                [STRUCTURAL ANALYSIS]<br />
                Raw, uncut crystalline structures bound in heavy, unpolished silver. Architecture for the hand, rejecting traditional symmetry. The metal casing acts as an industrial vice, securing the volatile crystal formation.
              </p>

              {/* Technical Parameters Table */}
              <table className="w-full font-sans text-[10px] text-left border-collapse font-bold">
                <tbody>
                  <tr className="border-b border-linen/10">
                    <td className="py-2 text-couture-red w-1/3 font-bold">STATE</td>
                    <td className="py-2 text-stone-beige uppercase">Raw / Uncut</td>
                  </tr>
                  <tr className="border-b border-linen/10">
                    <td className="py-2 text-couture-red font-bold">CASING</td>
                    <td className="py-2 text-stone-beige uppercase">Heavy Silver Binding</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 bg-black"
              style={{ opacity: secondRecordDim }}
              aria-hidden="true"
            />
          </motion.div>

        </div>

        {/* Item 003: Left text block overlapping Right image */}
        <div className="relative w-full min-h-[90vh] flex flex-col justify-center items-end mt-12 md:mt-0">

          {/* Overlapping Text Card with Scroll reveal (loading effect) */}
          <motion.div
            ref={thirdRecordRef}
            initial={{ opacity: 0, y: 50, x: -20 }}
            whileInView={{ opacity: 1, y: 0, x: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.85, ease }}
            className="relative z-20 w-full self-start overflow-hidden p-8 md:absolute md:left-10 md:top-[10%] md:w-5/12 md:p-12"
          >
            <div className="archive-record-surface absolute inset-0 z-0" aria-hidden="true" />

            <div className="relative z-10 w-full h-full">
              <div className="flex justify-between items-start mb-6">
                <span className="font-sans text-couture-red tracking-widest text-[10px] font-bold">No. 003 // OAK</span>
                <span className="font-sans text-[9px] text-stone-beige/65 text-right uppercase">
                  LOC:<br />53.90° N, 27.56° E
                </span>
              </div>
              <h2 className="font-serif text-5xl md:text-7xl text-linen mb-6 uppercase leading-[0.95] tracking-tighter">
                Petrified<br />
                <span className="italic font-light text-couture-red">Oak</span>
              </h2>
              <p className="font-sans text-[10px] text-stone-beige/80 leading-relaxed mb-8 text-justify uppercase font-bold">
                [CARBON ANALYSIS]<br />
                Reclaimed bog oak submerged for centuries, yielding density approaching mineral stone. Hand-shaped to follow the natural grain stress contours. A marriage of organic decay and timeless permanence.
              </p>

              {/* Technical Parameters Table */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-linen/10 py-4 font-sans text-[10px] text-linen uppercase font-bold">
                <div>
                  <span className="text-couture-red block mb-1 font-bold">AGE</span>
                  300+ Years
                </div>
                <div>
                  <span className="text-couture-red block mb-1 font-bold">PROCESS</span>
                  Carbonization
                </div>
              </div>

            </div>
            <motion.div
              className="pointer-events-none absolute inset-0 z-20 bg-black"
              style={{ opacity: thirdRecordDim }}
              aria-hidden="true"
            />
          </motion.div>

          {/* Right Image with Scroll Reveal + Parallax scroll */}
          <motion.div
            initial={{ opacity: 0, y: 80 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1.1, ease }}
            className="w-full md:w-3/4 h-[60vh] md:h-[80vh] relative z-10 mt-6 md:mt-0"
          >
            <Link
              href={items[2]?.href ?? "/shop"}
              aria-label={`View ${items[2]?.title ?? "Petrified Oak"} collection`}
              className="group relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
            >
              <ParallaxImage src={items[2] ? items[2].image : HERO_IMAGE} alt={items[2] ? items[2].title : "Petrified Oak"} clipPath="polygon(10% 0, 100% 10%, 90% 100%, 0% 90%)" />
              <span className="absolute bottom-7 right-7 z-10 inline-flex items-center gap-2 bg-[#09090a]/90 px-3 py-2 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-linen opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                View collection
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>

        </div>

      </div>
    </section>
  );
}

type LexiconMaterial = (typeof LEXICON_MATERIALS)[number];

function MaterialPlate({
  material,
  index,
  progress,
  reduceMotion,
  activeIndex,
}: {
  material: LexiconMaterial;
  index: number;
  progress: MotionValue<number>;
  reduceMotion: boolean;
  activeIndex?: number;
}) {
  const ranges = [
    [0, 0.24, 0.42],
    [0.24, 0.42, 0.58, 0.76],
    [0.58, 0.76, 1],
  ];
  const opacityValues = index === 0 ? [1, 1, 0] : index === 1 ? [0, 1, 1, 0] : [0, 1, 1];
  const xValues = index === 0 ? ["0%", "0%", "-8%"] : index === 1 ? ["9%", "0%", "0%", "-8%"] : ["9%", "0%", "0%"];
  const rotateValues = index === 0 ? [0, -0.5, -3.5] : index === 1 ? [3, 0.5, -0.5, -3.5] : [3, 0.5, 0];
  const scaleValues = index === 0 ? [1, 1, 0.985] : index === 1 ? [0.985, 1, 1, 0.985] : [0.985, 1, 1];
  const revealRanges = index === 0 ? [0, 1] : index === 1 ? [0, 0.24, 0.42, 1] : [0, 0.58, 0.76, 1];
  const revealed = "polygon(0% 0%, 100% 0%, 100% 100%, -8% 100%)";
  const concealed = "polygon(108% 0%, 108% 0%, 100% 100%, 100% 100%)";
  const revealValues = index === 0 ? [revealed, revealed] : [concealed, concealed, revealed, revealed];

  const opacity = useTransform(progress, ranges[index], reduceMotion ? opacityValues : opacityValues.map(() => 1));
  const x = useTransform(progress, ranges[index], reduceMotion ? opacityValues.map(() => "0%") : xValues);
  const rotate = useTransform(progress, ranges[index], reduceMotion ? opacityValues.map(() => 0) : rotateValues);
  const scale = useTransform(progress, ranges[index], reduceMotion ? opacityValues.map(() => 1) : scaleValues);
  const clipPath = useTransform(progress, revealRanges, reduceMotion ? revealValues.map(() => revealed) : revealValues);
  const imageX = useTransform(progress, [0, 1], reduceMotion ? ["0%", "0%"] : [`${index * -3 - 4}%`, `${index * 3 + 5}%`]);
  const usesDiscreteIOSSteps = activeIndex !== undefined;
  const isActive = activeIndex === index;
  const isPast = activeIndex !== undefined && index < activeIndex;
  const discreteState = reduceMotion
    ? {
        opacity: isActive ? 1 : 0,
        x: "0%",
        rotate: 0,
        scale: 1,
        clipPath: isActive ? revealed : concealed,
      }
    : {
        opacity: isActive ? 1 : 0,
        x: isActive ? "0%" : isPast ? "-8%" : "9%",
        rotate: isActive ? 0 : isPast ? -3.5 : 3,
        scale: isActive ? 1 : 0.985,
        clipPath: isActive ? revealed : concealed,
      };

  return (
    <motion.article
      initial={usesDiscreteIOSSteps ? false : undefined}
      animate={usesDiscreteIOSSteps ? discreteState : undefined}
      transition={usesDiscreteIOSSteps ? { duration: reduceMotion ? 0.16 : 0.48, ease } : undefined}
      style={usesDiscreteIOSSteps
        ? { zIndex: index + 1 }
        : { opacity, x, rotate, scale, clipPath, zIndex: index + 1 }}
      className="absolute inset-x-0 top-1/2 grid -translate-y-1/2 transform-gpu grid-cols-1 overflow-hidden border border-linen/15 bg-[#09090a]/94 shadow-[0_18px_48px_rgba(0,0,0,0.42)] [backface-visibility:hidden] md:grid-cols-[0.92fr_1.08fr]"
      aria-label={`${String(index + 1).padStart(2, "0")}. ${material.name}`}
    >
      <div className="relative min-h-[31svh] overflow-hidden border-b border-linen/12 md:min-h-[64svh] md:border-b-0 md:border-r">
        <motion.div style={{ x: imageX }} className="absolute -inset-x-[10%] inset-y-0">
          <Image
            src={material.image}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 45vw"
            className="object-cover grayscale contrast-125 brightness-[0.62]"
          />
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(166,25,46,0.2),transparent_42%,rgba(0,0,0,0.65))]" />
        <div className="absolute inset-[7%] border border-linen/18 [clip-path:polygon(0_0,88%_0,100%_18%,100%_100%,12%_100%,0_82%)]" />
        <div className="absolute bottom-5 left-5 font-sans text-[0.62rem] font-bold uppercase tracking-[0.22em] text-linen/70 md:bottom-8 md:left-8">
          Specimen / {material.symbol}
        </div>
        <span className="absolute -right-2 -top-8 font-serif text-[clamp(7rem,18vw,15rem)] leading-none text-linen/[0.08]" aria-hidden="true">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>

      <div className="relative min-h-[45svh] overflow-hidden p-6 md:min-h-[64svh] md:p-10 lg:p-14">
        <div className="home-glass-panel absolute inset-0" aria-hidden="true" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-linen/15 pb-4 font-sans text-[0.58rem] font-bold uppercase tracking-[0.2em] text-stone-beige/70">
            <span>{material.category}</span>
            <span className="text-couture-red">Archive verified</span>
          </div>

          <div className="flex flex-1 flex-col justify-center py-5 md:py-8">
            <p className="mb-2 font-sans text-[0.65rem] font-bold uppercase tracking-[0.24em] text-couture-red">
              Material {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="max-w-[9ch] text-balance font-serif text-[clamp(2.8rem,6vw,5.8rem)] font-bold uppercase leading-[0.84] tracking-[-0.035em] text-linen">
              {material.name}
            </h3>
            <p className="mt-5 max-w-[64ch] text-pretty font-sans text-sm font-semibold leading-relaxed text-stone-beige/85 md:mt-7 md:text-base">
              {material.description}
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-linen/15 pt-4">
            {material.properties.map((property, propertyIndex) => (
              <div key={property} className={propertyIndex > 0 ? "border-l border-linen/15 pl-3 md:pl-5" : ""}>
                <span className="mb-1 block font-sans text-[0.52rem] font-bold text-couture-red">0{propertyIndex + 1}</span>
                <span className="font-sans text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-linen/75 md:text-xs">
                  {property}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// 4. MATERIAL EXPOSITION — scroll-controlled cubist specimen carousel
function MaterialLab() {
  const ref = useRef<HTMLElement>(null);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);
  const scrollContext = useContext(HomeScrollContext);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;
  const scrollYProgress = useElementScrollProgress(ref, "sticky");
  const smoothProgress = useSpring(scrollYProgress, MATERIAL_LAB_SPRING);
  const progress = reduceMotion ? scrollYProgress : smoothProgress;
  const progressScale = useTransform(progress, [0, 1], [0, 1]);
  const usesDiscreteIOSSteps = scrollContext?.isIOSWebKit ?? false;

  useEffect(() => {
    if (!usesDiscreteIOSSteps) return;

    const visibility = new Map<Element, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibility.set(entry.target, entry.intersectionRatio);
        }

        let nextIndex = 0;
        let highestVisibility = 0;
        stepRefs.current.forEach((element, index) => {
          if (!element) return;
          const ratio = visibility.get(element) ?? 0;
          if (ratio > highestVisibility) {
            highestVisibility = ratio;
            nextIndex = index;
          }
        });

        if (highestVisibility > 0) {
          setActiveIndex((currentIndex) => currentIndex === nextIndex ? currentIndex : nextIndex);
        }
      },
      { rootMargin: "-18% 0px -18% 0px", threshold: [0, 0.25, 0.5, 0.75] },
    );

    stepRefs.current.forEach((element) => {
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, [usesDiscreteIOSSteps]);

  return (
    <section
      ref={ref}
      className="relative h-[330svh] bg-transparent text-linen"
      style={{
        "--color-linen": "#f9f8f6",
        "--color-stone-beige": "#d9d4cc",
        "--color-couture-red": "#e44b61",
      } as CSSProperties}
      aria-labelledby="lexicon-title"
    >
      {usesDiscreteIOSSteps ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col" aria-hidden="true">
          {LEXICON_MATERIALS.map((material, index) => (
            <div
              key={material.name}
              ref={(element) => { stepRefs.current[index] = element; }}
              className="min-h-0 flex-1"
            />
          ))}
        </div>
      ) : null}
      <div className="sticky top-0 h-svh overflow-hidden px-4 py-5 md:px-[4vw] md:py-8">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ background: "radial-gradient(circle at 64% 42%, rgba(166,25,46,0.16), transparent 32%)" }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute inset-0 opacity-[0.045]" style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "clamp(48px, 6vw, 88px) clamp(48px, 6vw, 88px)",
        }} aria-hidden="true" />

        <div className="relative mx-auto h-full max-w-[90rem]">
          <header className="absolute inset-x-0 top-20 z-20 flex items-start justify-between gap-6 md:top-24">
            <div>
              <p className="mb-1 font-sans text-[0.58rem] font-bold uppercase tracking-[0.28em] text-couture-red">
                Material glossary / scroll to turn
              </p>
              <h2 id="lexicon-title" className="font-serif text-[clamp(2rem,4.5vw,4.5rem)] font-bold uppercase leading-none tracking-[-0.035em] text-linen">
                Lexicon
              </h2>
            </div>
            <div className="hidden items-center gap-3 pt-2 font-sans text-[0.58rem] font-bold uppercase tracking-[0.2em] text-stone-beige/60 sm:flex">
              <span>01</span>
              <div className="relative h-16 w-px bg-linen/15">
                <motion.div style={{ scaleY: progressScale, transformOrigin: "top" }} className="absolute inset-0 bg-couture-red" />
              </div>
              <span>03</span>
            </div>
          </header>

          <div className="absolute inset-x-0 bottom-0 top-[9.5rem] md:top-[11.5rem]">
            {LEXICON_MATERIALS.map((material, index) => (
              <MaterialPlate
                key={material.name}
                material={material}
                index={index}
                progress={progress}
                reduceMotion={reduceMotion}
                activeIndex={usesDiscreteIOSSteps ? activeIndex : undefined}
              />
            ))}
          </div>

          <p className="absolute bottom-2 right-2 z-20 hidden origin-bottom-right rotate-90 font-sans text-[0.5rem] font-bold uppercase tracking-[0.32em] text-linen/60 lg:block">
            Synarava material archive · Vol. I
          </p>
        </div>
      </div>
    </section>
  );
}

// 5. MANIFESTO QUOTE (Archival directive, grid lines overlay)
function ManifestoQuote() {
  return (
    <section className="py-32 px-6 flex items-center justify-center bg-transparent text-linen min-h-screen relative overflow-hidden">
      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none" style={{
        backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
        backgroundSize: "50px 50px"
      }} />

      {/* Red ambient museum glow in background (no brown) */}
      <div className="absolute inset-0 pointer-events-none select-none" style={{
        background: "radial-gradient(circle at 50% 50%, rgba(166, 25, 46, 0.04) 0%, rgba(0,0,0,0) 70%)"
      }} />

      <div className="absolute left-10 top-10 font-sans text-[10px] text-couture-red tracking-[0.4em] rotate-90 origin-left select-none opacity-60">
        DIRECTIVE // 099
      </div>

      <div className="max-w-6xl relative z-10 flex flex-col items-center">
        {/* Red stamp */}
        <div className={`${STAMP_CLASS} mb-12 -rotate-6 text-sm border-2 border-couture-red !text-couture-red`}>
          CLASSIFIED DIRECTIVE
        </div>

        <h2 className="font-serif text-[clamp(2.4rem,7.5vw,7.5vw)] text-linen italic leading-[1.05] mb-12 font-light text-center relative max-w-5xl">
          <span className="absolute -top-12 -left-12 text-[15vw] text-stone-beige opacity-10 font-serif leading-none select-none">&ldquo;</span>
          Adornment is not decoration.<br />It is <span className="font-bold text-couture-red not-italic uppercase tracking-tighter">structural intent</span><br />applied to the human form.
          <span className="absolute -bottom-24 -right-12 text-[15vw] text-stone-beige opacity-10 font-serif leading-none select-none">&rdquo;</span>
        </h2>

        <div className="flex items-center gap-4 mt-8">
          <div className="w-12 h-px bg-couture-red" />
          <span className="font-sans text-[10px] text-linen uppercase tracking-[0.25em] font-bold">
            The Synarava Manifesto // Vol 1.
          </span>
          <div className="w-12 h-px bg-couture-red" />
        </div>
      </div>
    </section>
  );
}

// 6. COLLECTIONS / MANIFESTO GRID (Transparent background)
function ManifestoGrid() {
  const lines = [
    "Jewelry as a private relic.",
    "Belarusian geometry, stripped of nostalgia.",
    "Material first. Ornament only when it carries meaning.",
  ];

  return (
    <section className="bg-transparent py-24 px-6 md:px-[4vw]">
      <div className="max-w-[90rem] mx-auto">
        <div className="grid gap-8 md:grid-cols-3">
          {lines.map((line, index) => (
            <motion.div
              key={line}
              className="border-t border-linen/10 pt-6"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.65, delay: index * 0.1, ease }}
            >
              <p className="font-serif text-[clamp(1.5rem,2.8vw,2.2rem)] leading-tight text-linen font-bold">
                {line}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalFooter() {
  const { t } = useTranslations();

  return (
    <>
      <div className="border-b border-linen/15 pb-5 md:pb-7">
        <p className="font-serif text-[clamp(3.3rem,10vw,6rem)] font-bold uppercase leading-[0.8] tracking-[-0.035em] text-linen">
          Synarava
        </p>
        <p className="mt-3 font-serif text-base italic text-stone-beige/65 md:text-xl">
          {t("footer.tagline")}
        </p>
      </div>

      <div className="grid flex-1 content-center gap-8 py-6 sm:grid-cols-[1.2fr_1fr_1fr] md:gap-14 md:py-9">
        <div className="max-w-sm">
          <p className="font-serif text-2xl leading-tight text-linen md:text-3xl">
            Objects shaped slowly,<br />kept for a lifetime.
          </p>
          <a
            href="mailto:studio@synarava.com"
            className="mt-5 inline-block border-b border-couture-red pb-1 font-sans text-xs font-semibold tracking-[0.08em] text-stone-beige transition-colors hover:text-linen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
          >
            studio@synarava.com
          </a>
        </div>

        <nav aria-label={t("footer.navigationHeading")} className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-col">
          <Link href="/shop" className="font-sans text-sm font-semibold text-couture-red hover:text-linen">{t("footer.shop")}</Link>
          <Link href="/collections" className="font-sans text-sm text-stone-beige hover:text-linen">{t("footer.collections")}</Link>
          <Link href="/about" className="font-sans text-sm text-stone-beige hover:text-linen">{t("footer.about")}</Link>
          <Link href="/about/manifesto" className="font-sans text-sm text-stone-beige hover:text-linen">{t("footer.manifesto")}</Link>
        </nav>

        <nav aria-label={t("footer.serviceHeading")} className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-col">
          <Link href="/about" className="font-sans text-sm text-stone-beige hover:text-linen">{t("footer.careGuide")}</Link>
          <Link href="/about" className="font-sans text-sm text-stone-beige hover:text-linen">{t("footer.shipping")}</Link>
          <Link href="mailto:studio@synarava.com" className="font-sans text-sm text-stone-beige hover:text-linen">{t("footer.contact")}</Link>
        </nav>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 border-t border-linen/15 pt-5 font-sans text-[0.62rem] uppercase tracking-[0.12em] text-stone-beige/65">
        <p>{t("footer.copyright")}</p>
        <div className="flex flex-wrap gap-5">
          <Link href="/privacy" className="hover:text-linen">{t("footer.privacyPolicy")}</Link>
          <Link href="/offer" className="hover:text-linen">{t("footer.publicOffer")}</Link>
        </div>
      </div>
    </>
  );
}

function CompactFinalCTA() {
  return (
    <section
      className="relative overflow-hidden bg-[#09090a] px-5 py-16 text-linen"
      style={{
        "--color-linen": "#f9f8f6",
        "--color-stone-beige": "#d9d4cc",
        "--color-couture-red": "#e44b61",
      } as CSSProperties}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:52px_52px]" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-[min(42rem,100svh)] max-w-[90rem] flex-col">
        <FinalFooter />
      </div>
    </section>
  );
}

// 7. FINAL CTA — cubist shop portal
function DesktopFinalCTA({ collections }: { collections: CollectionItem[] }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const images = useMemo(() => {
    const source = collections.length ? collections : [{ image: HERO_IMAGE } as CollectionItem];
    return [...source, ...source].slice(0, 4);
  }, [collections]);
  const scrollYProgress = useElementScrollProgress(ref, "sticky");
  const smoothProgress = useSpring(scrollYProgress, FINAL_SCENE_SPRING);
  const progress = reduceMotion ? scrollYProgress : smoothProgress;

  const introY = useTransform(
    progress,
    reduceMotion ? [0, 1] : [0, 0.2, 0.5],
    reduceMotion ? ["0vh", "0vh"] : ["0vh", "0vh", "-92vh"],
    { ease: FINAL_SCENE_EASE },
  );
  const introOpacity = useTransform(
    progress,
    reduceMotion ? [0, 0.48, 0.54, 1] : [0, 0.34, 0.5, 1],
    [1, 1, 0, 0],
    { ease: FINAL_SCENE_EASE },
  );
  const shardOpacity = useTransform(
    progress,
    reduceMotion ? [0, 0.48, 0.54, 1] : [0, 0.58, 0.92, 1],
    reduceMotion ? [1, 1, 0, 0] : [1, 0.9, 0, 0],
    { ease: FINAL_SCENE_EASE },
  );
  const shardRange = reduceMotion ? [0, 1] : [0.18, 0.84];
  const mainX = useTransform(progress, shardRange, reduceMotion ? ["0vw", "0vw"] : ["0vw", "-70vw"], { ease: FINAL_SCENE_EASE });
  const mainY = useTransform(progress, shardRange, reduceMotion ? ["0vh", "0vh"] : ["0vh", "8vh"], { ease: FINAL_SCENE_EASE });
  const mainRotate = useTransform(progress, shardRange, reduceMotion ? [0, 0] : [0, -12], { ease: FINAL_SCENE_EASE });
  const rightX = useTransform(progress, shardRange, reduceMotion ? ["0vw", "0vw"] : ["0vw", "60vw"], { ease: FINAL_SCENE_EASE });
  const rightY = useTransform(progress, shardRange, reduceMotion ? ["0vh", "0vh"] : ["0vh", "-6vh"], { ease: FINAL_SCENE_EASE });
  const rightRotate = useTransform(progress, shardRange, reduceMotion ? [0, 0] : [0, 14], { ease: FINAL_SCENE_EASE });
  const lowerLeftX = useTransform(progress, shardRange, reduceMotion ? ["0vw", "0vw"] : ["0vw", "-60vw"], { ease: FINAL_SCENE_EASE });
  const lowerLeftY = useTransform(progress, shardRange, reduceMotion ? ["0vh", "0vh"] : ["0vh", "26vh"], { ease: FINAL_SCENE_EASE });
  const lowerLeftRotate = useTransform(progress, shardRange, reduceMotion ? [0, 0] : [0, 18], { ease: FINAL_SCENE_EASE });
  const lowerRightX = useTransform(progress, shardRange, reduceMotion ? ["0vw", "0vw"] : ["0vw", "60vw"], { ease: FINAL_SCENE_EASE });
  const lowerRightY = useTransform(progress, shardRange, reduceMotion ? ["0vh", "0vh"] : ["0vh", "24vh"], { ease: FINAL_SCENE_EASE });
  const lowerRightRotate = useTransform(progress, shardRange, reduceMotion ? [0, 0] : [0, -16], { ease: FINAL_SCENE_EASE });
  const sigilScale = useTransform(
    progress,
    reduceMotion ? [0, 1] : [0, 0.2, 0.54, 0.68, 0.86, 0.94, 1],
    reduceMotion ? [0.035, 0.035] : [0.035, 0.035, 1, 1, 0.18, 0.12, 0.12],
    { ease: FINAL_SCENE_EASE },
  );
  const sigilY = useTransform(
    progress,
    reduceMotion ? [0, 1] : [0, 0.68, 0.92, 1],
    reduceMotion ? ["0vh", "0vh"] : ["0vh", "0vh", "12vh", "12vh"],
    { ease: FINAL_SCENE_EASE },
  );
  const sigilRotate = useTransform(
    progress,
    reduceMotion ? [0, 1] : [0.1, 0.54, 0.86, 1],
    reduceMotion ? [0, 0] : [-5, 3, 0, 0],
    { ease: FINAL_SCENE_EASE },
  );
  const footerY = useTransform(
    progress,
    reduceMotion ? [0, 1] : [0, 0.64, 0.94, 1],
    reduceMotion ? ["0vh", "0vh"] : ["110vh", "110vh", "0vh", "0vh"],
    { ease: FINAL_SCENE_EASE },
  );
  const footerOpacity = useTransform(
    progress,
    reduceMotion ? [0, 0.48, 0.54, 1] : [0, 0.66, 0.94, 1],
    [0, 0, 1, 1],
    { ease: FINAL_SCENE_EASE },
  );
  const progressScale = useTransform(progress, [0, 1], [0, 1]);

  return (
    <section
      ref={ref}
      className="relative h-[300svh] bg-transparent text-linen md:h-[280vh]"
      style={{
        "--color-linen": "#f9f8f6",
        "--color-stone-beige": "#d9d4cc",
        "--color-couture-red": "#e44b61",
      } as CSSProperties}
    >
      <div className="sticky top-0 h-svh overflow-hidden px-5 py-20 md:px-[4vw] md:py-24">
        <div className="pointer-events-none absolute inset-0 opacity-[0.035]" style={{
          backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "clamp(52px, 7vw, 104px) clamp(52px, 7vw, 104px)",
        }} aria-hidden="true" />

        <div className="relative mx-auto h-full max-w-[90rem]">
        <motion.div
          data-final-intro
          className="relative z-20 max-w-[48rem] pt-4 md:pt-0"
          style={{ y: introY, opacity: introOpacity }}
        >
          <p className="mb-6 max-w-sm font-serif text-lg italic text-stone-beige/65 md:mb-8 md:text-xl">
            The final choice is instinctive.
          </p>
          <h2 className="max-w-[10ch] text-balance font-serif text-[clamp(3.2rem,7.3vw,6rem)] font-bold leading-[0.88] tracking-[-0.035em] text-linen">
            Choose the piece that <span className="font-light italic text-couture-red">remembers you.</span>
          </h2>

          <div className="mt-9 flex flex-wrap items-center gap-6 md:mt-12">
            <Link
              href="/shop"
              className="group relative inline-flex min-h-16 items-center gap-8 bg-couture-red px-8 py-4 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white transition-[filter,transform] duration-200 ease-out hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-linen active:scale-[0.98] [clip-path:polygon(5%_0,100%_8%,94%_100%,0_86%)]"
            >
              Enter the collection
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            <Link
              href="/about"
              className="group inline-flex items-center gap-2 border-b border-linen/30 pb-1.5 font-sans text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-stone-beige transition-colors hover:border-linen hover:text-linen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red active:scale-[0.98]"
            >
              The studio
              <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </motion.div>

        <div
          className="pointer-events-none absolute inset-0 z-[7]"
          aria-hidden="true"
        >
          <div className="absolute left-1/2 top-[60%] -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="final-sigil relative aspect-square h-[min(72vw,34rem)] md:h-[min(48vw,42rem)]"
              style={{ y: sigilY, scale: sigilScale, rotate: sigilRotate }}
            >
              <div className="final-sigil__aura" />
              <div className="final-sigil__mark" />
              <div className="final-sigil__edge" />
            </motion.div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-[-5%] z-10 h-[58%] md:-right-[3%] md:left-auto md:h-[78%] md:w-[64%]"
          aria-hidden="true"
        >
          <motion.div
            style={{ x: mainX, y: mainY, rotate: mainRotate, opacity: shardOpacity }}
            className="absolute left-[8%] top-0 h-[74%] w-[58%] overflow-hidden bg-[#111] [clip-path:polygon(12%_0,100%_8%,88%_100%,0_82%)]"
          >
            <Image src={images[0].image} alt="" fill sizes="(max-width: 768px) 62vw, 38vw" className="object-cover grayscale contrast-125 brightness-[0.68]" />
            <div className="absolute inset-[6%] border border-linen/20 [clip-path:polygon(8%_0,100%_8%,89%_100%,0_82%)]" />
          </motion.div>

          <motion.div
            style={{ x: rightX, y: rightY, rotate: rightRotate, opacity: shardOpacity }}
            className="absolute right-0 top-[13%] h-[58%] w-[48%] overflow-hidden bg-[#111] [clip-path:polygon(18%_8%,100%_0,92%_88%,0_100%)]"
          >
            <Image src={images[1].image} alt="" fill sizes="(max-width: 768px) 52vw, 31vw" className="object-cover grayscale contrast-125 brightness-[0.58]" />
            <div className="absolute inset-0 bg-[linear-gradient(145deg,transparent_35%,rgba(166,25,46,0.28))]" />
          </motion.div>

          <motion.div
            style={{ x: lowerLeftX, y: lowerLeftY, rotate: lowerLeftRotate, opacity: shardOpacity }}
            className="absolute bottom-0 left-0 h-[43%] w-[49%] overflow-hidden bg-[#111] [clip-path:polygon(0_18%,86%_0,100%_86%,14%_100%)]"
          >
            <Image src={images[2].image} alt="" fill sizes="(max-width: 768px) 54vw, 31vw" className="object-cover grayscale contrast-125 brightness-[0.62]" />
          </motion.div>

          <motion.div
            style={{ x: lowerRightX, y: lowerRightY, rotate: lowerRightRotate, opacity: shardOpacity }}
            className="absolute bottom-[2%] right-[7%] h-[39%] w-[43%] overflow-hidden bg-[#111] [clip-path:polygon(10%_0,100%_17%,82%_100%,0_76%)]"
          >
            <Image src={images[3].image} alt="" fill sizes="(max-width: 768px) 47vw, 27vw" className="object-cover grayscale contrast-125 brightness-[0.7]" />
          </motion.div>

        </div>

        <motion.div
          data-final-footer
          className="absolute inset-0 z-[8] flex flex-col pt-10 md:pt-0"
          style={{ y: footerY, opacity: footerOpacity }}
        >
          <FinalFooter />
        </motion.div>

        <div className="absolute bottom-0 right-0 h-20 w-px bg-linen/15" aria-hidden="true">
          <motion.div className="absolute inset-0 bg-couture-red" style={{ scaleY: progressScale, transformOrigin: "top" }} />
        </div>
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ collections }: { collections: CollectionItem[] }) {
  const isDesktop = useDesktopViewport();

  return isDesktop ? <DesktopFinalCTA collections={collections} /> : <CompactFinalCTA />;
}

export function HomePage({ collections, heroVideoSrc, content }: HomePageProps) {
  const resolvedHeroVideoSrc = heroVideoSrc ?? content?.heroVideoSrc ?? content?.heroVideo ?? [...HERO_VIDEOS];

  return (
    <HomeScrollProvider>
    <main
      className="home-experience min-h-screen overflow-x-clip bg-gradient-to-b from-[#0a0a0b] via-[#121214] to-[#070708] text-linen selection:bg-couture-red selection:text-white relative"
      style={{
        "--color-linen": "#f9f8f6",
        "--color-stone-beige": "#ddd8d1",
        "--color-couture-red": "#e44b61",
      } as CSSProperties}
    >
      {/* Fixed Technical Serials in margins */}
      <div className="fixed top-1/4 left-10 z-40 font-sans text-[10px] tracking-[0.2em] text-stone-beige/60 select-none pointer-events-none hidden xl:block" style={{ writingMode: "vertical-rl" }}>
        REF_ID // 001-SYN ⧫ 53.90° N, 27.56° E
      </div>
      <div className="fixed bottom-20 right-10 z-40 font-sans text-[10px] tracking-[0.2em] text-couture-red select-none pointer-events-none hidden xl:block rotate-180" style={{ writingMode: "vertical-rl" }}>
        ✧ DOC.VER 9.4.1 // SECURE_ARCHIVE
      </div>

      <HeroSection
        heroVideoSrc={resolvedHeroVideoSrc}
      />
      <ArchivePathway collections={collections} />
      <MaterialLab />
      <ManifestoQuote />
      <ManifestoGrid />
      <FinalCTA collections={collections} />
    </main>
    </HomeScrollProvider>
  );
}

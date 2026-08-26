"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  cubicBezier,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import type { MotionValue } from "motion/react";
import type { ReactNode, RefObject } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { ease } from "@/lib/animation";
import { trackCommerceEvent } from "@/lib/analytics/commerce";
import { PrimaryCtaButton } from "@/components/ui";
import { PerformanceVideo } from "@/components/media/performance-video";
import { buildFinalCtaImages } from "@/lib/content/home-media";

export interface CollectionItem {
  series: string;
  title: string;
  description: string;
  price: string;
  image: string;
  href: string;
}

export interface HomePageProps {
  title?: string;
  excerpt?: string;
  content?: Record<string, string>;
  collections: CollectionItem[];
  departments: DepartmentItem[];
  heroVideoSrc?: string | string[];
}

export interface DepartmentItem {
  slug: string;
  name: string;
  count: number;
  image: string;
}

type LexiconMaterial = {
  name: string;
  category: string;
  description: string;
  image: string;
  symbol: string;
  properties: string[];
};

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

function isIOSWebKitBrowser() {
  if (typeof navigator === "undefined") return false;

  const appleMobileDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const touchEnabledIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return appleMobileDevice || touchEnabledIPad;
}

function subscribeToBrowserCapability() {
  return () => undefined;
}

function HomeScrollProvider({ children }: { children: ReactNode }) {
  const scrollY = useMotionValue(0);
  const isIOSWebKit = useSyncExternalStore(
    subscribeToBrowserCapability,
    isIOSWebKitBrowser,
    () => false,
  );

  useEffect(() => {
    const isIOS = isIOSWebKitBrowser();

    // Keep iOS scrolling entirely on WebKit's compositor thread. Other
    // browsers only need the scroll position; reading it directly avoids the
    // layout measurements performed by a generic scroll observer.
    if (isIOS) return;

    const update = () => scrollY.set(window.scrollY);
    update();
    window.addEventListener("scroll", update, { passive: true });

    return () => window.removeEventListener("scroll", update);
  }, [scrollY]);

  const value = useMemo(() => ({ scrollY, isIOSWebKit }), [isIOSWebKit, scrollY]);

  return <HomeScrollContext.Provider value={value}>{children}</HomeScrollContext.Provider>;
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
    const media = window.matchMedia("(min-width: 920px)");
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
  heroImage,
  eyebrow,
  title,
  excerpt,
  ctaLabel,
  ctaHref,
}: Pick<HomePageProps, "heroVideoSrc" | "title" | "excerpt"> & { heroImage?: string; eyebrow?: string; ctaLabel?: string; ctaHref?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const videoSources = heroVideoSrc
    ? Array.isArray(heroVideoSrc)
      ? heroVideoSrc.filter(Boolean)
      : [heroVideoSrc]
    : [];
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
      className="home-hero relative flex min-h-[108svh] w-full items-end overflow-hidden bg-transparent px-5 pb-40 pt-24 md:min-h-[112vh] md:px-[4vw]"
    >
      <motion.div
        className="absolute -right-[9%] top-[4.5rem] z-0 h-[75svh] w-[96%] overflow-hidden transform-gpu [backface-visibility:hidden] md:-right-[2%] md:top-[5.5rem] md:h-[86vh] md:w-[72%]"
        style={{
          clipPath: "polygon(13% 4%, 93% 0, 100% 84%, 78% 100%, 0 91%, 5% 23%)",
        }}
      >
        <motion.div className="relative h-full w-full transform-gpu [backface-visibility:hidden]" style={{ transform: mediaTransform }}>
          {heroImage ? (
            <Image src={heroImage} alt="" fill preload quality={85} sizes="100vw" className="home-hero-media h-full w-full object-cover" aria-hidden="true" />
          ) : activeVideoSrc ? (
            <PerformanceVideo
              key={activeVideoSrc}
              eager
              autoPlay
              muted
              loop={videoSources.length === 1}
              playsInline
              preload="metadata"
              src={activeVideoSrc}
              className="home-hero-media h-full w-full object-cover"
              aria-hidden="true"
              onEnded={() => setActiveVideoIndex((index) => (index + 1) % videoSources.length)}
              onError={() => setActiveVideoIndex((index) => (index + 1) % videoSources.length)}
            />
          ) : null}
        </motion.div>

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(8,8,10,0.1)_20%,transparent_48%,rgba(8,8,10,0.65)_100%)]" />
        <div className="pointer-events-none absolute inset-[5%] border border-linen/20 [clip-path:polygon(7%_0,100%_0,100%_82%,78%_100%,0_89%,0_21%)]" />
        <div className="pointer-events-none absolute -bottom-[14%] left-[23%] h-[46%] w-[18%] -rotate-[18deg] border-x border-linen/15 bg-linen/[0.035] backdrop-blur-[2px]" aria-hidden="true" />
      </motion.div>

      <div className="home-hero-fade pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[58%]" aria-hidden="true" />

      <motion.div
        className="relative z-10 w-full transform-gpu [backface-visibility:hidden] md:pl-[4vw]"
        style={{ opacity: textOpacity, transform: textTransform }}
      >
        <div className="mb-5 flex items-center gap-4 md:mb-7">
          <span className="h-px w-10 bg-couture-red" aria-hidden="true" />
          {eyebrow ? (
            <p className="font-sans text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-linen/75">
              {eyebrow}
            </p>
          ) : null}
        </div>

        {title ? (
          <h1 className="max-w-[9ch] text-balance font-serif text-[clamp(3.4rem,9vw,6rem)] uppercase leading-[0.86] tracking-[-0.035em] text-linen">
            {title}
          </h1>
        ) : null}

        {excerpt ? (
          <p className="mt-6 max-w-[31rem] text-pretty font-sans text-sm font-medium leading-relaxed text-stone-beige/80 md:mt-8 md:text-base">
            {excerpt}
          </p>
        ) : null}

        {ctaHref && ctaLabel ? (
          <div className="mt-7 pl-8 sm:pl-14 md:mt-9">
            <PrimaryCtaButton href={ctaHref}>
              {ctaLabel}
            </PrimaryCtaButton>
          </div>
        ) : null}
      </motion.div>
    </section>
  );
}

const DEPARTMENT_NOTES: Record<string, string> = {
  jewelry: "Adornment, form, and personal symbolism",
  pets: "Considered objects for everyday care",
  kids: "Creative tools for curious hands",
  "jewelry-making": "Materials and tools for makers",
};

function DepartmentPathway({ departments }: { departments: DepartmentItem[] }) {
  const leadDepartment = departments.find((department) => department.image);

  return (
    <section className="home-department-surface relative z-20 px-6 py-24 text-linen md:px-[4vw] md:py-32" aria-labelledby="department-pathway-title">
      <div className="mx-auto grid max-w-[90rem] gap-12 md:grid-cols-[minmax(0,0.82fr)_minmax(24rem,1.18fr)] md:items-stretch md:gap-[7vw]">
        <motion.div
          className="relative min-h-[24rem] overflow-hidden md:min-h-[42rem]"
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.85, ease }}
          style={{ clipPath: "polygon(9% 0, 100% 5%, 94% 100%, 0 91%)" }}
        >
          {leadDepartment ? (
            <>
              <Image
                src={leadDepartment.image}
                alt={`${leadDepartment.name} at Synarava`}
                fill
                sizes="(max-width: 768px) 100vw, 42vw"
                className="object-cover grayscale brightness-[0.72] contrast-[1.08]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/62 via-black/5 to-transparent" aria-hidden="true" />
              <p className="absolute bottom-9 left-9 max-w-[18rem] font-sans text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white/72">
                One point of view, across every part of daily life
              </p>
            </>
          ) : (
            <div className="h-full w-full border border-linen/12 bg-linen/[0.035]" />
          )}
        </motion.div>

        <motion.div
          className="flex flex-col justify-center"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 0.8, delay: 0.08, ease }}
        >
          <h2 id="department-pathway-title" className="max-w-[10ch] text-balance font-serif text-[clamp(2.8rem,6vw,5.4rem)] leading-[0.92] tracking-[-0.035em]">
            Choose where to begin.
          </h2>
          <p className="mt-6 max-w-[34rem] text-pretty font-sans text-sm leading-7 text-stone-beige md:text-base">
            Adornment, companionship, play, and making — selected with the same eye for material, usefulness, and character.
          </p>

          <div className="mt-10 border-t border-linen/14 md:mt-14">
            {departments.map((department) => {
              const content = (
                <>
                  <span>
                    <span className="block font-serif text-[clamp(1.65rem,3vw,2.65rem)] leading-none text-linen">
                      {department.name}
                    </span>
                    <span className="mt-2 block text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-stone-beige">
                      {DEPARTMENT_NOTES[department.slug] ?? "Curated goods"}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-[0.64rem] font-semibold uppercase tracking-[0.16em]">
                    {department.count > 0 ? (
                      <>
                        {department.count} {department.count === 1 ? "piece" : "pieces"}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </>
                    ) : "Coming soon"}
                  </span>
                </>
              );

              return department.count > 0 ? (
                <Link
                  key={department.slug}
                  href={`/shop?department=${department.slug}`}
                  onClick={() => trackCommerceEvent("department_entry", {
                    department: department.slug,
                    source: "home",
                  })}
                  className="group flex min-h-28 items-center justify-between gap-6 border-b border-linen/20 py-5 text-stone-beige transition-colors hover:text-couture-red focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
                >
                  {content}
                </Link>
              ) : (
                <div key={department.slug} className="flex min-h-28 items-center justify-between gap-6 border-b border-linen/15 py-5 text-stone-beige/70">
                  {content}
                </div>
              );
            })}
          </div>

          <div className="mt-10">
            <PrimaryCtaButton href="/shop">Explore the shop</PrimaryCtaButton>
          </div>
        </motion.div>
      </div>
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
    return collections.filter((item) => item.image).slice(0, 3);
  }, [collections]);

  if (items.length < 3) {
    return null;
  }

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
                <span className="font-sans text-couture-red tracking-widest text-[10px] font-bold">{items[0].series}</span>
                <span className="font-sans text-[9px] text-stone-beige/65 text-right uppercase">
                  LOC:<br />53.90° N, 27.56° E
                </span>
              </div>
              <h2 className="font-serif text-5xl md:text-7xl text-linen mb-6 uppercase leading-[0.95] tracking-tighter">
                {items[0].title}
              </h2>
              <p className="font-sans text-[10px] text-stone-beige/80 leading-relaxed mb-8 text-justify uppercase font-bold">
                [COLLECTION NOTE]<br />
                {items[0].description}
              </p>

              {/* Technical Parameters Table */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-linen/10 py-4 font-sans text-[10px] text-linen uppercase font-bold">
                <div>
                  <span className="text-couture-red block mb-1 font-bold">COLLECTION</span>
                  {items[0].series}
                </div>
                <div>
                  <span className="text-couture-red block mb-1 font-bold">EDITION</span>
                  {items[0].price}
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
              <span className="absolute bottom-7 right-7 z-10 inline-flex items-center gap-2 bg-[#09090a]/90 px-3 py-2 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#f9f8f6] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
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
              <span className="absolute bottom-7 right-7 z-10 inline-flex items-center gap-2 bg-[#09090a]/90 px-3 py-2 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#f9f8f6] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
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
                <span className="font-sans text-couture-red tracking-widest text-[10px] font-bold text-right">{items[1].series}</span>
              </div>
              <h2 className="font-serif text-5xl md:text-7xl text-linen mb-6 uppercase leading-[0.95] tracking-tighter text-right">
                {items[1].title}
              </h2>
              <p className="font-sans text-[10px] text-stone-beige/70 leading-relaxed mb-8 text-justify uppercase font-bold">
                [COLLECTION NOTE]<br />
                {items[1].description}
              </p>

              {/* Technical Parameters Table */}
              <table className="w-full font-sans text-[10px] text-left border-collapse font-bold">
                <tbody>
                  <tr className="border-b border-linen/10">
                    <td className="py-2 text-couture-red w-1/3 font-bold">COLLECTION</td>
                    <td className="py-2 text-stone-beige uppercase">{items[1].series}</td>
                  </tr>
                  <tr className="border-b border-linen/10">
                    <td className="py-2 text-couture-red font-bold">EDITION</td>
                    <td className="py-2 text-stone-beige uppercase">{items[1].price}</td>
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
                <span className="font-sans text-couture-red tracking-widest text-[10px] font-bold">{items[2].series}</span>
                <span className="font-sans text-[9px] text-stone-beige/65 text-right uppercase">
                  LOC:<br />53.90° N, 27.56° E
                </span>
              </div>
              <h2 className="font-serif text-5xl md:text-7xl text-linen mb-6 uppercase leading-[0.95] tracking-tighter">
                {items[2].title}
              </h2>
              <p className="font-sans text-[10px] text-stone-beige/80 leading-relaxed mb-8 text-justify uppercase font-bold">
                [COLLECTION NOTE]<br />
                {items[2].description}
              </p>

              {/* Technical Parameters Table */}
              <div className="grid grid-cols-2 gap-4 border-t border-b border-linen/10 py-4 font-sans text-[10px] text-linen uppercase font-bold">
                <div>
                  <span className="text-couture-red block mb-1 font-bold">COLLECTION</span>
                  {items[2].series}
                </div>
                <div>
                  <span className="text-couture-red block mb-1 font-bold">EDITION</span>
                  {items[2].price}
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
              href={items[2].href}
              aria-label={`View ${items[2].title} collection`}
              className="group relative block h-full w-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
            >
              <ParallaxImage src={items[2].image} alt={items[2].title} clipPath="polygon(10% 0, 100% 10%, 90% 100%, 0% 90%)" />
              <span className="absolute bottom-7 right-7 z-10 inline-flex items-center gap-2 bg-[#09090a]/90 px-3 py-2 font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[#f9f8f6] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
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
      key={usesDiscreteIOSSteps ? "discrete" : "continuous"}
      initial={usesDiscreteIOSSteps ? false : undefined}
      animate={usesDiscreteIOSSteps ? discreteState : undefined}
      transition={usesDiscreteIOSSteps ? { duration: reduceMotion ? 0.16 : 0.48, ease } : undefined}
      style={usesDiscreteIOSSteps
        ? { zIndex: index + 1 }
        : { opacity, x, rotate, scale, clipPath, zIndex: index + 1 }}
      className="home-material-plate absolute inset-x-0 top-1/2 grid -translate-y-1/2 transform-gpu grid-cols-1 overflow-hidden border border-linen/15 bg-panel/94 [backface-visibility:hidden] md:grid-cols-[0.92fr_1.08fr]"
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
function MaterialLab({ collections }: { collections: CollectionItem[] }) {
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
  const materials = useMemo<LexiconMaterial[]>(
    () =>
      collections
        .filter((item) => item.image)
        .slice(0, 3)
        .map((item, index) => ({
          name: item.title,
          category: item.series,
          description: item.description,
          image: item.image,
          symbol: String(index + 1).padStart(2, "0"),
          properties: [],
        })),
    [collections],
  );

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

  if (materials.length === 0) {
    return null;
  }

  return (
    <section
      ref={ref}
      className="relative h-[330svh] bg-transparent text-linen"
      aria-labelledby="lexicon-title"
    >
      {usesDiscreteIOSSteps ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col" aria-hidden="true">
          {materials.map((material, index) => (
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
            {materials.map((material, index) => (
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
function ManifestoQuote({ quote }: { quote?: string }) {
  if (!quote) {
    return null;
  }

  return (
    <section className="home-manifesto relative overflow-hidden bg-transparent px-5 py-24 text-linen md:flex md:min-h-screen md:items-center md:justify-center md:px-[4vw] md:py-32">
      <div className="home-theme-grid pointer-events-none absolute inset-0 select-none opacity-50" />
      <div className="home-manifesto-glow pointer-events-none absolute inset-0 select-none" />

      <div className="absolute left-10 top-10 hidden origin-left rotate-90 select-none font-sans text-[10px] tracking-[0.4em] text-couture-red opacity-60 md:block">
        DIRECTIVE // 099
      </div>

      <div className="relative z-10 mx-auto flex max-w-6xl flex-col items-start md:items-center">
        <div className="mb-8 flex items-center gap-3 font-sans text-[0.62rem] font-bold uppercase tracking-[0.22em] text-couture-red md:mb-12">
          <span className="h-px w-8 bg-couture-red" aria-hidden="true" />
          06 / A principle to keep
        </div>

        <h2 className="relative max-w-5xl text-balance text-left font-serif text-[clamp(2.35rem,10.5vw,7rem)] font-light italic leading-[1.02] text-linen md:text-center">
          <span className="absolute -left-12 -top-16 hidden select-none font-serif text-[15vw] leading-none text-stone-beige opacity-10 md:block">&ldquo;</span>
          {quote}
          <span className="absolute -bottom-24 -right-12 hidden select-none font-serif text-[15vw] leading-none text-stone-beige opacity-10 md:block">&rdquo;</span>
        </h2>

        <div className="mt-10 flex items-center gap-4 md:mt-14">
          <div className="h-px w-10 bg-couture-red md:w-12" />
          <span className="font-sans text-[0.58rem] font-bold uppercase tracking-[0.2em] text-linen md:text-[10px] md:tracking-[0.25em]">
            The Synarava Manifesto // Vol 1.
          </span>
          <div className="hidden h-px w-12 bg-couture-red md:block" />
        </div>
      </div>
    </section>
  );
}

function FinalFooter() {
  return (
    <div className="mt-auto flex flex-1 flex-col justify-end gap-6 border-t border-linen/15 pb-1 pt-8 sm:flex-row sm:items-end sm:justify-between md:pt-10">
      <p className="max-w-sm font-serif text-2xl leading-tight text-linen md:text-3xl">
        Objects shaped slowly,<br />kept for a lifetime.
      </p>
      <a
        href="mailto:studio@synarava.com"
        className="inline-block w-fit border-b border-couture-red pb-1 font-sans text-xs font-semibold tracking-[0.08em] text-stone-beige transition-colors hover:text-linen focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
      >
        studio@synarava.com
      </a>
    </div>
  );
}

function CompactFinalCTA({ collections, title, body, ctaLabel, ctaHref }: { collections?: CollectionItem[]; title?: string; body?: string; ctaLabel?: string; ctaHref?: string }) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.22 });
  const reduceMotion = useReducedMotion() ?? false;
  const images = useMemo(() => buildFinalCtaImages(collections ?? []).slice(0, 2), [collections]);

  return (
    <section
      ref={ref}
      className="home-final-surface home-final-scene relative overflow-hidden px-5 pb-10 pt-20 text-linen"
    >
      <div className="home-theme-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-[48%] h-80 w-80 -translate-x-1/2 rounded-full bg-couture-red/20 blur-3xl"
        initial={false}
        animate={inView && !reduceMotion ? { scale: [0.72, 1], opacity: [0.18, 0.48] } : { scale: 1, opacity: 0.28 }}
        transition={{ duration: 0.8, ease: FINAL_SCENE_EASE }}
        aria-hidden="true"
      />
      <div className="relative mx-auto flex min-h-[min(54rem,112svh)] max-w-[90rem] flex-col">
        <motion.div
          className="flex flex-1 flex-col"
          initial={false}
          animate={inView && !reduceMotion ? { y: [28, 0], opacity: [0.72, 1] } : { y: 0, opacity: 1 }}
          transition={{ duration: 0.58, ease: FINAL_SCENE_EASE }}
        >
          <div className="relative z-20 max-w-sm pb-10">
            <p className="mb-5 flex items-center gap-3 font-sans text-[0.6rem] font-bold uppercase tracking-[0.2em] text-couture-red">
              <span className="h-px w-8 bg-couture-red" aria-hidden="true" />
              07 / Continue the story
            </p>
            <p className="font-serif text-base italic leading-7 text-stone-beige">
              {body}
            </p>
            <h2 className="mt-5 max-w-[10ch] text-balance font-serif text-[clamp(3rem,14vw,4.5rem)] font-bold leading-[0.88] tracking-[-0.04em] text-linen">
              {title}
            </h2>
            <Link
              href={ctaHref!}
              className="mt-8 inline-flex min-h-14 items-center gap-4 bg-couture-red px-6 py-3 font-sans text-[0.66rem] font-semibold uppercase tracking-[0.18em] text-white"
            >
              {ctaLabel}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>

          {images.length > 0 ? (
            <div className="relative mb-14 h-[42svh] min-h-80 overflow-visible" aria-hidden="true">
              <motion.div
                data-mobile-final-shard
                className="absolute left-[-13%] top-[6%] h-[78%] w-[70%] overflow-hidden bg-[#111] shadow-[0_28px_70px_rgba(0,0,0,0.45)] [clip-path:polygon(10%_0,100%_8%,88%_100%,0_84%)]"
                initial={false}
                animate={reduceMotion
                  ? { x: 0, y: 0, rotate: -4, opacity: 1 }
                  : inView
                    ? { x: 0, y: 0, rotate: -4, opacity: 1 }
                    : { x: "-14vw", y: "4vh", rotate: -9, opacity: 0.35 }}
                transition={{ duration: 0.78, ease: FINAL_SCENE_EASE }}
              >
                <Image
                  src={images[0].image}
                  alt=""
                  fill
                  sizes="72vw"
                  className="object-cover grayscale contrast-125 brightness-[0.68]"
                />
                <div className="absolute inset-[6%] border border-linen/25 [clip-path:polygon(8%_0,100%_8%,89%_100%,0_82%)]" />
              </motion.div>

              {images[1] ? (
                <motion.div
                  data-mobile-final-shard
                  className="absolute bottom-[1%] right-[-12%] h-[66%] w-[60%] overflow-hidden bg-[#111] shadow-[0_28px_70px_rgba(0,0,0,0.5)] [clip-path:polygon(18%_8%,100%_0,91%_90%,0_100%)]"
                  initial={false}
                  animate={reduceMotion
                    ? { x: 0, y: 0, rotate: 5, opacity: 0.92 }
                    : inView
                      ? { x: 0, y: 0, rotate: 5, opacity: 0.92 }
                      : { x: "16vw", y: "6vh", rotate: 11, opacity: 0.25 }}
                  transition={{ duration: 0.82, delay: 0.06, ease: FINAL_SCENE_EASE }}
                >
                  <Image
                    src={images[1].image}
                    alt=""
                    fill
                    sizes="62vw"
                    className="object-cover grayscale contrast-125 brightness-[0.58]"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(145deg,transparent_35%,rgba(166,25,46,0.28))]" />
                </motion.div>
              ) : null}

              <motion.div
                className="final-sigil absolute left-1/2 top-1/2 z-10 size-[clamp(10rem,48vw,13rem)] -translate-x-1/2 -translate-y-1/2"
                initial={false}
                animate={reduceMotion
                  ? { scale: 1, rotate: 3, opacity: 1 }
                  : inView
                    ? { scale: 1, rotate: 3, opacity: 1 }
                    : { scale: 0.2, rotate: -6, opacity: 0 }}
                transition={{ duration: 0.72, delay: 0.12, ease: FINAL_SCENE_EASE }}
              >
                <div className="final-sigil__aura" />
                <div className="final-sigil__mark" />
                <div className="final-sigil__edge" />
              </motion.div>
            </div>
          ) : null}

          <FinalFooter />
        </motion.div>
      </div>
    </section>
  );
}

// 7. FINAL CTA — cubist shop portal
function DesktopFinalCTA({ collections, title, body, ctaLabel, ctaHref }: { collections: CollectionItem[]; title?: string; body?: string; ctaLabel?: string; ctaHref?: string }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const images = useMemo(() => buildFinalCtaImages(collections), [collections]);
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

  if (images.length !== 4) {
    return (
      <CompactFinalCTA
        collections={collections}
        title={title}
        body={body}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
      />
    );
  }

  return (
    <section
      ref={ref}
      className="home-final-surface home-final-scene relative h-[300svh] text-linen md:h-[280vh]"
    >
      <div className="sticky top-0 h-svh overflow-hidden px-5 py-20 md:px-[4vw] md:py-24">
        <div className="home-theme-grid pointer-events-none absolute inset-0" aria-hidden="true" />

        <div className="relative mx-auto h-full max-w-[90rem]">
        <motion.div
          data-final-intro
          className="relative z-20 max-w-[48rem] pt-4 md:pt-0"
          style={{ y: introY, opacity: introOpacity }}
        >
          <p className="mb-6 max-w-sm font-serif text-lg italic text-stone-beige md:mb-8 md:text-xl">
            {body}
          </p>
          <h2 className="max-w-[10ch] text-balance font-serif text-[clamp(3.2rem,7.3vw,6rem)] font-bold leading-[0.88] tracking-[-0.035em] text-linen">
            {title}
          </h2>

          <div className="mt-9 flex flex-wrap items-center gap-6 md:mt-12">
            <Link
              href={ctaHref!}
              className="group relative inline-flex min-h-16 items-center gap-8 bg-couture-red px-8 py-4 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-white transition-[filter,transform] duration-200 ease-out hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-linen active:scale-[0.98] [clip-path:polygon(5%_0,100%_8%,94%_100%,0_86%)]"
            >
              {ctaLabel}
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

function FinalCTA({ collections, title, body, ctaLabel, ctaHref }: { collections: CollectionItem[]; title?: string; body?: string; ctaLabel?: string; ctaHref?: string }) {
  const isDesktop = useDesktopViewport();
  const scrollContext = useContext(HomeScrollContext);
  const isIOSWebKit = scrollContext?.isIOSWebKit ?? false;

  if (!title || !body || !ctaLabel || !ctaHref) {
    return null;
  }

  return isDesktop && !isIOSWebKit
    ? collections.length > 0
      ? <DesktopFinalCTA collections={collections} title={title} body={body} ctaLabel={ctaLabel} ctaHref={ctaHref} />
      : <CompactFinalCTA collections={collections} title={title} body={body} ctaLabel={ctaLabel} ctaHref={ctaHref} />
    : <CompactFinalCTA collections={collections} title={title} body={body} ctaLabel={ctaLabel} ctaHref={ctaHref} />;
}

export function HomePage({ collections, departments, heroVideoSrc, content }: HomePageProps) {
  const resolvedHeroVideoSrc = heroVideoSrc ?? content?.heroVideoSrc ?? content?.heroVideo;

  return (
    <HomeScrollProvider>
    <main
      className="home-experience relative min-h-screen overflow-x-clip text-linen selection:bg-couture-red selection:text-white"
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
        heroImage={content?.heroImage}
        eyebrow={content?.eyebrow}
        title={content?.heroTitle}
        excerpt={content?.heroBody}
        ctaLabel={content?.ctaLabel}
        ctaHref={content?.ctaHref}
      />
      <DepartmentPathway departments={departments} />
      <ArchivePathway collections={collections} />
      <MaterialLab collections={collections} />
      <ManifestoQuote quote={content?.quote} />
      <FinalCTA
        collections={collections}
        title={content?.secondaryTitle}
        body={content?.secondaryBody}
        ctaLabel={content?.ctaLabel}
        ctaHref={content?.ctaHref}
      />
    </main>
    </HomeScrollProvider>
  );
}

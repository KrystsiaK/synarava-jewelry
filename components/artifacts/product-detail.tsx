"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
  useInView,
  useReducedMotion,
  AnimatePresence,
} from "motion/react";
import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { PerformanceVideo } from "@/components/media/performance-video";
import { PrimaryCtaButton } from "@/components/ui";
import type { ProductSummary } from "@/lib/content/catalog";

const ease = [0.22, 1, 0.36, 1] as const;

/* ─── Hero ───────────────────────────────────────────────────────── */
function ProductHero({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "12%"]);
  const textY = useTransform(scrollYProgress, [0, 0.7], ["0%", "-5%"]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.62], [1, 0.14]);

  const words = product.title.split(" ");
  const heroDescription = product.shortDescription.trim() || product.description.trim();
  const availability = product.stockOnHand > 0
    ? `${product.stockOnHand} ${product.stockOnHand === 1 ? "piece" : "pieces"} ready`
    : "Currently unavailable";
  const quickFacts = [
    ...(product.sku ? [{ label: "SKU", value: product.sku }] : []),
    { label: "Availability", value: availability },
    ...(product.variantCount > 1
      ? [{ label: "Variants", value: String(product.variantCount) }]
      : []),
    ...(product.compareAtPrice
      ? [{ label: "Original price", value: product.compareAtPrice }]
      : []),
    ...(product.materialLine
      ? [{ label: "Composition", value: product.materialLine }]
      : []),
  ];

  return (
    <motion.header
      ref={ref}
      className="relative flex min-h-[100svh] items-end overflow-hidden bg-background pt-24 text-foreground md:min-h-screen md:pt-28"
    >
      <motion.div
        className="absolute right-0 top-24 h-[48svh] w-full overflow-hidden md:right-0 md:top-28 md:h-[78vh] md:w-[68%] md:[clip-path:polygon(9%_0,100%_0,100%_100%,0_92%)]"
        style={reduceMotion ? undefined : { y: imgY }}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.25, ease, delay: 0.1 }}
      >
        {product.image ? (
          <Image
            src={product.image}
            alt={product.title}
            fill
            preload
            quality={90}
            sizes="(max-width: 768px) 100vw, 68vw"
            className="object-cover brightness-[0.88] contrast-[1.06] saturate-[1.08]"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-background/5 via-transparent to-background/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/5 to-transparent" />
      </motion.div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%] bg-gradient-to-t from-background via-background/92 to-transparent" />
      <div className="pointer-events-none absolute -right-6 bottom-[4%] hidden font-serif text-[16vw] leading-none text-foreground/[0.025] md:block [writing-mode:vertical-rl]">
        {product.departmentName || "PRODUCT"}
      </div>

      <div className="site-shell relative z-10 w-full pb-6 pt-[38svh] md:grid md:grid-cols-12 md:pb-[6vh] md:pt-36">
        <motion.div
          className="md:col-span-7 lg:col-span-6 xl:col-span-7"
          style={reduceMotion ? undefined : { y: textY, opacity: textOpacity }}
        >
          <motion.nav
            className="mb-2 flex items-center gap-2 text-[0.65rem] font-sans font-semibold uppercase tracking-[0.2em] text-foreground/48 md:mb-5 md:text-[0.68rem]"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <Link href="/shop" className="transition-colors hover:text-couture-red">Shop</Link>
            <span className="text-foreground/20">/</span>
            <span className="text-foreground/60">
              {product.categoryName || product.departmentName || "Product"}
            </span>
          </motion.nav>

          <h1
            className="max-w-[12ch] text-balance font-serif text-[clamp(2.65rem,6.3vw,6rem)] leading-[0.91] tracking-[-0.035em] md:leading-[0.94]"
          >
            {words.map((word, i) => (
              <span
                key={i}
                className={`mr-[0.16em] inline-block overflow-hidden pb-[0.28em] align-bottom last:mr-0 ${
                  i === words.length - 1 ? "font-serif italic text-couture-red" : ""
                }`}
              >
                <motion.span
                  className="inline-block"
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.95, ease, delay: 0.1 + i * 0.1 }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </h1>

          {heroDescription ? (
            <motion.p
              className="mt-3 max-w-[60ch] text-pretty text-sm leading-[1.6] text-foreground/74 md:mt-6 md:text-base md:leading-[1.75]"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease, delay: 0.55 }}
            >
              {heroDescription}
            </motion.p>
          ) : null}

          {product.materialLine ? (
            <motion.p
              className="mt-3 label-caps text-foreground/50 md:mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease, delay: 0.7 }}
            >
              {product.materialLine}
            </motion.p>
          ) : null}

          <motion.div
            className="mt-5 md:mt-8"
          >
            <div className="flex flex-wrap items-center gap-6">
              <AddToCartButton productSlug={product.slug} />
              <span className="font-serif text-2xl text-foreground md:text-3xl">
                {product.price}
              </span>
            </div>

          </motion.div>

          {product.tagNames.length > 0 && (
            <motion.div
              className="mt-6 hidden flex-wrap items-center gap-x-3 gap-y-2 sm:flex"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, ease, delay: 1 }}
            >
              {product.tagNames.map((tag, index) => (
                <span key={tag} className="contents">
                  {index > 0 && <span className="text-couture-red/55">◆</span>}
                  <span className="font-sans text-[0.65rem] uppercase tracking-[0.18em] text-foreground/42">
                    {tag}
                  </span>
                </span>
              ))}
            </motion.div>
          )}
        </motion.div>

        <motion.dl
          className="mt-8 grid grid-cols-2 border-y border-foreground/18 md:col-span-5 md:col-start-8 md:mt-0 md:self-end"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease, delay: 0.78 }}
        >
          {quickFacts.map((fact) => (
            <div
              key={fact.label}
              className="min-w-0 border-b border-foreground/12 py-3 pr-4 odd:border-r odd:pl-0 even:pl-4 last:border-b-0 [&:nth-last-child(2):nth-child(odd)]:border-b-0 md:py-4"
            >
              <dt className="font-sans text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-foreground/42">
                {fact.label}
              </dt>
              <dd className="mt-1 break-words text-sm leading-5 text-foreground/82">
                {fact.value}
              </dd>
            </div>
          ))}
        </motion.dl>
      </div>
    </motion.header>
  );
}

function ProductSpecifications({ product }: { product: ProductSummary }) {
  type SpecificationRow = {
    label: string;
    value: string;
    characteristic?: ProductSummary["characteristics"][number];
  };
  const groups = new Map<string, SpecificationRow[]>();
  const add = (group: string, row: SpecificationRow) => {
    if (!row.value.trim()) return;
    groups.set(group, [...(groups.get(group) ?? []), row]);
  };

  if (product.vendor && product.vendor.toLowerCase() !== "synarava") {
    add("Product identity", { label: "Designer / vendor", value: product.vendor });
  }
  if (product.shopifyCategoryName) {
    add("Product identity", { label: "Shopify category", value: product.shopifyCategoryName });
  }
  for (const option of product.options) {
    add("Options", { label: option.name, value: option.values.join(", ") });
  }
  for (const variant of product.variantDetails) {
    const variantLabel = variant.title && variant.title !== "Default Title" ? variant.title : "Primary variant";
    if (variant.barcode) add("Variant details", { label: `${variantLabel} barcode`, value: variant.barcode });
    if (variant.weightGrams != null) add("Variant details", { label: `${variantLabel} shipping weight`, value: `${variant.weightGrams} g` });
    if (product.variantDetails.length > 1) {
      add("Variant details", {
        label: variantLabel,
        value: `${variant.sku} · ${variant.price} · ${variant.stockOnHand} available`,
      });
    }
  }

  product.characteristics.forEach((characteristic, index) => {
    const attribute = product.attributes[index];
    if (!attribute?.value) return;
    add(characteristic.group, { ...attribute, characteristic });
  });
  if (product.characteristics.length === 0) {
    for (const attribute of product.attributes) add("Product details", attribute);
    if (product.attributes.length === 0 && product.materialLine) {
      add("Materials & construction", { label: "Material composition", value: product.materialLine });
    }
  }

  const specificationGroups = [...groups.entries()];
  if (!product.departmentName && specificationGroups.length === 0) return null;

  return (
    <section className="border-y border-foreground/10 bg-surface py-16 md:py-20">
      <div className="site-shell grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <p className="label-mono text-couture-red">Product information</p>
          <h2 className="mt-4 max-w-sm font-serif text-[clamp(2rem,4vw,3.5rem)] leading-none">
            Details that matter
          </h2>
          {product.departmentName ? (
            <p className="mt-5 text-sm uppercase tracking-[0.16em] text-foreground/50">
              {product.departmentName}
              {product.categoryName ? ` / ${product.categoryName}` : ""}
            </p>
          ) : null}
        </div>

        {specificationGroups.length > 0 ? (
          <div className="grid content-start gap-10">
            {specificationGroups.map(([group, rows]) => (
              <section key={group} aria-labelledby={`spec-${group.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
                <h3 id={`spec-${group.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} className="mb-3 font-serif text-xl text-foreground/88">
                  {group}
                </h3>
                <dl className="grid border-t border-foreground/12">
                  {rows.map((row) => (
                    <div key={`${row.label}-${row.value}`} className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-6 border-b border-foreground/12 py-4">
                      <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-foreground/45">{row.label}</dt>
                      <dd className="flex items-start justify-between gap-4 text-sm leading-6 text-foreground/82">
                        <span>{row.characteristic?.valueType === "BOOLEAN" && row.characteristic.booleanValue ? "✓ Yes" : row.value}</span>
                        {row.characteristic?.certificateUrl ? (
                          <a href={row.characteristic.certificateUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-couture-red underline-offset-4 hover:underline">
                            Certificate
                          </a>
                        ) : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CommerceMediaGallery({ product }: { product: ProductSummary }) {
  const primary = product.image;
  const media = product.commerceMedia.filter((item, index, all) =>
    item.src !== primary && all.findIndex((candidate) => candidate.src === item.src) === index,
  );
  if (media.length === 0) return null;

  return (
    <section className="border-b border-foreground/10 bg-background py-10 md:py-16" aria-label="Product gallery">
      <div className="site-shell flex snap-x gap-4 overflow-x-auto pb-3 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
        {media.map((item) => (
          <figure key={item.src} className="relative aspect-[4/5] min-w-[78vw] snap-center overflow-hidden bg-surface md:min-w-0">
            <Image
              src={item.src}
              alt={item.alt || product.title}
              fill
              sizes="(max-width: 768px) 78vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-700 ease-out hover:scale-[1.015] motion-reduce:transition-none"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}

function ProductDescription({ product }: { product: ProductSummary }) {
  const description = product.description.trim();
  const shortDescription = product.shortDescription.trim();
  if (!description || !shortDescription || description === shortDescription) return null;

  return (
    <section className="bg-background py-20 md:py-28">
      <div className="site-shell grid gap-8 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-4">
          <p className="label-mono text-couture-red">Object notes</p>
          <h2 className="mt-4 max-w-xs text-balance font-serif text-[clamp(2rem,4vw,3.5rem)] leading-none">
            The piece, in full
          </h2>
        </div>
        <div className="md:col-span-7 md:col-start-6">
          <p className="max-w-[68ch] text-pretty text-base leading-[1.9] text-foreground/72 md:text-lg">
            {description}
          </p>
          <div className="mt-10 flex items-center gap-4" aria-hidden="true">
            <span className="h-px w-16 bg-couture-red/70" />
            <span className="h-2 w-2 rotate-45 border border-couture-red" />
            <span className="h-px flex-1 bg-foreground/10" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Materials strip ────────────────────────────────────────────── */
function MaterialsScrollSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const [activeMaterial, setActiveMaterial] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });
  const trackX = useTransform(scrollYProgress, [0, 1], ["0%", "-66.6667%"]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    const next = Math.min(
      product.materials.length - 1,
      Math.round(latest * (product.materials.length - 1)),
    );
    setActiveMaterial((current) => (current === next ? current : next));
  });

  return (
    <section
      ref={ref}
      className={
        reduceMotion
          ? "relative overflow-hidden bg-surface py-20"
          : "relative h-[calc(100svh_+_164vw_+_48px)] overflow-clip bg-surface md:h-[calc(100svh_+_116vw_+_48px)] lg:h-[calc(100svh_+_88vw_+_48px)] xl:h-[calc(100svh_+_76vw_+_48px)]"
      }
    >
      <div
        className={
          reduceMotion
            ? "relative"
            : "sticky top-0 flex h-screen flex-col justify-center overflow-hidden pb-8 pt-28"
        }
      >
        <div className="site-shell mb-8 flex items-end justify-between gap-6 md:mb-10">
          <div>
            <p className="label-mono mb-3 text-couture-red">{product.materialsEyebrow}</p>
            <h2 className="text-balance font-serif text-[clamp(2rem,4vw,3.4rem)] leading-none">
              {product.materialsTitle}
            </h2>
          </div>
          <p className="label-mono shrink-0 text-foreground/45">
            {String(activeMaterial + 1).padStart(2, "0")} / {String(product.materials.length).padStart(2, "0")}
          </p>
        </div>

        <div className="site-shell mb-7 h-px bg-foreground/10">
          <motion.div
            className="h-full origin-left bg-couture-red"
            style={reduceMotion ? undefined : { scaleX: scrollYProgress }}
          />
        </div>

        <motion.div
          className={
            reduceMotion
              ? "site-shell grid gap-8"
              : "flex w-max gap-6 pl-5 pr-5 md:pl-[4vw] md:pr-[4vw]"
          }
          style={reduceMotion ? undefined : { x: trackX }}
        >
          {product.materials.map((item, index) => (
            <article
              key={item.title}
              className={
                reduceMotion
                  ? "grid gap-5 border-t border-foreground/10 pt-6 md:grid-cols-2"
                  : "grid h-[62vh] min-h-[31rem] w-[82vw] shrink-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden bg-background/35 md:h-[66vh] md:w-[58vw] lg:w-[44vw] xl:w-[38vw]"
              }
            >
              <div className="artifact-hover-image-wrap relative min-h-[18rem] overflow-hidden bg-charcoal">
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  sizes="(max-width: 768px) 82vw, 58vw"
                  className="artifact-hover-image object-cover grayscale contrast-[1.06] transition-[filter,transform] duration-700 hover:scale-[1.025] hover:grayscale-0"
                />
                <span className="absolute bottom-5 right-5 font-serif text-7xl leading-none text-white/15">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="flex items-start justify-between gap-8 border-t border-foreground/10 px-6 py-6 md:px-8">
                <div>
                  <h3 className="label-caps text-foreground">{item.title}</h3>
                  <p className="mt-3 max-w-md text-base leading-[1.75] text-foreground/65">
                    {item.body}
                  </p>
                </div>
                <span className="mt-1 h-2 w-2 shrink-0 rotate-45 border border-couture-red" />
              </div>
            </article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function MaterialsSection({ product }: { product: ProductSummary }) {
  if (
    product.materials.length === 0 ||
    !product.materialsEyebrow ||
    !product.materialsTitle
  ) {
    return null;
  }

  return <MaterialsScrollSection product={product} />;
}

/* ─── Symbolism ──────────────────────────────────────────────────── */
function SymbolismScrollSection({
  product,
  materialTerms,
  symbolismImage,
}: {
  product: ProductSummary;
  materialTerms: string[];
  symbolismImage: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.035, 0.995]);
  const bodyLead = product.symbolismBody.charAt(0);
  const bodyRemainder = product.symbolismBody.slice(1);

  return (
    <section ref={ref} className="overflow-clip border-y border-foreground/10 bg-surface py-24 md:py-36">
      <div className="site-shell">
        <header className="grid gap-8 border-b border-foreground/15 pb-9 md:grid-cols-12 md:items-end md:pb-12">
          <div className="md:col-span-9">
            <h2 className="text-balance font-serif text-[clamp(3.6rem,9vw,6rem)] leading-[0.84] tracking-[-0.035em]">
              {product.symbolismLabel}
            </h2>
          </div>
        </header>

        <div className="grid border-b border-foreground/15 lg:grid-cols-[minmax(0,1fr)_15rem]">
          <figure className="border-foreground/15 py-6 lg:border-r lg:py-9 lg:pr-9">
            <div className="relative aspect-[4/3] overflow-hidden md:aspect-[16/9]">
              <motion.div
                className="relative h-full w-full will-change-transform"
                style={reduceMotion ? undefined : { scale: imgScale }}
              >
                <Image
                  src={symbolismImage}
                  alt="Jewelry worn as a symbolic detail"
                  fill
                  sizes="(max-width: 1024px) 100vw, 75vw"
                  className="object-cover grayscale contrast-[1.08]"
                />
              </motion.div>
              <div className="pointer-events-none absolute inset-4 border border-white/25 md:inset-6" />
            </div>
            {product.collectionName ? (
              <figcaption className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                {product.collectionName}
              </figcaption>
            ) : null}
          </figure>

          <aside className="grid grid-cols-3 border-t border-foreground/15 lg:grid-cols-1 lg:border-t-0">
            {materialTerms.map((term, index) => (
              <div
                key={term}
                className="flex min-h-24 items-center border-foreground/15 px-3 py-5 not-last:border-r lg:min-h-0 lg:px-7 lg:not-last:border-b lg:not-last:border-r-0"
              >
                <span className="mr-3 text-[0.62rem] font-semibold text-couture-red">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-foreground/70 md:text-xs">
                  {term}
                </span>
              </div>
            ))}
          </aside>
        </div>

        <div className="border-b border-foreground/15 py-10 md:py-14">
          <div className="flex flex-col gap-2 md:gap-0">
            {materialTerms.map((term, index) => (
              <p
                key={`${term}-display`}
                className={
                  index === 0
                    ? "font-serif text-[clamp(2.8rem,7vw,5.6rem)] leading-[0.9] tracking-[-0.035em]"
                    : index === 1
                      ? "self-end font-serif text-[clamp(3.2rem,8vw,6rem)] italic leading-[0.86] tracking-[-0.035em] text-couture-red md:pr-[8vw]"
                      : "max-w-full overflow-hidden text-[clamp(1.85rem,5vw,4.5rem)] font-light uppercase leading-none tracking-[0.08em] text-foreground/75"
                }
              >
                {term}
                <span className="text-couture-red">.</span>
              </p>
            ))}
          </div>
        </div>

        <div className="grid gap-12 pt-12 md:grid-cols-12 md:gap-8 md:pt-16">
          <div className="md:col-span-5">
            <p className="max-w-md text-pretty font-serif text-[clamp(1.75rem,3.5vw,3rem)] italic leading-[1.18] text-foreground/92">
              {product.symbolismBody2}
            </p>
          </div>
          <div className="md:col-span-6 md:col-start-7">
            <p className="max-w-2xl text-pretty text-base leading-[1.85] text-foreground/68 md:text-lg">
              {bodyLead && (
                <span className="float-left mr-3 mt-1 font-serif text-6xl leading-[0.72] text-couture-red">
                  {bodyLead}
                </span>
              )}
              {bodyRemainder}
            </p>
            <div className="mt-10 flex items-center gap-4" aria-hidden="true">
              <span className="h-px w-14 bg-foreground/20" />
              <span className="h-2 w-2 rotate-45 border border-couture-red" />
              <span className="h-px flex-1 bg-foreground/10" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SymbolismSection({ product }: { product: ProductSummary }) {
  const materialTerms = product.symbolismTitle
    .split(",")
    .map((term) => term.trim())
    .filter(Boolean);
  const symbolismImage = product.lookbook[0]?.src || product.image;

  if (
    !product.symbolismLabel ||
    materialTerms.length === 0 ||
    !product.symbolismBody ||
    !product.symbolismBody2 ||
    !symbolismImage
  ) {
    return null;
  }

  return (
    <SymbolismScrollSection
      product={product}
      materialTerms={materialTerms}
      symbolismImage={symbolismImage}
    />
  );
}

/* ─── Craftsmanship / Stats editorial section ───────────────────── */
function CraftSection({ product, fitVideoSrc }: { product: ProductSummary; fitVideoSrc?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  async function toggleVideo() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      await video.play();
    } else {
      video.pause();
    }
  }

  const processMedia = fitVideoSrc || product.process.mediaImage;
  if (!product.process.eyebrow || !product.process.title) {
    return null;
  }

  return (
    <section className="product-craft-section relative overflow-clip border-y border-stroke bg-surface py-24 text-foreground md:py-36">
      <div className="site-shell">
        <header className="grid gap-8 pb-10 md:grid-cols-12 md:items-end md:pb-14">
          <div className="md:col-span-8">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.22em] text-couture-red">
              {product.process.eyebrow}
            </p>
            <h2 className="text-balance font-serif text-[clamp(3.3rem,7.5vw,6rem)] leading-[0.9] tracking-[-0.035em]">
              {product.process.title}
            </h2>
          </div>
          {product.shortDescription ? (
            <p className="max-w-sm text-pretty text-base leading-8 text-foreground/62 md:col-span-4 md:pb-1">
              {product.shortDescription}
            </p>
          ) : null}
        </header>

        <figure className="border-y border-foreground/12 py-5 md:py-8">
          {processMedia ? <div className="relative aspect-[4/5] overflow-hidden bg-charcoal md:aspect-[16/9]">
            {fitVideoSrc ? (
              <PerformanceVideo
                ref={videoRef}
                className="h-full w-full object-cover grayscale contrast-[1.08]"
                src={fitVideoSrc}
                poster={product.process.mediaImage || undefined}
                autoPlay={!reduceMotion}
                muted
                loop
                playsInline
                preload="metadata"
                onPlay={() => setIsVideoPlaying(true)}
                onPause={() => setIsVideoPlaying(false)}
                aria-label={`${product.title} worn on the body`}
              />
            ) : product.process.mediaImage ? (
              <Image src={product.process.mediaImage} alt={`${product.title} worn on the body`} fill sizes="100vw" className="object-cover grayscale contrast-[1.08]" />
            ) : null}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
            <div className="pointer-events-none absolute inset-4 border border-white/20 md:inset-7" />
            <p className="absolute left-7 top-7 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/72 md:left-11 md:top-11">
              Fit film / {product.series}
            </p>
            {fitVideoSrc ? <button
              type="button"
              onClick={toggleVideo}
              aria-pressed={isVideoPlaying}
              aria-label={isVideoPlaying ? "Pause fit film" : "Play fit film"}
              className="absolute bottom-7 right-7 flex min-h-12 items-center gap-3 border border-white/30 bg-black/35 px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition-[background-color,border-color,transform] duration-200 hover:border-white/55 hover:bg-black/55 active:scale-[0.97] md:bottom-11 md:right-11"
            >
              <span className="flex h-5 w-5 items-center justify-center" aria-hidden="true">
                {isVideoPlaying ? (
                  <span className="flex gap-1">
                    <span className="h-3.5 w-0.5 bg-current" />
                    <span className="h-3.5 w-0.5 bg-current" />
                  </span>
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </span>
              {isVideoPlaying ? "Pause" : "Play"}
            </button> : null}
          </div> : null}
          {product.process.stats.length > 0 ? (
            <figcaption className={`grid gap-5 sm:grid-cols-2 lg:grid-cols-4 ${processMedia ? "pt-5 md:pt-7" : "py-3"}`}>
              {product.process.stats.map((stat) => (
                <div key={`${stat.value}-${stat.label}`} className="border-t border-foreground/15 pt-4">
                  <p className="font-serif text-3xl text-foreground">{stat.value}</p>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-foreground/48">
                    {stat.label}
                  </p>
                </div>
              ))}
            </figcaption>
          ) : null}
        </figure>

        <div className="grid gap-8 pt-10 md:grid-cols-12 md:items-center md:pt-14">
          <div className="md:col-span-7">
            <p className="max-w-2xl text-pretty text-base leading-8 text-foreground/65">
              {product.shortDescription}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6 md:col-span-5 md:justify-end">
            <span className="font-serif text-2xl text-foreground md:text-3xl">
              {product.price}
            </span>
            <AddToCartButton productSlug={product.slug} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Lookbook ───────────────────────────────────────────────────── */
function lookbookClasses(index: number, item: ProductSummary["lookbook"][number], total: number) {
  if (item.featured || index === 0) {
    return "md:col-span-2 md:row-span-2";
  }

  if (index === 1) {
    return "md:col-span-2";
  }

  if (total === 3 && index === 2) {
    return "col-span-2 md:col-span-2";
  }

  return "";
}

function LookbookSection({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-8%" });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (
    product.lookbook.length === 0 ||
    !product.lookbookEyebrow ||
    !product.lookbookTitle
  ) {
    return null;
  }

  return (
    <section ref={ref} className="site-shell py-20 md:py-32">
      <motion.div
        className="mb-10 flex items-end justify-between md:mb-14"
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7, ease }}
      >
        <div>
          <p className="label-mono mb-2 text-couture-red">{product.lookbookEyebrow}</p>
          <h2 className="font-serif" style={{ fontSize: "clamp(1.6rem,3vw,2.4rem)" }}>
            {product.lookbookTitle}
          </h2>
        </div>
        <p className="hidden label-mono text-foreground/35 md:block">
          {product.lookbook.length} images
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-3 md:h-[52rem] md:grid-cols-4 md:grid-rows-2 md:gap-4">
        {product.lookbook.map((item, i) => (
          <motion.div
            key={i}
            className={`relative overflow-hidden bg-black/5 aspect-square md:aspect-auto ${lookbookClasses(i, item, product.lookbook.length)}`}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.85, ease, delay: i * 0.1 }}
            onHoverStart={() => setHoveredIdx(i)}
            onHoverEnd={() => setHoveredIdx(null)}
          >
            <motion.div
              className="relative h-full w-full"
              animate={{ filter: hoveredIdx === i ? "grayscale(0%) contrast(1.08)" : "grayscale(40%) contrast(1.02)" }}
              transition={{ duration: 0.5 }}
            >
              <Image
                className="object-cover"
                src={item.src}
                alt={item.label || `Lookbook ${i + 1}`}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            </motion.div>
            {/* Hover overlay */}
            <AnimatePresence>
              {hoveredIdx === i && (
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.45) 0%, transparent 55%)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                />
              )}
            </AnimatePresence>
            {item.label && (
              <div className="absolute bottom-4 left-4 md:bottom-6 md:left-6">
                <motion.span
                  className="label-mono text-white/80 text-[0.7rem]"
                  initial={{ opacity: 0, y: 8 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.6, ease, delay: 0.5 + i * 0.1 }}
                >
                  {item.label}
                </motion.span>
              </div>
            )}
            {/* Red sweep on hover */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 bg-couture-red"
              animate={{ width: hoveredIdx === i ? "100%" : "0%" }}
              transition={{ duration: 0.4, ease }}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─── CTA footer ─────────────────────────────────────────────────── */
function ProductFooter({ product }: { product: ProductSummary }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-10%" });

  if (!product.collectionSlug || !product.collectionName) {
    return null;
  }

  return (
    <div ref={ref} className="relative overflow-hidden border-t border-foreground/[0.06] bg-surface py-20 md:py-28">
      {/* Ghost text */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <span
          className="select-none font-serif leading-none text-foreground"
          style={{ fontSize: "clamp(4rem,14vw,12rem)", opacity: 0.022, whiteSpace: "nowrap" }}
        >
          ARCHIVE
        </span>
      </div>

      <div className="site-shell relative z-10 flex flex-col items-center gap-8 text-center">
        <motion.div
          className="flex items-center gap-5"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.7, ease }}
        >
          <div className="h-px w-14 bg-foreground/15" />
          <div className="h-2 w-2 rotate-45 border border-couture-red" />
          <div className="h-px w-14 bg-foreground/15" />
        </motion.div>

        <motion.p
          className="label-mono text-couture-red"
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease, delay: 0.1 }}
        >
          Part of {product.collectionName}
        </motion.p>

        <motion.h2
          className="max-w-xl font-serif leading-[1.05]"
          style={{ fontSize: "clamp(1.8rem,4vw,3rem)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.85, ease, delay: 0.18 }}
        >
          Continue Exploring
        </motion.h2>

        <motion.div
          className="flex flex-col items-center gap-4 sm:flex-row sm:gap-5"
          initial={{ opacity: 0, y: 14 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease, delay: 0.28 }}
        >
          <PrimaryCtaButton href={`/collections/${product.collectionSlug}`}>
            View collection
          </PrimaryCtaButton>

          <Link
            href="/shop"
            className="label-mono border-b border-foreground/20 pb-1 text-foreground/60 transition-colors hover:border-couture-red hover:text-couture-red"
          >
            Back to shop
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */
export function ProductDetail({ product, fitVideoSrc }: { product: ProductSummary; fitVideoSrc?: string }) {
  return (
    <main
      className="product-detail-experience artifact-shell min-h-screen overflow-x-clip bg-background text-foreground"
    >
      <ProductHero product={product} />
      <CommerceMediaGallery product={product} />
      <ProductDescription product={product} />
      <ProductSpecifications product={product} />
      <MaterialsSection product={product} />
      <SymbolismSection product={product} />
      <CraftSection product={product} fitVideoSrc={fitVideoSrc} />
      <LookbookSection product={product} />
      <ProductFooter product={product} />
    </main>
  );
}

"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";

import type { ProductReviewActionState } from "@/app/actions/product-reviews";
import { localePath } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";
import { useTranslations } from "@/lib/i18n/context";
import type { ShopifyProductReviews } from "@/lib/shopify/product-reviews";

function Stars({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="inline-flex gap-1 text-couture-red" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className="size-4"
          fill={index < Math.round(rating) ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

const initialState: ProductReviewActionState = {};

export function ProductReviews({
  productSlug,
  locale,
  isSignedIn,
  data,
  submitAction,
}: {
  productSlug: string;
  locale: Locale;
  isSignedIn: boolean;
  data: ShopifyProductReviews;
  submitAction: (
    state: ProductReviewActionState,
    formData: FormData,
  ) => Promise<ProductReviewActionState>;
}) {
  const { t, plural } = useTranslations();
  const [state, formAction, pending] = useActionState(submitAction, initialState);
  const [selectedRating, setSelectedRating] = useState(0);
  const signInHref = `${localePath(locale, "/login")}?redirectTo=${encodeURIComponent(
    `${localePath(locale, `/products/${productSlug}`)}#reviews`,
  )}`;
  const displayedAverage = state.average ?? data.average;
  const displayedCount = state.count ?? data.count;
  const displayedReviews = state.reviews ?? data.reviews;

  return (
    <section id="reviews" data-component="ProductReviews" className="scroll-mt-24 border-y border-foreground/10 bg-surface py-16 md:py-24">
      <div className="site-shell">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <div>
            <h2 className="font-serif text-[clamp(2.1rem,4vw,3.8rem)] leading-none">
              {t("reviews.title")}
            </h2>
            <div className="mt-5 flex items-center gap-3">
              {displayedAverage == null ? (
                <span className="text-sm text-foreground/58">{t("reviews.noRatings")}</span>
              ) : (
                <>
                  <span className="font-serif text-3xl tabular-nums">{displayedAverage.toFixed(1)}</span>
                  <Stars rating={displayedAverage} label={`${displayedAverage.toFixed(1)} out of 5 stars`} />
                  <span className="text-sm text-foreground/58">
                    {plural("reviews.count", displayedCount)}
                  </span>
                </>
              )}
            </div>
            {displayedReviews.length > 0 ? (
              <Image
                className="mt-4 h-auto w-[116px] opacity-75"
                src="https://cdn.shopify.com/static/shop/Verified%20by%20Shop_Gray_EN.svg"
                alt="Verified by Shop"
                width={116}
                height={24}
                unoptimized
              />
            ) : null}

            <div className="mt-8 border-t border-foreground/12 pt-8">
              <h3 className="font-serif text-2xl">{t("reviews.shareTitle")}</h3>
              {isSignedIn ? (
                <form action={formAction} className="mt-5 grid gap-5">
                  <input type="hidden" name="productSlug" value={productSlug} />
                  <input type="hidden" name="locale" value={locale} />
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/62">
                      {t("reviews.ratingLabel")}
                    </span>
                    <div role="radiogroup" aria-label={t("reviews.ratingLabel")} className="mt-2 flex w-fit gap-1">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <label key={value} className="group grid size-11 cursor-pointer place-items-center">
                          <input
                            className="sr-only"
                            type="radio"
                            name="rating"
                            value={value}
                            required
                            checked={selectedRating === value}
                            onChange={() => setSelectedRating(value)}
                            aria-label={plural("reviews.star", value)}
                          />
                          <Star
                            className={`size-6 transition-colors group-hover:text-couture-red group-focus-within:outline group-focus-within:outline-2 group-focus-within:outline-offset-4 group-focus-within:outline-couture-red ${
                              value <= selectedRating
                                ? "fill-current text-couture-red"
                                : "text-foreground/28"
                            }`}
                            aria-hidden="true"
                          />
                        </label>
                      ))}
                    </div>
                    {state.fieldErrors?.rating ? <p className="mt-1 text-sm text-couture-red">{state.fieldErrors.rating}</p> : null}
                  </div>
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/62">{t("reviews.titleLabel")} <span className="normal-case tracking-normal text-foreground/40">({t("reviews.optional")})</span></span>
                    <input
                      className="border border-foreground/16 bg-background px-4 py-3 text-sm outline-none transition-colors placeholder:text-foreground/38 focus:border-couture-red"
                      name="title"
                      maxLength={120}
                      placeholder={t("reviews.titlePlaceholder")}
                      aria-invalid={Boolean(state.fieldErrors?.title)}
                    />
                    {state.fieldErrors?.title ? <span className="text-sm text-couture-red">{state.fieldErrors.title}</span> : null}
                  </label>
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/62">{t("reviews.bodyLabel")} <span className="normal-case tracking-normal text-foreground/40">({t("reviews.optional")})</span></span>
                    <textarea
                      className="min-h-32 resize-y border border-foreground/16 bg-background px-4 py-3 text-sm leading-6 outline-none transition-colors placeholder:text-foreground/38 focus:border-couture-red"
                      name="body"
                      minLength={10}
                      maxLength={2000}
                      placeholder={t("reviews.bodyPlaceholder")}
                      aria-invalid={Boolean(state.fieldErrors?.body)}
                    />
                    {state.fieldErrors?.body ? <span className="text-sm text-couture-red">{state.fieldErrors.body}</span> : null}
                  </label>
                  {state.error ? (
                    <p role="alert" className="text-sm text-couture-red">
                      {state.error}{" "}
                      {state.requiresLogin ? <Link className="underline" href={signInHref}>{t("reviews.signInAgain")}</Link> : null}
                    </p>
                  ) : null}
                  {state.success ? <p role="status" className="text-sm text-foreground/72">{state.success}</p> : null}
                  <button
                    type="submit"
                    disabled={pending}
                    className="label-caps w-fit bg-couture-red px-6 py-3 text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-55"
                  >
                    {pending ? t("reviews.publishing") : t("reviews.publish")}
                  </button>
                  <p className="max-w-[60ch] text-xs leading-5 text-foreground/45">
                    {t("reviews.storedNotice")}
                  </p>
                </form>
              ) : (
                <div className="mt-5">
                  <p className="max-w-md text-sm leading-6 text-foreground/62">
                    {t("reviews.signInBody")}
                  </p>
                  <Link
                    href={signInHref}
                    className="label-caps mt-5 inline-flex border-b border-couture-red pb-1 text-couture-red"
                  >
                    {t("reviews.signInCta")}
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="grid content-start gap-6">
            {displayedReviews.length === 0 ? (
              <div className="border-t border-foreground/14 py-8">
                <p className="font-serif text-2xl">{t("reviews.firstTitle")}</p>
                <p className="mt-3 max-w-md text-sm leading-6 text-foreground/58">
                  {t("reviews.firstBody")}
                </p>
              </div>
            ) : displayedReviews.map((review) => (
              <article key={review.id} className="border-t border-foreground/14 py-6 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Stars rating={review.rating} label={`${review.rating} out of 5 stars`} />
                  <time className="text-xs tabular-nums text-foreground/42" dateTime={review.submittedAt}>
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(review.submittedAt))}
                  </time>
                </div>
                {review.title ? <h3 className="mt-4 font-serif text-2xl">{review.title}</h3> : null}
                {review.body ? <p className="mt-3 max-w-[68ch] text-sm leading-7 text-foreground/72">{review.body}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-foreground/50">
                  <span className="font-semibold text-foreground/72">{review.authorDisplayName}</span>
                  {review.verificationStatus === "verified_buyer" ? (
                    <span className="border border-foreground/16 px-2 py-1">{t("reviews.verifiedBuyer")}</span>
                  ) : null}
                </div>
                {review.merchantReply ? (
                  <div className="mt-5 border-l border-couture-red/55 pl-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/52">{t("reviews.merchantReply")}</p>
                    <p className="mt-2 text-sm leading-6 text-foreground/68">{review.merchantReply}</p>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";
import Image from "next/image";

import type { ProductReviewActionState } from "@/app/actions/product-reviews";
import { ReviewForm } from "@/components/reviews/review-form";
import { ReviewStars } from "@/components/reviews/review-stars";
import type { Locale } from "@/lib/i18n/locales";
import { useTranslations } from "@/lib/i18n/context";
import type { ShopifyProductReviews } from "@/lib/shopify/product-reviews";
import { DisplayHeading } from "@/components/ui";

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
  const displayedAverage = state.average ?? data.average;
  const displayedCount = state.count ?? data.count;
  const displayedReviews = state.reviews ?? data.reviews;

  return (
    <section id="reviews" data-component="ProductReviews" className="scroll-mt-24 border-y border-foreground/10 bg-surface py-16 md:py-24">
      <div className="site-shell">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <div>
            <DisplayHeading
              as="h2"
              text={t("reviews.title")}
              className="text-[clamp(2.1rem,4vw,3.8rem)] leading-none"
            />
            <div className="mt-5 flex items-center gap-3">
              {displayedAverage == null ? (
                <span className="text-sm text-foreground/58">{t("reviews.noRatings")}</span>
              ) : (
                <>
                  <span className="font-serif text-3xl tabular-nums">{displayedAverage.toFixed(1)}</span>
                  <ReviewStars rating={displayedAverage} label={plural("reviews.star", displayedAverage)} />
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
              <ReviewForm
                productSlug={productSlug}
                locale={locale}
                isSignedIn={isSignedIn}
                state={state}
                formAction={formAction}
                pending={pending}
                selectedRating={selectedRating}
                onSelectRating={setSelectedRating}
              />
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
                  <ReviewStars rating={review.rating} label={plural("reviews.star", review.rating)} />
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

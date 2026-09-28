"use client";

import { useState } from "react";
import Link from "next/link";

import { ReviewStars } from "@/components/reviews/review-stars";
import { AnimatedModal } from "@/components/ui";
import { useTranslations } from "@/lib/i18n/context";
import { localeTag } from "@/lib/i18n/format";
import type { AccountReviewRow } from "@/lib/profile/account-reviews";

function reviewText(review: AccountReviewRow, ratingOnly: string) {
  return review.title.trim() || review.body.trim() || ratingOnly;
}

export function AccountReviews({ reviews }: { reviews: AccountReviewRow[] }) {
  const { t, plural, locale } = useTranslations();
  const [openId, setOpenId] = useState<string | null>(null);
  const open = reviews.find((review) => review.id === openId) ?? null;

  return (
    <div data-component="AccountReviews" className="space-y-5">
      <h2 className="font-serif text-2xl">{t("profile.reviews.title")}</h2>
      {reviews.length === 0 ? (
        <div className="border border-stroke p-8 text-foreground/50">{t("profile.reviews.empty")}</div>
      ) : (
        <div className="overflow-x-auto border border-stroke">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{t("profile.reviews.title")}</caption>
            <thead>
              <tr className="border-b border-stroke text-foreground/40">
                <th scope="col" className="label-caps px-4 py-3 font-normal">{t("profile.reviews.colProduct")}</th>
                <th scope="col" className="label-caps px-4 py-3 font-normal">{t("profile.reviews.colRating")}</th>
                <th scope="col" className="label-caps px-4 py-3 font-normal">{t("profile.reviews.colDate")}</th>
                <th scope="col" className="label-caps px-4 py-3 font-normal">{t("profile.reviews.colReview")}</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const text = reviewText(review, t("profile.reviews.ratingOnly"));
                return (
                  <tr key={review.id} className="border-b border-stroke last:border-b-0">
                    <td className="px-4 py-4 align-top">
                      {review.productHref && review.productTitle ? (
                        <Link href={review.productHref} className="font-serif text-base hover:text-couture-red">
                          {review.productTitle}
                        </Link>
                      ) : (
                        <span className="text-foreground/45">{review.productTitle ?? t("profile.reviews.missingProduct")}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <ReviewStars rating={review.rating} label={plural("reviews.star", review.rating)} className="size-3.5" />
                    </td>
                    <td className="px-4 py-4 align-top tabular-nums text-foreground/55">
                      <time dateTime={review.submittedAt}>
                        {new Intl.DateTimeFormat(localeTag(locale), { day: "2-digit", month: "short", year: "numeric" }).format(new Date(review.submittedAt))}
                      </time>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <button
                        type="button"
                        onClick={() => setOpenId(review.id)}
                        className="max-w-[28rem] text-left leading-6 text-foreground/80 underline-offset-4 hover:text-couture-red hover:underline"
                      >
                        <span className="line-clamp-2">{text}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AnimatedModal
        open={open != null}
        onClose={() => setOpenId(null)}
        ariaLabel={open ? reviewText(open, t("profile.reviews.ratingOnly")) : t("profile.reviews.title")}
      >
        {open ? (
          <div className="grid max-w-lg gap-4 bg-background p-7 md:p-9">
            <div className="flex items-start justify-between gap-4">
              <div>
                {open.productTitle ? <p className="font-serif text-2xl">{open.productTitle}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <ReviewStars rating={open.rating} label={plural("reviews.star", open.rating)} />
                  <time className="text-xs tabular-nums text-foreground/45" dateTime={open.submittedAt}>
                    {new Intl.DateTimeFormat(localeTag(locale), { day: "2-digit", month: "long", year: "numeric" }).format(new Date(open.submittedAt))}
                  </time>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="label-caps text-foreground/45 hover:text-couture-red"
              >
                {t("profile.reviews.close")}
              </button>
            </div>
            {open.title ? <h3 className="font-serif text-xl">{open.title}</h3> : null}
            {open.body ? <p className="max-w-[68ch] text-sm leading-7 text-foreground/72">{open.body}</p> : null}
            {open.verificationStatus === "verified_buyer" ? (
              <p className="w-fit border border-foreground/16 px-2 py-1 text-xs">{t("profile.reviews.verified")}</p>
            ) : null}
            {open.merchantReply ? (
              <div className="border-l border-couture-red/55 pl-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/52">{t("profile.reviews.reply")}</p>
                <p className="mt-2 text-sm leading-6 text-foreground/68">{open.merchantReply}</p>
              </div>
            ) : null}
            {open.productHref ? (
              <Link href={open.productHref} className="label-caps w-fit text-couture-red">
                {t("profile.reviews.openProduct")}
              </Link>
            ) : null}
          </div>
        ) : null}
      </AnimatedModal>
    </div>
  );
}

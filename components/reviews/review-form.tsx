"use client";

import Link from "next/link";
import { Star } from "lucide-react";

import type { ProductReviewActionState } from "@/app/actions/product-reviews";
import { ArtifactButton } from "@/components/ui";
import { useTranslations } from "@/lib/i18n/context";
import type { Locale } from "@/lib/i18n/locales";
import { localePath } from "@/lib/i18n/routing";

export function ReviewForm({
  productSlug,
  locale,
  isSignedIn,
  state,
  formAction,
  pending,
  selectedRating,
  onSelectRating,
}: {
  productSlug: string;
  locale: Locale;
  isSignedIn: boolean;
  state: ProductReviewActionState;
  formAction: (formData: FormData) => void;
  pending: boolean;
  selectedRating: number;
  onSelectRating: (rating: number) => void;
}) {
  const { t, plural } = useTranslations();
  const signInHref = `${localePath(locale, "/login")}?redirectTo=${encodeURIComponent(
    `${localePath(locale, `/products/${productSlug}`)}#reviews`,
  )}`;
  const notice = state.notice ? t(`reviews.form.${state.notice}`) : null;
  const noticeIsError = Boolean(state.notice && state.notice !== "success");

  return (
    <div data-component="ReviewForm">
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
                    onChange={() => onSelectRating(value)}
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
            {state.fieldErrors?.rating ? <p className="mt-1 text-sm text-couture-red">{t(`reviews.form.field.${state.fieldErrors.rating}`)}</p> : null}
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
            {state.fieldErrors?.title ? <span className="text-sm text-couture-red">{t(`reviews.form.field.${state.fieldErrors.title}`)}</span> : null}
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
            {state.fieldErrors?.body ? <span className="text-sm text-couture-red">{t(`reviews.form.field.${state.fieldErrors.body}`)}</span> : null}
          </label>
          {notice && noticeIsError ? (
            <p role="alert" className="text-sm text-couture-red">
              {notice}{" "}
              {state.requiresLogin ? <Link className="underline" href={signInHref}>{t("reviews.signInAgain")}</Link> : null}
            </p>
          ) : null}
          {notice && !noticeIsError ? <p role="status" className="text-sm text-foreground/72">{notice}</p> : null}
          <ArtifactButton type="submit" disabled={pending} size="md" className="w-fit">
            {pending ? t("reviews.publishing") : t("reviews.publish")}
          </ArtifactButton>
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
  );
}

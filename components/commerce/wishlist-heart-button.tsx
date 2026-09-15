"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Heart, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { useTranslations } from "@/lib/i18n/context";
import { localePath } from "@/lib/i18n/routing";
import type { Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/ui";

function signInHref(locale: Locale) {
  const returnTo = `${window.location.pathname}${window.location.search}`;
  return `${localePath(locale, "/login")}?redirectTo=${encodeURIComponent(returnTo)}`;
}

export function WishlistHeartButton({
  productSlug,
  isSignedIn,
  className,
}: {
  productSlug: string;
  isSignedIn: boolean;
  className?: string;
}) {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const errorId = useId();
  const hasInteracted = useRef(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    hasInteracted.current = false;
    let cancelled = false;
    fetch(`/api/wishlist?productSlug=${encodeURIComponent(productSlug)}`)
      .then((response) => response.json())
      .then((payload: { isSaved?: boolean }) => {
        if (!cancelled && !hasInteracted.current) setSaved(Boolean(payload.isSaved));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isSignedIn, productSlug]);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (pending) return;

    if (!isSignedIn) {
      router.push(signInHref(locale));
      return;
    }

    hasInteracted.current = true;
    const next = !saved;
    setError(null);
    setSaved(next);
    setPending(true);
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug }),
      });
      const payload = await response.json().catch(() => null) as {
        ok?: boolean;
        isSaved?: boolean;
        requiresLogin?: boolean;
        error?: string;
      } | null;
      if (!response.ok || !payload?.ok) {
        setSaved(!next);
        if (payload?.requiresLogin) {
          router.push(signInHref(locale));
        } else {
          setError(payload?.error || t("product.wishlistSaveFailed"));
        }
        return;
      }
      setSaved(Boolean(payload.isSaved));
    } catch {
      setSaved(!next);
      setError(t("product.wishlistSaveFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        aria-busy={pending}
        aria-describedby={error ? errorId : undefined}
        aria-pressed={saved}
        aria-label={saved ? t("product.removeFromWishlist") : t("product.addToWishlist")}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2 text-sm underline-offset-4 transition-colors hover:text-couture-red hover:underline disabled:cursor-wait disabled:no-underline",
          saved ? "text-couture-red" : "text-foreground/68",
          className,
        )}
      >
        <Heart
          className={cn(
            "size-4 transition-transform motion-reduce:transition-none",
            pending && "scale-90 animate-pulse motion-reduce:animate-none",
          )}
          fill={saved ? "currentColor" : "none"}
          aria-hidden="true"
        />
        <span aria-live="polite">
          {pending ? t("product.saving") : saved ? t("product.saved") : t("product.save")}
        </span>
      </button>

      {error ? (
        <span
          id={errorId}
          role="alert"
          className="absolute left-0 top-full z-20 mt-3 flex w-[min(18rem,calc(100vw-2.5rem))] items-start gap-3 border border-couture-red/25 bg-background px-4 py-3 text-xs leading-5 text-foreground shadow-[0_14px_36px_rgba(25,24,23,0.12)]"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center text-foreground/48 transition-colors hover:text-couture-red motion-reduce:transition-none"
            aria-label={t("product.dismissWishlistError")}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ) : null}
    </span>
  );
}

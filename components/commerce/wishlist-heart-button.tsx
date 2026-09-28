"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";

import { useEphemeralToast } from "@/components/ui/ephemeral-toast";
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
  const { pushToast } = useEphemeralToast();
  const hasInteracted = useRef(false);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

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
          pushToast({
            message: payload?.error || t("product.wishlistSaveFailed"),
            tone: "error",
          });
        }
        return;
      }
      setSaved(Boolean(payload.isSaved));
    } catch {
      setSaved(!next);
      pushToast({ message: t("product.wishlistSaveFailed"), tone: "error" });
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
    </span>
  );
}

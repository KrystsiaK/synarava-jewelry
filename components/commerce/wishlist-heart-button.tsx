"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
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
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    fetch(`/api/wishlist?productSlug=${encodeURIComponent(productSlug)}`)
      .then((response) => response.json())
      .then((payload: { isSaved?: boolean }) => {
        if (!cancelled) setSaved(Boolean(payload.isSaved));
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

    const next = !saved;
    setSaved(next);
    setPending(true);
    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug }),
      });
      const payload = (await response.json()) as { ok: boolean; isSaved?: boolean; requiresLogin?: boolean };
      if (!response.ok || !payload.ok) {
        setSaved(!next);
        if (payload.requiresLogin) router.push(signInHref(locale));
        return;
      }
      setSaved(Boolean(payload.isSaved));
    } catch {
      setSaved(!next);
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? t("product.removeFromWishlist") : t("product.addToWishlist")}
      className={cn(
        "inline-flex items-center gap-2 text-sm underline-offset-4 transition-colors hover:text-couture-red hover:underline",
        saved ? "text-couture-red" : "text-foreground/68",
        className,
      )}
    >
      <Heart className="size-4" fill={saved ? "currentColor" : "none"} aria-hidden="true" />
      {saved ? t("product.saved") : t("product.save")}
    </button>
  );
}

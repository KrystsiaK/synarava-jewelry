"use client";

import { useEffect, useRef, useState } from "react";

import { artifactButtonClasses } from "@/components/ui";

/**
 * Full document navigation into Shopify Customer Account OAuth.
 * The button already settles on press. Once the navigation is committed,
 * a light travels across it until the browser leaves for Shopify.
 * A second press is ignored.
 */
export function CustomerSignInLink({ href, label }: { href: string; label: string }) {
  const committed = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      committed.current = false;
      setBusy(false);
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <a
      href={href}
      data-component="CustomerSignInLink"
      aria-busy={busy || undefined}
      className={artifactButtonClasses({ className: "customer-sign-in w-full" })}
      onClick={(event) => {
        if (committed.current) {
          event.preventDefault();
          return;
        }
        committed.current = true;
        setBusy(true);
      }}
    >
      <span className="customer-sign-in__label">{label}</span>
      <span className="customer-sign-in__sheen" aria-hidden="true" />
    </a>
  );
}

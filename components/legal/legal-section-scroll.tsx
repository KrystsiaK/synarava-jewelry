"use client";

import { useEffect } from "react";

// Next.js's own client-side scroll management (the app-wide
// data-scroll-behavior="smooth" restoration) swallows the browser's native
// same-page jump to a URL fragment — on a fresh load with a hash already in
// the URL, and after clicking a plain <a href="#section-id"> from Markdown
// body content. This restores that behavior for Legal Document pages: their
// section ids already carry scroll-mt-28 to clear the sticky header, so a
// plain scrollIntoView is all that's missing. Mirrors the same
// requestAnimationFrame + scrollIntoView({behavior:"smooth"}) pattern already
// used for /shop's "back to results" jump.
export function LegalSectionScroll() {
  useEffect(() => {
    function scrollToHash(hash: string) {
      if (!hash) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      window.requestAnimationFrame(() => {
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    scrollToHash(window.location.hash);

    function onHashChange() {
      scrollToHash(window.location.hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return null;
}

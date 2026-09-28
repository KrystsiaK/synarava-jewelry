"use client";

import { useEffect, useRef, useState } from "react";

import {
  activeLegalSectionId,
  legalReadingLinePx,
  legalSpyRootMargin,
  sectionPassedReadingLine,
} from "@/components/legal/legal-section-spy";
import { cn } from "@/lib/ui";

export type LegalContentsSection = { id: string; label: string };

function rootFontSizePx(): number {
  const size = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(size) && size > 0 ? size : 16;
}

function scrollMarginTopPx(element: HTMLElement): number | null {
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop);
  return Number.isFinite(margin) ? margin : null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Sticky contents for every legal document. Hash jumps stay here (Next's
// scroll restoration swallows native fragment navigation). The same component
// marks the section currently on the reading line via IntersectionObserver.
export function LegalSectionScroll({
  contentsLabel,
  sections,
}: {
  contentsLabel: string;
  sections: readonly LegalContentsSection[];
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const passedRef = useRef(new Set<string>());
  const idsKey = sections.map((section) => section.id).join("\0");
  const currentId = sections.some((section) => section.id === activeId) ? activeId : null;

  useEffect(() => {
    function scrollToHash(hash: string) {
      if (!hash) return;
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (!target) return;
      const behavior = prefersReducedMotion() ? "auto" : "smooth";
      window.requestAnimationFrame(() => {
        target.scrollIntoView({ behavior, block: "start" });
      });
    }

    scrollToHash(window.location.hash);

    function onHashChange() {
      scrollToHash(window.location.hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const ids = idsKey.length > 0 ? idsKey.split("\0") : [];
    const elements = ids.flatMap((id) => {
      const element = document.getElementById(id);
      return element ? [element] : [];
    });
    if (elements.length === 0) return;

    passedRef.current = new Set();
    let frame = 0;

    const connect = () => {
      const readingLine = legalReadingLinePx(rootFontSizePx(), scrollMarginTopPx(elements[0]));
      const observer = new IntersectionObserver(
        (entries) => {
          const next = new Set(passedRef.current);
          for (const entry of entries) {
            const id = entry.target.id;
            if (!ids.includes(id)) continue;
            if (sectionPassedReadingLine(entry, readingLine)) next.add(id);
            else next.delete(id);
          }
          passedRef.current = next;
          setActiveId(activeLegalSectionId(ids, next));
        },
        {
          root: null,
          rootMargin: legalSpyRootMargin(readingLine, window.innerHeight),
          threshold: 0,
        },
      );

      for (const element of elements) observer.observe(element);
      return observer;
    };

    let observer = connect();

    const onResize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        observer.disconnect();
        passedRef.current = new Set();
        observer = connect();
      });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      observer.disconnect();
      passedRef.current = new Set();
    };
  }, [idsKey]);

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-28 space-y-1">
        <p className="label-caps mb-4 text-muted">{contentsLabel}</p>
        <nav aria-label={contentsLabel} className="flex flex-col gap-2">
          {sections.map((section) => {
            const current = currentId === section.id;
            return (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={current ? true : undefined}
                className={cn(
                  "label-mono transition-colors motion-reduce:transition-none hover:text-foreground!",
                  // `a { color: inherit }` is unlayered and beats Tailwind color utilities.
                  current ? "text-foreground!" : "text-muted!",
                )}
              >
                {section.label}
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

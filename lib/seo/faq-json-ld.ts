import { plainTextFromRichText } from "@/lib/content/rich-text";

export type FaqJsonLdSection = {
  title?: string | null;
  body?: string | null;
};

function nonEmpty(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

/** FAQPage schema from visible Q/A sections only (title = question, body = answer). */
export function buildFaqJsonLd(sections: readonly FaqJsonLdSection[]) {
  const mainEntity = sections.flatMap((section) => {
    const name = nonEmpty(section.title);
    const text = nonEmpty(plainTextFromRichText(section.body ?? ""));
    if (!name || !text) return [];
    return [{
      "@type": "Question" as const,
      name,
      acceptedAnswer: {
        "@type": "Answer" as const,
        text,
      },
    }];
  });

  if (mainEntity.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity,
  };
}

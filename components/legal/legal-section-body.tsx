"use client";

import type { MouseEvent } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { LegalActionLink } from "@/components/legal/legal-action-link";
import { isLegalActionHref, parseLegalActionHref } from "@/lib/content/legal-actions";
import {
  looksLikeHtml,
  sanitizeRichTextHtml,
} from "@/lib/content/rich-text";
import { OPEN_PRIVACY_PREFERENCES_EVENT } from "@/lib/privacy/consent";
import type { LegalActionId } from "@/lib/content/legal-actions";

const LEGAL_ACTION_HANDLERS: Record<LegalActionId, () => void> = {
  "cookie-settings": () => window.dispatchEvent(new Event(OPEN_PRIVACY_PREFERENCES_EVENT)),
};

const markdownComponents = {
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto border border-stroke">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
    if (href && isLegalActionHref(href)) {
      const actionId = parseLegalActionHref(href);
      return actionId ? <LegalActionLink actionId={actionId}>{children}</LegalActionLink> : <>{children}</>;
    }
    const isExternal = href ? /^https?:\/\//.test(href) : false;
    return (
      <a href={href} {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : null)}>
        {children}
      </a>
    );
  },
};

function legalUrlTransform(url: string): string {
  return isLegalActionHref(url) ? url : defaultUrlTransform(url);
}

function onRichTextClick(event: MouseEvent<HTMLDivElement>) {
  const anchor = (event.target as HTMLElement | null)?.closest("a");
  if (!anchor) return;
  const href = anchor.getAttribute("href") ?? "";
  const actionId = parseLegalActionHref(href);
  if (!actionId) return;
  event.preventDefault();
  LEGAL_ACTION_HANDLERS[actionId]();
}

/**
 * Legal section body: legacy Markdown still renders via react-markdown;
 * WYSIWYG saves land as sanitized HTML and use the rich-text path.
 */
export function LegalSectionBody({ content }: { content: string }) {
  if (!content.trim()) return null;

  if (!looksLikeHtml(content)) {
    return (
      <div className="legal-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
          urlTransform={legalUrlTransform}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className="legal-markdown rich-text"
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(content) }}
      onClick={onRichTextClick}
    />
  );
}

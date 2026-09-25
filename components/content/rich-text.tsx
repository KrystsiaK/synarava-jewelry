import { cn } from "@/lib/ui";
import {
  looksLikeHtml,
  sanitizeRichTextHtml,
} from "@/lib/content/rich-text";

type RichTextProps = {
  content: string;
  className?: string;
  /** Used for admin preview when the field is empty. */
  emptyFallback?: string;
};

/**
 * Renders plain text (whitespace preserved) or sanitized link-capable HTML.
 * Safe for service-page bodies and admin rich-text previews.
 */
export function RichText({ content, className, emptyFallback }: RichTextProps) {
  if (!content.trim()) {
    if (!emptyFallback) return null;
    return <p className={cn(className)} data-empty="true">{emptyFallback}</p>;
  }

  if (!looksLikeHtml(content)) {
    return <p className={cn("whitespace-pre-line", className)}>{content}</p>;
  }

  return (
    <div
      className={cn("rich-text", className)}
      dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(content) }}
    />
  );
}

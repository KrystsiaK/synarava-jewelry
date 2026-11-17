import {
  announcementMarqueeCopies,
  resolveAnnouncementBarText,
} from "@/lib/content/announcement-bar-display";
import type { FreeShippingMoney } from "@/lib/content/announcement-bar-fields";

type AnnouncementBarProps = {
  enabled: boolean;
  threshold: FreeShippingMoney | null;
  template: string | null | undefined;
  locale: string;
};

/**
 * Site-wide free-shipping strip above the header.
 * Fixed height + SSR text → no CLS. Marquee pauses on hover/focus;
 * prefers-reduced-motion keeps a static centered line.
 */
export function AnnouncementBar({
  enabled,
  threshold,
  template,
  locale,
}: AnnouncementBarProps) {
  const text = resolveAnnouncementBarText({ enabled, threshold, template, locale });
  if (!text) return null;

  const half = announcementMarqueeCopies(text);

  return (
    <div className="announcement-bar">
      <div className="announcement-bar__track" tabIndex={0}>
        {/* Visually hidden while marquee animates; SR reads this content (no aria-label). */}
        <p className="announcement-bar__static">{text}</p>
        <div className="announcement-bar__marquee" aria-hidden="true">
          <div className="announcement-bar__cycle">
            {half.map((copy, index) => (
              <span key={`a-${index}`}>{copy}</span>
            ))}
            {half.map((copy, index) => (
              <span key={`b-${index}`}>{copy}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import { ArtifactLink } from "@/components/ui";
import { cn } from "@/lib/ui";

type ContactCtaProps = {
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  className?: string;
};

/**
 * Shared contact banner used on service pages (FAQ, Care, Shipping, Returns,
 * Dispute Resolution). Copy is edited under admin Shared → contact CTA;
 * mailto uses the shared contact email (footer-contact-v1).
 */
export function ContactCta({ title, body, ctaLabel, href, className }: ContactCtaProps) {
  return (
    <aside
      data-component="ContactCta"
      data-testid="contact-cta"
      className={cn(
        "flex flex-col gap-5 border border-stroke bg-panel p-6 sm:flex-row sm:items-center sm:justify-between md:p-8",
        className,
      )}
    >
      <div>
        <p className="label-caps text-accent">{title}</p>
        <p className="mt-2 text-sm text-muted">{body}</p>
      </div>
      <ArtifactLink href={href} variant="inverse" size="md" className="shrink-0 self-start sm:self-center">
        {ctaLabel}
      </ArtifactLink>
    </aside>
  );
}

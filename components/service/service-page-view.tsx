import { ServicePage, type ServicePageProps } from "@/components/service/service-page";
import { getFooterContactEmail } from "@/lib/content/footer-contact";

type ServicePageViewProps = Omit<ServicePageProps, "contactEmail">;

/** Server wrapper: loads the shared contact email for {@link ContactCta}. */
export async function ServicePageView(props: ServicePageViewProps) {
  const contactEmail = await getFooterContactEmail();
  return <ServicePage {...props} contactEmail={contactEmail} />;
}

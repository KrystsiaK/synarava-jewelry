import type { Metadata } from "next";
import { ServicePage } from "@/components/service/service-page";

export const metadata: Metadata = { title: "Care & Safety", description: "Care and safety guidance for goods selected by Synarava." };

export default function CarePage() {
  return <ServicePage eyebrow="Service / Care & Safety" title="Keep it well" intro="Care depends on material and intended use. Always follow the product-specific details first; the guidance below is a general starting point." sections={[
    { title: "Jewelry", body: "Keep away from perfume, household chemicals, and prolonged moisture. Store pieces separately and wipe gently with a soft, dry cloth after wear." },
    { title: "Pet accessories", body: "Inspect fittings and surfaces regularly. Stop use if any part becomes loose, cracked, or damaged. Choose products appropriate for the animal’s size and supervise where stated." },
    { title: "Kids’ products", body: "Follow the age guidance and adult-supervision notes on the product page and packaging. Keep small parts away from children below the stated age." },
    { title: "Tools and materials", body: "Use protective equipment where appropriate and follow the manufacturer’s instructions. Store sharp tools, small parts, and consumables out of children’s reach." },
  ]} />;
}

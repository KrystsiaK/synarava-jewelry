import type { Metadata } from "next";
import { ServicePage } from "@/components/service/service-page";

export const metadata: Metadata = { title: "Returns", description: "Return and order issue guidance for Synarava purchases." };

export default function ReturnsPage() {
  return <ServicePage eyebrow="Service / Returns" title="A considered return" intro="If something is not right, contact the studio before sending an item back so we can confirm the correct route for your order." sections={[
    { title: "Start a request", body: "Email studio@synarava.com with your order number, the product name, and the reason for the request. We will reply with the applicable return instructions." },
    { title: "Condition", body: "Keep the product unused, complete, and in its original packaging while the request is reviewed. Items showing wear or missing components may not be eligible." },
    { title: "Personalised goods", body: "Custom, personalised, and made-to-order products may have different return conditions. These are confirmed before the order is produced." },
    { title: "Damage or an incorrect item", body: "Contact us promptly with clear photos of the product and packaging. Do not discard the parcel until the studio confirms the next step." },
  ]} />;
}

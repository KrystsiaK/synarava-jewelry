import type { Metadata } from "next";
import { ServicePage } from "@/components/service/service-page";

export const metadata: Metadata = { title: "FAQ", description: "Answers to common questions about the Synarava shop." };

export default function FaqPage() {
  return <ServicePage eyebrow="Service / FAQ" title="Before you choose" intro="Short answers to the practical questions that tend to come up before and after an order." sections={[
    { title: "Is everything made by Synarava?", body: "No. Synarava is a curated shop across several departments. Product pages identify the maker or vendor and describe the materials and origin when that information is available." },
    { title: "How do I know an option is available?", body: "Choose the required size, colour, or other option on the product page. Only combinations currently connected to Shopify and in stock can be added to the cart." },
    { title: "Where do I pay?", body: "The final payment step is handled by the secure checkout connected to the shop. Review the store name, items, total, and delivery address before completing payment." },
    { title: "Can I ask about a product first?", body: "Yes. Email studio@synarava.com with the product name or link. For fit, materials, compatibility, or safety questions, ask before ordering." },
  ]} />;
}

import type { Metadata } from "next";
import { ServicePage } from "@/components/service/service-page";

export const metadata: Metadata = { title: "Shipping", description: "Shipping information for Synarava orders." };

export default function ShippingPage() {
  return <ServicePage eyebrow="Service / Shipping" title="From the studio to you" intro="Available delivery methods, costs, and the final estimate are shown at checkout for your destination." sections={[
    { title: "Delivery options", body: "Enter your delivery address at checkout to see the methods currently available for your order. The final price is confirmed before payment." },
    { title: "Preparing your order", body: "Ready-to-ship and made-to-order products may require different preparation times. Check the product page and order confirmation for the status of each item." },
    { title: "Tracking", body: "When tracking is available, the carrier link is sent to the email used at checkout after the parcel has been handed over." },
    { title: "Duties and taxes", body: "International orders may be subject to local duties or import taxes. Any amount not collected at checkout is determined by the destination country." },
  ]} />;
}

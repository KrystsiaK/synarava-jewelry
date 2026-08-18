import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Register | Synarava",
  description: "Join the Synarava storefront and create a new account.",
};

export default function RegisterPage() {
  redirect("/login");
}

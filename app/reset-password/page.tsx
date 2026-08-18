import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Reset Password | Synarava",
  description: "Restore access to a Synarava account.",
};

export default function ResetPasswordPage() {
  redirect("/login");
}

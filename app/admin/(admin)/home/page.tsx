import { permanentRedirect } from "next/navigation";

export default function AdminHomePage() {
  permanentRedirect("/admin/pages/home");
}

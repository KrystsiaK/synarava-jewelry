import { permanentRedirect } from "next/navigation";

import { ADMIN_SHARED_PATH } from "@/components/admin/shared/admin-paths";

/**
 * Legacy `/admin/settings` → `/admin/shared` (308).
 * Fragment (`#…`) is not sent to the server; browsers re-apply the original
 * hash when Location has none (WHATWG URL / redirect handling).
 */
export default function LegacyAdminSettingsRedirectPage() {
  permanentRedirect(ADMIN_SHARED_PATH);
}

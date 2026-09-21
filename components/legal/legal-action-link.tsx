"use client";

import { OPEN_PRIVACY_PREFERENCES_EVENT } from "@/lib/privacy/consent";
import type { LegalActionId } from "@/lib/content/legal-actions";

// One handler per allowlisted id — the same OPEN_PRIVACY_PREFERENCES_EVENT
// already used by PrivacySettingsButton (footer "Cookie settings"), so this
// opens the one existing Cookie Preferences modal, never a second one.
const LEGAL_ACTION_HANDLERS: Record<LegalActionId, () => void> = {
  "cookie-settings": () => window.dispatchEvent(new Event(OPEN_PRIVACY_PREFERENCES_EVENT)),
};

export function LegalActionLink({ actionId, children }: { actionId: LegalActionId; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      data-legal-action={actionId}
      className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-couture-red"
      onClick={() => LEGAL_ACTION_HANDLERS[actionId]()}
    >
      {children}
    </button>
  );
}

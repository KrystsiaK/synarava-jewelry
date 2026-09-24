/**
 * Sticky-aware scroll for admin field anchors (`#field-...`) and validation.
 *
 * Prefer `block: "start"` — `center` overshoots tall media blocks (hero preview)
 * and fights sticky topbar / locale / section chrome. CSS scroll-margin on
 * `[id^="field-"]` leaves room under that chrome.
 *
 * @see docs/admin/synarava-cms.md (scroll / sticky)
 */
export function scrollAdminFieldIntoView(fieldPathOrEl: string | HTMLElement) {
  const target =
    typeof fieldPathOrEl === "string"
      ? document.getElementById(fieldPathOrEl)
      : fieldPathOrEl;
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });

  const focusable = target.matches("input, select, textarea, button, [tabindex]")
    ? target
    : target.querySelector<HTMLElement>("input, select, textarea, button, [tabindex]");
  focusable?.focus({ preventScroll: true });
}

/**
 * Confirm modals set `inert` on the page shell (AnimatedModal).
 * Calling `requestSubmit()` while the form is inert makes Chrome report
 * "An invalid form control … is not focusable" for empty required fields.
 * Close the modal first, then submit after inert is cleared.
 */
export function submitFormAfterConfirmClose(
  form: HTMLFormElement | null | undefined,
  closeConfirm: () => void,
): void {
  closeConfirm();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      form?.requestSubmit();
    });
  });
}

/** Open confirm only if HTML constraint validation passes while the form is still focusable. */
export function openConfirmIfFormValid(
  form: HTMLFormElement | null | undefined,
  openConfirm: () => void,
): void {
  if (form && !form.checkValidity()) {
    form.reportValidity();
    return;
  }
  openConfirm();
}

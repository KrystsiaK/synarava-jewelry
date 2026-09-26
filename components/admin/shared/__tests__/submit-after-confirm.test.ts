import { describe, expect, it, vi } from "vitest";

import {
  openConfirmIfFormValid,
  submitFormAfterConfirmClose,
} from "@/components/admin/shared/submit-after-confirm";

describe("submit-after-confirm", () => {
  it("opens confirm only when the form is valid", () => {
    const open = vi.fn();
    const form = {
      checkValidity: () => false,
      reportValidity: vi.fn(),
    } as unknown as HTMLFormElement;
    openConfirmIfFormValid(form, open);
    expect(form.reportValidity).toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("opens confirm when valid", () => {
    const open = vi.fn();
    const form = {
      checkValidity: () => true,
      reportValidity: vi.fn(),
    } as unknown as HTMLFormElement;
    openConfirmIfFormValid(form, open);
    expect(open).toHaveBeenCalled();
  });

  it("closes confirm before requestSubmit", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame"] });
    const close = vi.fn();
    const requestSubmit = vi.fn();
    const form = { requestSubmit } as unknown as HTMLFormElement;
    submitFormAfterConfirmClose(form, close);
    expect(close).toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
    await vi.runAllTimersAsync();
    expect(requestSubmit).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

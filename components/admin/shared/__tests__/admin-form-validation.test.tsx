import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";

import { AdminFieldError, useAdminFormValidation } from "../admin-form-validation";

type TestFieldName = "first" | "second";

function TestForm({ label = "Test form" }: { label?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const validation = useAdminFormValidation<TestFieldName>({ formRef });

  return (
    <form ref={formRef} aria-label={label} noValidate>
      <label htmlFor={validation.fieldId("first")}>First field</label>
      <input
        name="first"
        required
        data-validation-message="Enter the first value."
        {...validation.fieldProps("first")}
      />
      <AdminFieldError id={validation.fieldErrorId("first")} message={validation.fieldErrors.first} />

      <label htmlFor={validation.fieldId("second")}>Second field</label>
      <input
        name="second"
        required
        data-validation-message="Enter the second value."
        {...validation.fieldProps("second")}
      />
      <AdminFieldError id={validation.fieldErrorId("second")} message={validation.fieldErrors.second} />

      <button type="button" onClick={() => validation.validate()}>Validate</button>
      <button
        type="button"
        onClick={() => validation.showFieldErrors({
          second: "Second server error.",
          first: "First server error.",
        })}
      >
        Show server errors
      </button>
    </form>
  );
}

describe("useAdminFormValidation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks, explains, scrolls to, and focuses the first invalid field", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "Validate" }));

    const first = screen.getByRole("textbox", { name: "First field" });
    expect(first).toHaveAttribute("aria-invalid", "true");
    expect(first).toHaveAccessibleErrorMessage("Enter the first value.");
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
      expect(first).toHaveFocus();
    });
  });

  it("clears a field error as the user corrects it", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "Validate" }));
    await user.type(screen.getByRole("textbox", { name: "First field" }), "Ring");

    expect(screen.queryByText("Enter the first value.")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "First field" })).not.toHaveAttribute("aria-invalid", "true");
  });

  it("focuses server errors in form order rather than object-key order", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "Show server errors" }));

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "First field" })).toHaveFocus();
    });
  });

  it("generates unique field and error ids for separate forms", async () => {
    const user = userEvent.setup();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<><TestForm label="First form" /><TestForm label="Second form" /></>);

    const forms = screen.getAllByRole("form");
    await user.click(forms[0]!.querySelector<HTMLButtonElement>("button")!);
    await user.click(forms[1]!.querySelector<HTMLButtonElement>("button")!);

    const firstInputs = screen.getAllByRole("textbox", { name: "First field" });
    expect(firstInputs[0]?.id).not.toBe(firstInputs[1]?.id);
    expect(firstInputs[0]?.getAttribute("aria-errormessage"))
      .not.toBe(firstInputs[1]?.getAttribute("aria-errormessage"));
  });

  it("cancels pending focus work when the form unmounts", async () => {
    const user = userEvent.setup();
    const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame");
    vi.spyOn(window, "requestAnimationFrame").mockReturnValue(42);
    const { unmount } = render(<TestForm />);

    await user.click(screen.getByRole("button", { name: "Validate" }));
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});

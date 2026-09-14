import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminLongTextField } from "@/components/admin/shared/admin-long-text-field";

describe("AdminLongTextField", () => {
  it("keeps long copy compact and commits modal edits to the form", async () => {
    const onInput = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <AdminLongTextField
          name="description"
          label="Description"
          defaultValue="A long product description that should be previewed instead of filling the page."
        />
      </form>,
    );
    container.querySelector("form")!.addEventListener("input", onInput);

    expect(container.querySelector(".adm-long-text-preview__copy")).toHaveTextContent(
      /A long product description/,
    );
    expect(screen.queryByRole("textbox", { name: "Description" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    const editor = screen.getByRole("textbox", { name: "Description" });
    await user.clear(editor);
    await user.type(editor, "A shorter, clearer description.");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(container.querySelector(".adm-long-text-preview__copy")).toHaveTextContent(
      "A shorter, clearer description.",
    );
    expect(new FormData(container.querySelector("form")!).get("description")).toBe(
      "A shorter, clearer description.",
    );
    expect(onInput).toHaveBeenCalledTimes(1);
  });

  it("discards modal edits when cancelled", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { container } = render(
      <form onChange={onChange}>
        <AdminLongTextField name="shortDescription" label="Short description" defaultValue="Original copy" />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Edit Short description" }));
    const editor = screen.getByRole("textbox", { name: "Short description" });
    await user.clear(editor);
    await user.type(editor, "Discard me");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(container.querySelector(".adm-long-text-preview__copy")).toHaveTextContent("Original copy");
    expect(screen.queryByText("Discard me")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("returns to its initial value when the parent form resets", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <AdminLongTextField name="description" label="Description" defaultValue="Initial copy" />
      </form>,
    );

    await user.click(screen.getByRole("button", { name: "Edit Description" }));
    await user.clear(screen.getByRole("textbox", { name: "Description" }));
    await user.type(screen.getByRole("textbox", { name: "Description" }), "Changed copy");
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    act(() => container.querySelector("form")!.reset());

    await waitFor(() => expect(container.querySelector(".adm-long-text-preview__copy")).toHaveTextContent("Initial copy"));
    expect(new FormData(container.querySelector("form")!).get("description")).toBe("Initial copy");
  });
});

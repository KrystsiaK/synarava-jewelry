import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchStorefrontHrefsAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/storefront-href", () => ({
  searchStorefrontHrefsAction: mocks.searchStorefrontHrefsAction,
}));

import { AdminRichTextField } from "@/components/synarava-cms";

beforeEach(() => {
  mocks.searchStorefrontHrefsAction.mockResolvedValue({ segments: [] });
});

describe("AdminRichTextField", () => {
  it("shows a clickable link in the preview chrome", () => {
    const { container } = render(
      <AdminRichTextField
        label="Body"
        name="body"
        defaultValue='<p>See <a href="https://www.centroarbitragemlisboa.pt">www.centroarbitragemlisboa.pt</a></p>'
      />,
    );

    const preview = container.querySelector("[data-slot='rich-text-preview']");
    expect(preview).toHaveClass("adm-long-text-preview");
    const link = screen.getByRole("link", { name: "www.centroarbitragemlisboa.pt" });
    expect(link).toHaveAttribute("href", "https://www.centroarbitragemlisboa.pt");
    expect(container.querySelector("[data-component='AdminRichTextField']")).toHaveClass("w-full");
  });

  it("opens the modal editor with a path/URL link panel", async () => {
    const user = userEvent.setup();
    render(
      <AdminRichTextField
        label="Body"
        name="body"
        defaultValue="<p>Plain body copy.</p>"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Body" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Link" }));
    expect(screen.getByRole("dialog", { name: "Insert link" })).toBeInTheDocument();
    expect(screen.getByLabelText("Link target")).toBeInTheDocument();
    expect(screen.getByText("Pick a storefront path or paste an https:// URL.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply link" })).toBeInTheDocument();
  });

  it("shows error chrome on the full-width preview", () => {
    const { container } = render(
      <AdminRichTextField label="Body" name="body" error="Add body." defaultValue="" />,
    );

    const preview = container.querySelector("[data-slot='rich-text-preview']");
    expect(preview).toHaveClass("adm-long-text-preview--error");
    expect(screen.getByText("Add body.")).toBeInTheDocument();
  });

  it("commits modal edits through onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <AdminRichTextField label="Body" value="<p>Original</p>" onChange={onChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Edit Body" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    // TipTap surface is contenteditable; apply current draft (still Original) to ensure wire-up.
    await user.click(screen.getByRole("button", { name: "Apply changes" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toContain("Original");
  });
});

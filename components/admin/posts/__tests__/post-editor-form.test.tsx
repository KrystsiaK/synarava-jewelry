import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/app/admin/actions/posts", () => ({
  savePostAction: vi.fn(),
  autosavePostDraftAction: vi.fn().mockResolvedValue({}),
}));

import { PostEditorForm } from "@/components/admin/posts/post-editor-form";

describe("PostEditorForm", () => {
  it("keeps distinct English and Portuguese authoring panels", async () => {
    const user = userEvent.setup();
    render(<PostEditorForm />);

    expect(screen.getByRole("tab", { name: "English" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Title (EN) *")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Português" }));

    expect(screen.getByRole("tab", { name: "Português" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Title (PT) *")).toBeInTheDocument();
    expect(screen.getByLabelText("Portuguese copy reviewed")).toBeInTheDocument();
  });
});

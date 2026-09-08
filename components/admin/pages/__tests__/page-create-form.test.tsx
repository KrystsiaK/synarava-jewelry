import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  autosavePageDraftAction: vi.fn(),
  savePageAction: vi.fn(),
}));

vi.mock("@/app/admin/actions/pages", () => ({
  autosavePageDraftAction: mocks.autosavePageDraftAction,
  savePageAction: mocks.savePageAction,
}));

import { CreatePageForm } from "@/components/admin/pages/page-create-form";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.autosavePageDraftAction.mockResolvedValue({});
});

describe("CreatePageForm", () => {
  it("renders the EN and PT locale fields", () => {
    render(<CreatePageForm onCreated={vi.fn()} />);

    expect(screen.getByRole("heading", { name: "Untitled page" })).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Slug")).toBeInTheDocument();
    expect(screen.getByLabelText("Title (PT)")).toBeInTheDocument();
  });

  it("saves through savePageAction and reports the created page", async () => {
    const createdPage = { id: "page-1", slug: "journal", title: "Journal" };
    mocks.savePageAction.mockResolvedValue({ success: "Page created.", page: createdPage });
    const onCreated = vi.fn();
    const user = userEvent.setup();
    render(<CreatePageForm onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Title"), "Journal");
    await user.type(screen.getByLabelText("Slug"), "journal");
    await user.click(screen.getByRole("button", { name: "Create page" }));

    expect(mocks.savePageAction).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(createdPage);
  });
});

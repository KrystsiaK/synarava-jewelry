import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminLocaleWorkspace } from "@/components/admin/shared/admin-locale-workspace";

function setup(props: Partial<React.ComponentProps<typeof AdminLocaleWorkspace>> = {}) {
  return render(
    <AdminLocaleWorkspace
      storageKey="test"
      en={<input aria-label="Title (EN)" defaultValue="Ring" />}
      pt={<input aria-label="Title (PT)" defaultValue="Anel" />}
      {...props}
    />,
  );
}

beforeEach(() => {
  sessionStorage.clear();
});

describe("AdminLocaleWorkspace", () => {
  it("shows the EN panel by default and hides PT", () => {
    setup();
    expect(screen.getByLabelText("Title (EN)")).toBeVisible();
    expect(screen.getByLabelText("Title (PT)").closest('[role="tabpanel"]')).toHaveAttribute("hidden");
  });

  it("switches panels on tab click without unmounting the hidden one", async () => {
    const user = userEvent.setup();
    setup();
    const ptInput = screen.getByLabelText<HTMLInputElement>("Title (PT)");
    await user.clear(ptInput);
    await user.type(ptInput, "Anel Novo");

    await user.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByLabelText("Title (EN)").closest('[role="tabpanel"]')).not.toHaveAttribute("hidden");

    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(screen.getByLabelText<HTMLInputElement>("Title (PT)").value).toBe("Anel Novo");
  });

  it("supports ArrowRight/ArrowLeft/Home/End keyboard navigation between tabs", async () => {
    const user = userEvent.setup();
    setup();
    const enTab = screen.getByRole("tab", { name: "English" });
    const ptTab = screen.getByRole("tab", { name: "Português" });

    enTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(ptTab).toHaveFocus();
    expect(ptTab).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowLeft}");
    expect(enTab).toHaveFocus();
    expect(enTab).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(ptTab).toHaveFocus();

    await user.keyboard("{Home}");
    expect(enTab).toHaveFocus();
  });

  it("switches locally without submitting the surrounding form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<form onSubmit={onSubmit}><AdminLocaleWorkspace storageKey="network-free" en={<input />} pt={<input />} /></form>);
    await user.click(screen.getByRole("tab", { name: "Português" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("remembers the active locale in sessionStorage per storageKey", async () => {
    const user = userEvent.setup();
    const { unmount } = setup({ storageKey: "product:abc" });
    await user.click(screen.getByRole("tab", { name: "Português" }));
    unmount();

    setup({ storageKey: "product:abc" });
    expect(screen.getByLabelText("Title (PT)").closest('[role="tabpanel"]')).not.toHaveAttribute("hidden");
  });

  it("does not leak the remembered locale across a different storageKey", async () => {
    const user = userEvent.setup();
    const { unmount } = setup({ storageKey: "product:abc" });
    await user.click(screen.getByRole("tab", { name: "Português" }));
    unmount();

    setup({ storageKey: "collection:xyz" });
    expect(screen.getByLabelText("Title (EN)").closest('[role="tabpanel"]')).not.toHaveAttribute("hidden");
  });

  it("shows a Shopify sync status badge for PT when provided", () => {
    setup({ ptStatus: "CONFLICT" });
    expect(screen.getByText(/SHOPIFY: CONFLICT/)).toBeInTheDocument();
  });

  it("forces open the locale of the first validation error", () => {
    setup({ forceLocale: "PT" });
    expect(screen.getByLabelText("Title (PT)").closest('[role="tabpanel"]')).not.toHaveAttribute("hidden");
  });
});

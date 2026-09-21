import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AdminLocaleTabs, AdminLocaleWorkspace } from "@/components/admin/shared/admin-locale-workspace";

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

describe("AdminLocaleTabs with a custom locale list", () => {
  it("renders a tab per entry, not just EN/PT, and keeps keyboard nav in range", async () => {
    const user = userEvent.setup();
    const locales = [
      { code: "en", label: "English" },
      { code: "pt", label: "Português" },
      { code: "ru", label: "Русский" },
    ];
    const onSelect = vi.fn();
    render(<AdminLocaleTabs active="en" onSelect={onSelect} locales={locales} />);

    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "Русский" })).toBeInTheDocument();

    const enTab = screen.getByRole("tab", { name: "English" });
    enTab.focus();
    await user.keyboard("{End}");
    expect(onSelect).toHaveBeenLastCalledWith("ru");
  });

  it("labels the source locale from locales[0], not a hardcoded EN", () => {
    const locales = [
      { code: "pt", label: "Português" },
      { code: "en", label: "English" },
    ];
    render(<AdminLocaleTabs active="pt" onSelect={() => {}} locales={locales} />);
    expect(screen.getByText("// pt — SOURCE")).toBeInTheDocument();
  });
});

describe("AdminLocaleTabs syncScope", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ run: { status: "SUCCEEDED" }, differenceCount: 0 }),
    }));
  });

  it("shows the entity sync control only when a syncScope is given", async () => {
    const { rerender } = render(<AdminLocaleTabs active="EN" onSelect={() => {}} />);
    expect(screen.queryByRole("button", { name: /Check .* against Shopify/ })).not.toBeInTheDocument();

    rerender(<AdminLocaleTabs active="EN" onSelect={() => {}} syncScope={{ entityType: "PRODUCT", entityId: "p1" }} />);
    expect(await screen.findByRole("button", { name: "Check English against Shopify" })).toBeInTheDocument();
  });
});

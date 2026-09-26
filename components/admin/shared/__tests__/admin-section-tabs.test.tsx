import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, PackageSearch, Shapes } from "lucide-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { AdminSectionTabs, type AdminSectionTabItem } from "@/components/admin/shared/admin-section-tabs";

const ITEMS: AdminSectionTabItem[] = [
  { id: "a", label: "Essentials", detail: "Core", icon: PackageSearch, group: "shopify" },
  { id: "b", label: "Catalog", detail: "Filters", icon: Shapes, tone: "issue", group: "shopify" },
  { id: "c", label: "Content", detail: "Copy", icon: FileText, tone: "conflict", dirty: true, group: "synarava" },
];

const GROUPS = [
  { id: "shopify", label: "Shopify" },
  { id: "synarava", label: "Synarava" },
] as const;

function Harness() {
  const [active, setActive] = useState("a");
  return (
    <AdminSectionTabs items={ITEMS} groups={[...GROUPS]} active={active} onChange={setActive}>
      <div>Well body for {active}</div>
    </AdminSectionTabs>
  );
}

describe("AdminSectionTabs", () => {
  it("exposes issue and conflict tones with selected state", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("group", { name: "Shopify" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Synarava" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Essentials/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Catalog/ })).toHaveAttribute("data-tone", "issue");
    expect(screen.getByRole("tab", { name: /Catalog/ })).toHaveAttribute("data-issue", "true");

    await user.click(screen.getByRole("tab", { name: /Content/ }));
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("data-tone", "conflict");
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("data-dirty", "true");
    expect(screen.getByText("Well body for c")).toBeInTheDocument();
  });

  it("keeps keyboard navigation across group boundaries", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: /Essentials/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Catalog/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /Essentials/ })).toHaveAttribute("aria-selected", "true");
  });
});

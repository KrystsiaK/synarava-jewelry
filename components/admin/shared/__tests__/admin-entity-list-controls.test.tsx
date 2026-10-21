import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminIconButton } from "@/components/admin/shared/admin-icon-button";
import { AdminSortChips } from "@/components/admin/shared/admin-sort-chips";
import { AdminSignalChip } from "@/components/admin/shared/admin-signal-chip";
import { AlertTriangle } from "lucide-react";

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children, content }: { children: React.ReactElement; content: React.ReactNode }) => (
    <span data-testid="tooltip" data-content={typeof content === "string" ? content : "node"}>
      {children}
    </span>
  ),
}));

describe("AdminIconButton", () => {
  it("exposes an accessible name for e2e and screen readers", () => {
    render(
      <AdminIconButton label="Details" tooltip="Record details">
        <span>i</span>
      </AdminIconButton>,
    );
    const button = screen.getByRole("button", { name: "Details" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("adm-icon-btn");
  });
});

describe("AdminSortChips", () => {
  it("marks the active sort and calls onChange", () => {
    const onChange = vi.fn();
    render(
      <AdminSortChips
        value="conflicts"
        onChange={onChange}
        options={[
          { value: "conflicts", label: "Most conflicts", shortLabel: "Conflicts", tone: "conflict" },
          { value: "published", label: "Latest published", shortLabel: "Published" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Conflicts" })).toHaveAttribute("aria-pressed", "true");
    screen.getByRole("button", { name: "Published" }).click();
    expect(onChange).toHaveBeenCalledWith("published");
  });
});

describe("AdminSignalChip", () => {
  it("renders a labeled signal with tooltip wrapper", () => {
    render(
      <AdminSignalChip
        label="2 open conflicts"
        tooltip="2 open conflicts. Open the editor to review them."
        tone="conflict"
        icon={<AlertTriangle />}
        value={2}
      />,
    );
    expect(screen.getByLabelText("2 open conflicts")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toHaveAttribute(
      "data-content",
      "2 open conflicts. Open the editor to review them.",
    );
  });
});

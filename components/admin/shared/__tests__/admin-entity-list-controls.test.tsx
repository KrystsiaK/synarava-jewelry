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
        value="problems"
        onChange={onChange}
        options={[
          { value: "problems", label: "Most problems", shortLabel: "Problems", tone: "danger" },
          { value: "published", label: "Latest published", shortLabel: "Published" },
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Problems" })).toHaveAttribute("aria-pressed", "true");
    screen.getByRole("button", { name: "Published" }).click();
    expect(onChange).toHaveBeenCalledWith("published");
  });
});

describe("AdminSignalChip", () => {
  it("renders a labeled signal with tooltip wrapper", () => {
    render(
      <AdminSignalChip
        label="2 open problems"
        tooltip="2 open problems. Open the editor to fix them."
        tone="danger"
        icon={<AlertTriangle />}
        value={2}
      />,
    );
    expect(screen.getByLabelText("2 open problems")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toHaveAttribute(
      "data-content",
      "2 open problems. Open the editor to fix them.",
    );
  });
});

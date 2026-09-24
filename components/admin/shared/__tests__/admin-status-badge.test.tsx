import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminStatusBadge, workflowStatusTone } from "@/components/synarava-cms";

describe("AdminStatusBadge", () => {
  it("maps workflow statuses to distinct tones", () => {
    expect(workflowStatusTone("PUBLISHED")).toBe("published");
    expect(workflowStatusTone("DRAFT")).toBe("draft");
    expect(workflowStatusTone("ARCHIVED")).toBe("archived");
    expect(workflowStatusTone("UNLISTED")).toBe("unlisted");
  });

  it("renders a published pill from status", () => {
    render(<AdminStatusBadge status="PUBLISHED" />);
    const badge = screen.getByText("PUBLISHED");
    expect(badge).toHaveAttribute("data-tone", "published");
    expect(badge).toHaveAttribute("data-role", "workflow-status");
    expect(badge.className).toContain("adm-badge--published");
  });
});

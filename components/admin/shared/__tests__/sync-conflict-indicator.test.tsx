import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SyncConflictIndicator } from "@/components/admin/shared/sync-conflict-indicator";

describe("SyncConflictIndicator", () => {
  it("formats N conflict(s) for <label>", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    render(
      <SyncConflictIndicator label="Portuguese" count={2} onOpen={onOpen} />,
    );
    expect(screen.getByRole("button", { name: "2 conflicts for Portuguese" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2 conflicts for Portuguese" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("shows clean state when count is zero", () => {
    render(<SyncConflictIndicator label="English" count={0} onOpen={vi.fn()} checkIconOnly />);
    expect(screen.getByRole("status", { name: "No conflicts for English" })).toBeInTheDocument();
  });

  it("icon mode exposes singular conflict aria-label", () => {
    render(<SyncConflictIndicator label="this product" count={1} onOpen={vi.fn()} checkIconOnly />);
    expect(screen.getByRole("button", { name: "1 conflict for this product" })).toBeInTheDocument();
  });
});

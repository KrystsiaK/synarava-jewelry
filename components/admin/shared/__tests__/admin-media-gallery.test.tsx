import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminMediaGallery } from "@/components/admin/shared/admin-media-gallery";

describe("AdminMediaGallery a11y", () => {
  it("names move/remove controls and supports keyboard focus on Add images", async () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    const onAlt = vi.fn();
    const user = userEvent.setup();

    render(
      <AdminMediaGallery
        items={[
          { id: "a", url: "/media/a.jpg", alt: "Front" },
          { id: "b", url: "/media/b.jpg", alt: "Side", pendingUpload: true },
        ]}
        onAdd={vi.fn()}
        onMove={onMove}
        onRemove={onRemove}
        onSetCover={vi.fn()}
        onAlt={onAlt}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Move left" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Move right" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(2);
    expect(screen.getByText("Will upload")).toBeInTheDocument();

    const add = screen.getByLabelText(/Add images/i);
    add.focus();
    expect(add).toHaveFocus();

    await user.click(screen.getAllByRole("button", { name: "Move right" })[0]);
    expect(onMove).toHaveBeenCalledWith("a", 1);
  });
});

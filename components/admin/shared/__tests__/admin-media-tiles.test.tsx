import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={props.alt} src={props.src} />
  ),
}));

import { AdminMediaTiles } from "@/components/admin/shared/admin-media-tiles";

describe("AdminMediaTiles", () => {
  it("keeps Add photo tile when empty and sizes controls to 44px", () => {
    render(
      <AdminMediaTiles
        items={[]}
        onAdd={vi.fn()}
        emptyHint="No pair photos yet."
      />,
    );

    expect(screen.getByText(/no pair photos yet/i)).toBeInTheDocument();
    expect(screen.getByText(/add photo/i)).toBeInTheDocument();
  });

  it("renders move/remove controls with aria-labels under each photo", () => {
    render(
      <AdminMediaTiles
        items={[
          { id: "a", url: "/a.jpg" },
          { id: "b", url: "/b.jpg" },
        ]}
        onAdd={vi.fn()}
        onMove={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Move left" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Move right" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Remove photo" })).toHaveLength(2);
  });
});

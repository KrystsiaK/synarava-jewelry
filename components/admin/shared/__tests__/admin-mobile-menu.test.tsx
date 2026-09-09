import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/products",
}));

import { AdminMobileMenu } from "@/components/admin/shared/admin-primitives";

describe("AdminMobileMenu", () => {
  beforeEach(() => {
    document.body.style.overflow = "scroll";
  });

  afterEach(() => {
    document.body.style.overflow = "";
  });

  it("portals the drawer outside the topbar and locks only the page scroll", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div className="admin-terminal">
        <div className="adm-topbar">
          <AdminMobileMenu />
        </div>
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "Open admin menu" }));

    const drawer = screen.getByRole("dialog", { name: "Admin navigation" });
    expect(drawer.parentElement?.parentElement).toBe(container.querySelector(".admin-terminal"));
    expect(document.body.style.overflow).toBe("hidden");

    const closeButtons = screen.getAllByRole("button", { name: "Close admin menu" });
    await user.click(closeButtons.at(-1)!);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Admin navigation" })).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("scroll");
    });
  });
});

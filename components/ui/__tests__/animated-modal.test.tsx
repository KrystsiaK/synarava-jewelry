import { render, screen } from "@testing-library/react";

import { AnimatedModal } from "@/components/ui/animated-modal";

describe("AnimatedModal", () => {
  it("moves the dialog to a portal, makes background content inert, and restores it", () => {
    const { unmount } = render(
      <main data-testid="background">
        <button type="button">Background action</button>
        <AnimatedModal open onClose={() => undefined} ariaLabel="Example dialog">
          <button type="button">Dialog action</button>
        </AnimatedModal>
      </main>,
    );

    expect(screen.getByRole("dialog", { name: "Example dialog" })).toBeInTheDocument();
    expect(screen.getByTestId("background").parentElement).toHaveProperty("inert", true);
    expect(screen.getByRole("dialog", { name: "Example dialog" }).closest("[data-animated-modal-root]"))
      .toBe(document.body.querySelector("[data-animated-modal-root]"));

    unmount();
    expect(document.body.querySelector("[data-animated-modal-root]")).not.toBeInTheDocument();
  });
});

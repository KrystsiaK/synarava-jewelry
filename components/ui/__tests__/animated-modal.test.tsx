import { fireEvent, render, screen } from "@testing-library/react";

import { AnimatedModal } from "@/components/ui/animated-modal";

describe("AnimatedModal", () => {
  it("moves the dialog to a portal, makes background content inert, and restores it", () => {
    const { unmount } = render(
      <main data-testid="background">
        <button type="button">Background action</button>
        <AnimatedModal open onClose={() => undefined} ariaLabel="Example dialog" portalClassName="admin-modal-root">
          <button type="button">Dialog action</button>
        </AnimatedModal>
      </main>,
    );

    expect(screen.getByRole("dialog", { name: "Example dialog" })).toBeInTheDocument();
    expect(screen.getByTestId("background").parentElement).toHaveProperty("inert", true);
    expect(screen.getByRole("dialog", { name: "Example dialog" }).closest("[data-animated-modal-root]"))
      .toBe(document.body.querySelector("[data-animated-modal-root]"));
    expect(document.body.querySelector("[data-animated-modal-root]")).toHaveClass("fixed", "inset-0", "isolate", "admin-modal-root");

    unmount();
    expect(document.body.querySelector("[data-animated-modal-root]")).not.toBeInTheDocument();
  });

  it("lets only the topmost nested dialog handle Escape", () => {
    const closeParent = vi.fn();
    const closeChild = vi.fn();
    render(
      <AnimatedModal open onClose={closeParent} ariaLabel="Parent dialog">
        <AnimatedModal open onClose={closeChild} ariaLabel="Child dialog">
          <button type="button">Child action</button>
        </AnimatedModal>
      </AnimatedModal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeChild).toHaveBeenCalledOnce();
    expect(closeParent).not.toHaveBeenCalled();
  });

  it("does not make a stacked sibling modal portal inert", () => {
    const onChildAction = vi.fn();
    render(
      <>
        <AnimatedModal open onClose={() => undefined} ariaLabel="Parent dialog">
          <button type="button">Parent action</button>
        </AnimatedModal>
        <AnimatedModal open onClose={() => undefined} ariaLabel="Child dialog">
          <button type="button" onClick={onChildAction}>Child action</button>
        </AnimatedModal>
      </>,
    );

    const roots = document.body.querySelectorAll<HTMLElement>("[data-animated-modal-root]");
    expect(roots).toHaveLength(2);
    // jsdom may leave `.inert` undefined until set; treat falsy as not inert.
    roots.forEach((root) => expect(Boolean(root.inert)).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Child action" }));
    expect(onChildAction).toHaveBeenCalledOnce();
  });

  it("keeps the top sibling interactive when the lower modal gets a new onClose identity", () => {
    const onChildAction = vi.fn();
    const closeChild = vi.fn();
    const { rerender } = render(
      <>
        <main data-testid="app-shell">
          <button type="button">Shell</button>
        </main>
        <AnimatedModal open onClose={() => undefined} ariaLabel="Parent dialog">
          <button type="button">Parent action</button>
        </AnimatedModal>
        <AnimatedModal open onClose={closeChild} ariaLabel="Child dialog">
          <button type="button" onClick={onChildAction}>Child action</button>
        </AnimatedModal>
      </>,
    );

    // Mimic ConflictListModal: busy ? () => undefined : onClose creates a new
    // function each render. Trap deps must not re-inert the top sibling.
    rerender(
      <>
        <main data-testid="app-shell">
          <button type="button">Shell</button>
        </main>
        <AnimatedModal open onClose={() => undefined} ariaLabel="Parent dialog">
          <button type="button">Parent action</button>
        </AnimatedModal>
        <AnimatedModal open onClose={closeChild} ariaLabel="Child dialog">
          <button type="button" onClick={onChildAction}>Child action</button>
        </AnimatedModal>
      </>,
    );

    const roots = document.body.querySelectorAll<HTMLElement>("[data-animated-modal-root]");
    expect(roots).toHaveLength(2);
    roots.forEach((root) => expect(Boolean(root.inert)).toBe(false));
    // inert is applied to direct body children (RTL container), not nested main.
    expect(screen.getByTestId("app-shell").parentElement).toHaveProperty("inert", true);

    fireEvent.click(screen.getByRole("button", { name: "Child action" }));
    expect(onChildAction).toHaveBeenCalledOnce();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(closeChild).toHaveBeenCalledOnce();
  });
});

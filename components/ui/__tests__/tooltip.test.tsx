import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EphemeralToastProvider, useEphemeralToast } from "@/components/ui/ephemeral-toast";
import { resetTooltipWarmth, Tooltip } from "@/components/ui/tooltip";

describe("Tooltip", () => {
  it("waits out the rest delay, then opens the next tag immediately", () => {
    vi.useFakeTimers();
    resetTooltipWarmth();
    render(
      <>
        <Tooltip content="First hint" delay={500}>
          <button type="button">One</button>
        </Tooltip>
        <Tooltip content="Second hint" delay={500}>
          <button type="button">Two</button>
        </Tooltip>
      </>,
    );

    fireEvent.pointerEnter(screen.getByRole("button", { name: "One" }), { pointerType: "mouse" });
    act(() => { vi.advanceTimersByTime(200); });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.getByRole("tooltip")).toHaveTextContent("First hint");

    fireEvent.pointerLeave(screen.getByRole("button", { name: "One" }), { pointerType: "mouse" });
    fireEvent.pointerEnter(screen.getByRole("button", { name: "Two" }), { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Second hint");

    vi.useRealTimers();
    resetTooltipWarmth();
  });

  it("shows a touch hold without activating the button", () => {
    resetTooltipWarmth();
    const onClick = vi.fn();
    render(
      <Tooltip content="Hold hint" delay={0}>
        <button type="button" onClick={onClick}>Hold</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Hold" });
    const touch = (type: string) => {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, "pointerType", { value: "touch" });
      trigger.dispatchEvent(event);
    };

    act(() => { touch("pointerdown"); });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hold hint");
    act(() => { touch("pointerup"); });
    fireEvent.click(trigger);
    expect(onClick).not.toHaveBeenCalled();
    resetTooltipWarmth();
  });

  it("still runs a short tap", () => {
    const onClick = vi.fn();
    render(
      <Tooltip content="Hint" delay={400}>
        <button type="button" onClick={onClick}>Tap</button>
      </Tooltip>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tap" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("describes the trigger and opens on keyboard focus", () => {
    render(
      <Tooltip content="Explains this action" delay={0}>
        <button type="button">Action</button>
      </Tooltip>,
    );

    const trigger = screen.getByRole("button", { name: "Action" });
    fireEvent.focus(trigger);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Explains this action");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("closes with Escape while leaving focus on the trigger", () => {
    render(
      <Tooltip content="Explains this action" delay={0}>
        <button type="button">Action</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole("button", { name: "Action" });
    act(() => trigger.focus());
    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("preserves an existing description relationship", () => {
    render(
      <>
        <span id="existing-description">Existing description</span>
        <Tooltip content="Additional detail" delay={0}>
          <button type="button" aria-describedby="existing-description">Action</button>
        </Tooltip>
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Action" });
    fireEvent.focus(trigger);
    const tooltip = screen.getByRole("tooltip");

    expect(trigger).toHaveAttribute("aria-describedby", `existing-description ${tooltip.id}`);
  });

  it("promotes the tooltip into the browser top layer when supported", () => {
    const originalShowPopover = HTMLElement.prototype.showPopover;
    const showPopover = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "showPopover", {
      configurable: true,
      value: showPopover,
    });

    render(
      <Tooltip content="Always above the page" delay={0}>
        <button type="button">Action</button>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "Action" }));

    expect(screen.getByRole("tooltip")).toHaveAttribute("popover", "manual");
    expect(showPopover).toHaveBeenCalledOnce();

    if (originalShowPopover) {
      Object.defineProperty(HTMLElement.prototype, "showPopover", {
        configurable: true,
        value: originalShowPopover,
      });
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
    }
  });

  it("portals an admin tooltip into its themed admin surface", () => {
    const { container } = render(
      <div className="admin-terminal">
        <Tooltip content="Admin guidance" delay={0}>
          <button type="button">Help</button>
        </Tooltip>
      </div>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "Help" }));

    const adminSurface = container.querySelector(".admin-terminal");
    expect(screen.getByRole("tooltip").parentElement).toBe(adminSurface);
  });

  it("closes and suppresses focus-open when an ephemeral toast fires", () => {
    resetTooltipWarmth();
    function SaveWithToast() {
      const { pushToast } = useEphemeralToast();
      return (
        <>
          <Tooltip content="Save page copy and publishing state." delay={0}>
            <button type="button">Save page</button>
          </Tooltip>
          <button
            type="button"
            onClick={() => pushToast({ message: "Page updated.", tone: "success" })}
          >
            Finish save
          </button>
        </>
      );
    }

    render(
      <EphemeralToastProvider surface="admin">
        <SaveWithToast />
      </EphemeralToastProvider>,
    );

    const save = screen.getByRole("button", { name: "Save page" });
    fireEvent.focus(save);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Save page copy and publishing state.");

    fireEvent.click(screen.getByRole("button", { name: "Finish save" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Page updated.");

    // Confirm-modal style focus return must not reopen the instructional tip.
    fireEvent.focus(save);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    resetTooltipWarmth();
  });
});

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tooltip } from "@/components/ui/tooltip";

describe("Tooltip", () => {
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
});

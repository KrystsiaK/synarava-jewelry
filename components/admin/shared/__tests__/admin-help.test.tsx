import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ADMIN_HELP_TOOLTIP_DELAY_MS,
  ADMIN_HELP_TOOLTIP_OFFSET_PX,
  AdminHelp,
} from "@/components/admin/shared/admin-help";
import { resetTooltipWarmth } from "@/components/ui/tooltip";

describe("AdminHelp", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetTooltipWarmth();
  });

  it("exposes one named help control with a fixed hit box beside the label", () => {
    const { container } = render(
      <span className="adm-label-row">
        <span className="adm-label adm-label__lead">
          <span className="adm-label__text">THRESHOLD (SYNARAVA)</span>
        </span>
        <AdminHelp label="Hero image guidance">Upload a landscape image for the page hero.</AdminHelp>
      </span>,
    );

    const trigger = screen.getByRole("button", { name: "Hero image guidance" });
    expect(trigger.querySelector(".adm-help__glyph")).toHaveTextContent("i");
    expect(trigger).toHaveClass("adm-help__trigger");
    // Help is a sibling of the lead, not nested in the kicker text.
    expect(container.querySelector(".adm-label-row > .adm-help")).toBeTruthy();
    expect(container.querySelector(".adm-label__text")?.textContent).toBe("THRESHOLD (SYNARAVA)");
    expect(ADMIN_HELP_TOOLTIP_DELAY_MS).toBeGreaterThanOrEqual(500);
    expect(ADMIN_HELP_TOOLTIP_DELAY_MS).toBeLessThanOrEqual(600);
    expect(ADMIN_HELP_TOOLTIP_OFFSET_PX).toBeGreaterThan(10);
  });

  it("does not open on hover before the admin-help delay, then opens after", () => {
    vi.useFakeTimers();
    resetTooltipWarmth();
    render(<AdminHelp label="Delay guidance">Hold to read.</AdminHelp>);
    const trigger = screen.getByRole("button", { name: "Delay guidance" });

    fireEvent.pointerEnter(trigger, { pointerType: "mouse" });
    act(() => {
      vi.advanceTimersByTime(ADMIN_HELP_TOOLTIP_DELAY_MS - 50);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hold to read.");
  });

  it("opens immediately on click and closes on a second click", () => {
    resetTooltipWarmth();
    render(<AdminHelp label="Click guidance">Click tip.</AdminHelp>);
    const trigger = screen.getByRole("button", { name: "Click guidance" });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Click tip.");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-describedby");

    fireEvent.click(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape while keeping focus on the trigger", () => {
    resetTooltipWarmth();
    render(<AdminHelp label="Escape guidance">Escape tip.</AdminHelp>);
    const trigger = screen.getByRole("button", { name: "Escape guidance" });

    fireEvent.click(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    act(() => {
      trigger.focus();
    });
    fireEvent.keyDown(trigger, { key: "Escape" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("uses the same delay on keyboard focus, then opens", () => {
    vi.useFakeTimers();
    resetTooltipWarmth();
    render(<AdminHelp label="Focus guidance">Focus tip.</AdminHelp>);
    const trigger = screen.getByRole("button", { name: "Focus guidance" });

    fireEvent.focus(trigger);
    act(() => {
      vi.advanceTimersByTime(ADMIN_HELP_TOOLTIP_DELAY_MS - 50);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("Focus tip.");
    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });
});

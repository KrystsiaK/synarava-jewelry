import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText, PackageSearch, Shapes } from "lucide-react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { AdminSectionTabs, type AdminSectionTabItem } from "@/components/admin/shared/admin-section-tabs";

const ITEMS: AdminSectionTabItem[] = [
  { id: "a", label: "Essentials", detail: "Core", icon: PackageSearch, group: "shopify" },
  { id: "b", label: "Catalog", detail: "Filters", icon: Shapes, tone: "issue", group: "shopify" },
  { id: "c", label: "Content", detail: "Copy", icon: FileText, tone: "conflict", dirty: true, group: "synarava" },
];

const GROUPS = [
  { id: "shopify", label: "Shopify" },
  { id: "synarava", label: "Synarava" },
] as const;

function Harness() {
  const [active, setActive] = useState("a");
  return (
    <AdminSectionTabs items={ITEMS} groups={[...GROUPS]} active={active} onChange={setActive}>
      <div>Well body for {active}</div>
    </AdminSectionTabs>
  );
}

describe("AdminSectionTabs", () => {
  it("exposes issue and conflict tones with selected state", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole("group", { name: "Shopify" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Synarava" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Essentials/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Catalog/ })).toHaveAttribute("data-tone", "issue");
    expect(screen.getByRole("tab", { name: /Catalog/ })).toHaveAttribute("data-issue", "true");

    await user.click(screen.getByRole("tab", { name: /Content/ }));
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("data-tone", "conflict");
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("data-dirty", "true");
    expect(screen.getByText("Well body for c")).toBeInTheDocument();
  });

  it("keeps keyboard navigation across group boundaries", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    screen.getByRole("tab", { name: /Essentials/ }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Catalog/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Home}");
    expect(screen.getByRole("tab", { name: /Essentials/ })).toHaveAttribute("aria-selected", "true");
  });

  it("pans on a horizontal touch and does not activate the tab under the finger", () => {
    render(<Harness />);
    const scroller = document.querySelector(".adm-section-tabs__scroller");
    expect(scroller).toBeInstanceOf(HTMLElement);
    if (!(scroller instanceof HTMLElement)) return;

    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 800 });
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 });

    scroller.dispatchEvent(touch("touchstart", 120, 20));
    const move = touch("touchmove", 40, 22);
    scroller.dispatchEvent(move);
    scroller.dispatchEvent(touch("touchend", 40, 22));

    expect(move.defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBeGreaterThan(0);

    const tab = scroller.querySelector("#adm-section-tab-c");
    expect(tab).toBeInstanceOf(HTMLElement);
    if (tab instanceof HTMLElement) fireEvent.click(tab);
    expect(screen.getByRole("tab", { name: /Essentials/ })).toHaveAttribute("aria-selected", "true");
  });

  it("leaves vertical touches to the page so a tap still changes tabs", () => {
    render(<Harness />);
    const scroller = document.querySelector(".adm-section-tabs__scroller");
    expect(scroller).toBeInstanceOf(HTMLElement);
    if (!(scroller instanceof HTMLElement)) return;

    Object.defineProperty(scroller, "scrollWidth", { configurable: true, value: 800 });
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 200 });

    scroller.dispatchEvent(touch("touchstart", 40, 10));
    const move = touch("touchmove", 42, 80);
    scroller.dispatchEvent(move);
    scroller.dispatchEvent(touch("touchend", 42, 80));

    expect(move.defaultPrevented).toBe(false);
    const tab = scroller.querySelector("#adm-section-tab-c");
    expect(tab).toBeInstanceOf(HTMLElement);
    if (tab instanceof HTMLElement) fireEvent.click(tab);
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute("aria-selected", "true");
  });
});

function touch(type: string, x: number, y: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const point = { clientX: x, clientY: y, identifier: 1 };
  Object.defineProperty(event, "touches", {
    value: type === "touchend" || type === "touchcancel" ? [] : [point],
  });
  return event;
}

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogConflictStatus, CatalogConflictRowBadges } from "@/components/admin/products/catalog-conflict-signals";
import type { CatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const signals: CatalogConflictSignals = {
  state: "ready", totalCount: 2, checkedAt: "2026-09-23T10:00:00.000Z",
  recentlyUpdatedProducts: {},
  products: {
    a: { shared: true, locales: [
      { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
      { code: "ru", name: "Russian", nativeName: "Русский", count: 1 },
      { code: "de", name: "German", nativeName: "Deutsch", count: 1 },
    ] },
    b: { shared: false, locales: [{ code: "en", name: "English", nativeName: "English", count: 1 }] },
  },
};

describe("catalog conflict signals", () => {
  it("offers two equivalent explicit entrances and textual status", () => {
    const open = vi.fn();
    render(<><CatalogConflictStatus signals={signals} onShow={open} onCheck={vi.fn()} /><CatalogConflictStatus signals={signals} onShow={open} onCheck={vi.fn()} compact /></>);
    expect(screen.getByText(/2 products with conflicts/)).toBeTruthy();
    expect(screen.getByText("2 conflicts")).toBeTruthy();
    const buttons = screen.getAllByRole("button", { name: "Show conflicts" });
    expect(buttons).toHaveLength(2);
    buttons.forEach((button) => fireEvent.click(button));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("compacts extra locales and opens the focused product", () => {
    const open = vi.fn();
    render(<CatalogConflictRowBadges productName="Amber ring" signal={signals.products.a!} onShow={open} />);
    expect(screen.getByText("PT · 2 fields")).toBeTruthy();
    expect(screen.getByText("RU · 1 field")).toBeTruthy();
    expect(screen.getByText("+1 language")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /conflicts for Amber ring/i }));
    expect(open).toHaveBeenCalledOnce();
  });

  it("shows all languages in the read-only list and distinguishes failed lookup from zero conflicts", () => {
    const check = vi.fn();
    const { rerender } = render(<CatalogConflictStatus signals={{ ...signals, state: "failed", totalCount: null, products: {} }} onShow={vi.fn()} onCheck={check} />);
    expect(screen.getByText(/status unavailable/i)).toBeTruthy();
    expect(screen.queryByText(/0 products/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /run conflict check/i }));
    expect(check).toHaveBeenCalledOnce();
    rerender(<CatalogConflictStatus signals={{ ...signals, state: "stale", totalCount: 0, products: {} }} onShow={vi.fn()} onCheck={check} />);
    expect(screen.getByText(/No saved conflicts/i)).toBeTruthy();
    expect(screen.getByText(/outdated/i)).toBeTruthy();
  });

  it.each([
    ["checking", /Checking Shopify/i],
    ["stale", /may be outdated/i],
    ["failed", /status unavailable/i],
    ["disconnected", /Shopify disconnected/i],
  ] as const)("makes the %s state readable without relying on color", (state, message) => {
    render(<CatalogConflictStatus signals={{ ...signals, state }} onShow={vi.fn()} onCheck={vi.fn()} />);
    expect(screen.getByText(message)).toBeTruthy();
  });

  it("updates both counters when the last persisted conflict disappears", () => {
    const { rerender } = render(<><CatalogConflictStatus signals={signals} onShow={vi.fn()} onCheck={vi.fn()} /><CatalogConflictStatus signals={signals} onShow={vi.fn()} onCheck={vi.fn()} compact /></>);
    expect(screen.getAllByRole("button", { name: "Show conflicts" })).toHaveLength(2);
    const cleared: CatalogConflictSignals = { ...signals, totalCount: 0, products: {} };
    rerender(<><CatalogConflictStatus signals={cleared} onShow={vi.fn()} onCheck={vi.fn()} /><CatalogConflictStatus signals={cleared} onShow={vi.fn()} onCheck={vi.fn()} compact /></>);
    expect(screen.getByText("No saved conflicts")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show conflicts" })).toBeNull();
  });
});

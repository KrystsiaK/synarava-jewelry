import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CatalogConflictStatus, CatalogConflictRowBadges } from "@/components/admin/shared/catalog-conflict-signals";
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
    render(<><CatalogConflictStatus signals={signals} onShow={open} /><CatalogConflictStatus signals={signals} onShow={open} compact /></>);
    expect(screen.getAllByText("2 conflicts")).toHaveLength(2);
    expect(screen.getByText(/Last full check/)).toBeTruthy();
    expect(screen.getByTitle("Last full conflict check")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /run conflict check/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show conflicts" }));
    fireEvent.click(screen.getByRole("button", { name: "2 conflicts" }));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it("ignores entityNoun — counters are always leaf conflicts", () => {
    render(
      <CatalogConflictStatus
        signals={signals}
        onShow={vi.fn()}
        entityNoun={{ singular: "collection", plural: "collections" }}
      />,
    );
    expect(screen.getByText("2 conflicts")).toBeTruthy();
    expect(screen.queryByText(/collections with conflicts/i)).toBeNull();
    expect(screen.getByText(/Last full check/)).toBeTruthy();
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

  it("shows No conflicts for zero, failed honestly, and unavailable for null", () => {
    const { rerender } = render(
      <CatalogConflictStatus
        signals={{ ...signals, state: "stale", totalCount: 0, products: {} }}
        onShow={vi.fn()}
      />,
    );
    expect(screen.getByText("No conflicts")).toBeTruthy();
    expect(screen.queryByText(/outdated/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /run conflict check/i })).toBeNull();

    rerender(
      <CatalogConflictStatus
        signals={{ ...signals, state: "failed", totalCount: null, products: {} }}
        onShow={vi.fn()}
      />,
    );
    expect(screen.getByText("Last check failed or partial")).toBeTruthy();
    expect(screen.queryByText("No conflicts")).toBeNull();

    rerender(
      <CatalogConflictStatus
        signals={{ ...signals, state: "ready", totalCount: null, products: {} }}
        onShow={vi.fn()}
      />,
    );
    expect(screen.getByText("Conflict status unavailable")).toBeTruthy();
  });

  it("updates both counters when the last persisted conflict disappears", () => {
    const { rerender } = render(<><CatalogConflictStatus signals={signals} onShow={vi.fn()} /><CatalogConflictStatus signals={signals} onShow={vi.fn()} compact /></>);
    expect(screen.getByRole("button", { name: "Show conflicts" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2 conflicts" })).toBeTruthy();
    const cleared: CatalogConflictSignals = { ...signals, totalCount: 0, products: {} };
    rerender(<><CatalogConflictStatus signals={cleared} onShow={vi.fn()} /><CatalogConflictStatus signals={cleared} onShow={vi.fn()} compact /></>);
    expect(screen.getByText("No conflicts")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show conflicts" })).toBeNull();
    expect(screen.queryByRole("button", { name: "2 conflicts" })).toBeNull();
  });
});

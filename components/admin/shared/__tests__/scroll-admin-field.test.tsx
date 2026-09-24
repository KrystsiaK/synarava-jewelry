import { afterEach, describe, expect, it, vi } from "vitest";

import { scrollAdminFieldIntoView } from "@/components/admin/shared/scroll-admin-field";

describe("scrollAdminFieldIntoView", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("scrolls the field to the start edge so sticky chrome does not overshoot tall media", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    document.body.innerHTML = `
      <div id="field-heroImageUrl">
        <input type="file" />
      </div>
    `;
    const input = document.querySelector("input");
    const focus = vi.spyOn(input!, "focus");

    scrollAdminFieldIntoView("field-heroImageUrl");

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("no-ops when the field id is missing", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    scrollAdminFieldIntoView("field-missing");

    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

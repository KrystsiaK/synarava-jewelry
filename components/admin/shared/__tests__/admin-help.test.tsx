import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminHelp } from "@/components/admin/shared/admin-help";

describe("AdminHelp", () => {
  it("uses one named help control and exposes its guidance on keyboard focus", () => {
    render(<AdminHelp label="Hero image guidance">Upload a landscape image for the page hero.</AdminHelp>);

    const trigger = screen.getByRole("button", { name: "Hero image guidance" });
    expect(trigger.querySelector("svg.lucide-circle-question-mark")).toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Upload a landscape image for the page hero.");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  MISSION_CONTROL_FIXTURE_NOTICE,
  MissionControlHub,
} from "@/components/admin/mission-control/mission-control-hub";

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: unknown }) => children,
  ReactFlow: () => null,
  Background: () => null,
}));

describe("MissionControlHub fixture notice", () => {
  it("renders a visible notice that statuses are demo fixtures", () => {
    render(<MissionControlHub />);

    const notice = screen.getByTestId("mc-fixture-notice");
    expect(notice).toBeInTheDocument();
    expect(notice).toHaveTextContent(MISSION_CONTROL_FIXTURE_NOTICE);
    expect(notice).toHaveAttribute("role", "status");
  });
});

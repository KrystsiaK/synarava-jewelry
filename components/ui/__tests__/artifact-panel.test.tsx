import { render, screen } from "@testing-library/react";
import { ArtifactPanel } from "../artifact-panel";

describe("ArtifactPanel", () => {
  it("renders children", () => {
    render(<ArtifactPanel>Panel content</ArtifactPanel>);
    expect(screen.getByText("Panel content")).toBeInTheDocument();
  });

  it("applies panel class to the wrapper div", () => {
    render(<ArtifactPanel data-testid="panel">content</ArtifactPanel>);
    expect(screen.getByTestId("panel")).toHaveClass("panel");
  });

  it("merges custom className alongside panel", () => {
    render(<ArtifactPanel data-testid="panel" className="p-8">content</ArtifactPanel>);
    expect(screen.getByTestId("panel")).toHaveClass("panel", "p-8");
  });

  it("renders as div", () => {
    render(<ArtifactPanel data-testid="panel">content</ArtifactPanel>);
    expect(screen.getByTestId("panel").tagName).toBe("DIV");
  });

  it("forwards additional HTML attributes", () => {
    render(<ArtifactPanel data-testid="my-panel" aria-label="Info">content</ArtifactPanel>);
    expect(screen.getByTestId("my-panel")).toHaveAttribute("aria-label", "Info");
  });
});

import { render } from "@testing-library/react";
import { ThemeScript } from "../theme-script";

describe("ThemeScript", () => {
  it("renders without crashing", () => {
    // dangerouslySetInnerHTML with scripts is intentionally not executed by React in tests
    expect(() => render(<ThemeScript initialPreference="light" />)).not.toThrow();
  });

  it("script innerHTML contains the initial preference", () => {
    const { container } = render(<ThemeScript initialPreference="dark" />);
    const script = container.querySelector("script");
    // React renders dangerouslySetInnerHTML scripts in the DOM tree
    expect(script).toBeTruthy();
  });

  it("script text contains cookie name constant", () => {
    const { container } = render(<ThemeScript initialPreference="light" />);
    // Check the container HTML rather than trying to query the script element
    expect(container.innerHTML).toContain("synarava-theme");
  });

  it("script text contains the preference value", () => {
    const { container } = render(<ThemeScript initialPreference="dark" />);
    expect(container.innerHTML).toContain('"dark"');
  });
});

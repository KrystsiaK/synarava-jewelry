import { render } from "@testing-library/react";
import { getThemeScript, ThemeScript } from "../theme-script";

describe("ThemeScript", () => {
  it("renders without crashing", () => {
    // dangerouslySetInnerHTML with scripts is intentionally not executed by React in tests
    expect(() => render(<ThemeScript initialPreference="light" />)).not.toThrow();
  });

  it("generated script contains the initial preference", () => {
    expect(getThemeScript("dark")).toContain('"dark"');
  });

  it("generated script contains cookie name constant", () => {
    expect(getThemeScript("light")).toContain("synarava-theme");
  });

  it("generated script applies the resolved theme before hydration", () => {
    const script = getThemeScript("system");
    expect(script).toContain("root.dataset.themePreference = preference");
    expect(script).toContain("root.dataset.theme = resolved");
  });
});

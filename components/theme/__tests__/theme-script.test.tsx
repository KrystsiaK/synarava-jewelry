import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { getThemeScript, ThemeScript } from "../theme-script";

const { callbacks } = vi.hoisted(() => ({
  callbacks: [] as Array<() => ReactNode>,
}));

vi.mock("next/navigation", () => ({
  useServerInsertedHTML: (callback: () => ReactNode) => {
    callbacks.push(callback);
  },
}));

function insertedScript() {
  const node = callbacks.at(-1)?.();
  if (!node || typeof node !== "object" || !("props" in node)) {
    throw new Error("ThemeScript did not register a head script");
  }
  return node;
}

describe("ThemeScript", () => {
  beforeEach(() => {
    callbacks.length = 0;
  });

  it("registers a blocking head script instead of rendering one", () => {
    const { container } = render(<ThemeScript initialPreference="light" />);
    expect(container.querySelector("script")).toBeNull();
    expect(insertedScript().type).toBe("script");
  });

  it("forwards the CSP nonce to the inline script", () => {
    render(<ThemeScript initialPreference="light" nonce="test-nonce" />);
    expect(insertedScript().props).toMatchObject({
      id: "theme-initializer-script",
      nonce: "test-nonce",
    });
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

  it("generated script gates SVG backdrop-filter to Blink", () => {
    const script = getThemeScript("light");
    expect(script).toContain("root.dataset.backdropFilterUrl");
    expect(script).toContain("isBlink");
    expect(script).toContain("CriOS");
    expect(script).toContain("isAndroidWebView");
  });
});

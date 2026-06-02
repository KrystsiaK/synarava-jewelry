import { describe, it, expect } from "vitest";
import { isThemePreference, THEME_COOKIE_NAME, THEME_OPTIONS } from "../theme/shared";

describe("isThemePreference", () => {
  it('returns true for "light"', () => expect(isThemePreference("light")).toBe(true));
  it('returns true for "dark"', () => expect(isThemePreference("dark")).toBe(true));
  it('returns true for "system"', () => expect(isThemePreference("system")).toBe(true));
  it("returns false for an unknown string", () => expect(isThemePreference("blue")).toBe(false));
  it("returns false for undefined", () => expect(isThemePreference(undefined)).toBe(false));
  it("returns false for null", () => expect(isThemePreference(null)).toBe(false));
  it("returns false for empty string", () => expect(isThemePreference("")).toBe(false));
});

describe("constants", () => {
  it("THEME_COOKIE_NAME is synarava-theme", () => {
    expect(THEME_COOKIE_NAME).toBe("synarava-theme");
  });
  it("THEME_OPTIONS contains all three values", () => {
    expect(THEME_OPTIONS).toContain("light");
    expect(THEME_OPTIONS).toContain("dark");
    expect(THEME_OPTIONS).toContain("system");
  });
});

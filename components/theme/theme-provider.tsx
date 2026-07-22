"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import {
  THEME_COOKIE_NAME,
  type ThemePreference,
} from "@/lib/theme/shared";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  setPreference: (nextPreference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

type ThemeProviderProps = {
  children: React.ReactNode;
  initialPreference: ThemePreference;
};

function resolveTheme(preference: ThemePreference) {
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return preference;
}

export function ThemeProvider({ children, initialPreference }: ThemeProviderProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(
    initialPreference === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme(nextPreference: ThemePreference) {
      const preferredTheme = resolveTheme(nextPreference);
      const nextResolved = isHome ? "dark" : preferredTheme;
      const root = document.documentElement;
      root.dataset.themePreference = nextPreference;
      root.dataset.theme = nextResolved;
      root.dataset.themeScope = isHome ? "home-dark" : "preference";
      root.style.colorScheme = nextResolved;
      document.cookie = `${THEME_COOKIE_NAME}=${nextPreference}; path=/; max-age=31536000; samesite=lax`;
      setResolvedTheme(nextResolved);
    }

    applyTheme(preference);

    /* c8 ignore next 4 */
    function handleSystemThemeChange() {
      if (preference === "system") {
        applyTheme("system");
      }
    }

    media.addEventListener("change", handleSystemThemeChange);
    return () => {
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, [isHome, preference]);

  const value = useMemo(
    () => ({
      preference,
      resolvedTheme,
      setPreference: setPreferenceState,
    }),
    [preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider.");
  }

  return value;
}

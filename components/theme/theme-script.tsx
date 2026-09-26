"use client";

import { useServerInsertedHTML } from "next/navigation";
import { THEME_COOKIE_NAME, type ThemePreference } from "@/lib/theme/shared";

type ThemeScriptProps = {
  initialPreference: ThemePreference;
  nonce?: string;
};

export function getThemeScript(initialPreference: ThemePreference): string {
  return `
    (() => {
      const storageKey = ${JSON.stringify(THEME_COOKIE_NAME)};
      const root = document.documentElement;
      const initialPreference = ${JSON.stringify(initialPreference)};

      const getCookiePreference = () => {
        const match = document.cookie.match(new RegExp('(?:^|; )' + storageKey + '=([^;]+)'));
        const value = match ? decodeURIComponent(match[1]) : '';
        return value === 'light' || value === 'dark' || value === 'system' ? value : null;
      };

      const preference = getCookiePreference() ?? initialPreference;
      const resolved =
        preference === 'system'
          ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
          : preference;

      root.dataset.themePreference = preference;
      root.dataset.theme = resolved;
      root.style.colorScheme = resolved;
    })();
  `;
}

export function ThemeScript({ initialPreference, nonce }: ThemeScriptProps) {
  // Inserted as raw head HTML on the server. A client-rendered <script> is never
  // executed and warns in React 19. https://nextjs.org/docs/app/guides/css-in-js
  useServerInsertedHTML(() => (
    <script
      id="theme-initializer-script"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: getThemeScript(initialPreference) }}
    />
  ));

  return null;
}

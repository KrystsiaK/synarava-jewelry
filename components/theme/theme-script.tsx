import { THEME_COOKIE_NAME, type ThemePreference } from "@/lib/theme/shared";

type ThemeScriptProps = {
  initialPreference: ThemePreference;
};

export function ThemeScript({ initialPreference }: ThemeScriptProps) {
  const script = `
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

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}


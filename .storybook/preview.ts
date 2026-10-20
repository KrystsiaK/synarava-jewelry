import { createElement, useEffect, type ReactNode } from "react";
import type { Decorator, Preview } from "@storybook/react";
import "../app/globals.css";

function StorybookTheme({ Story, theme }: { Story: () => ReactNode; theme: "light" | "dark" }) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  return createElement(Story);
}

const withTheme: Decorator = (Story, context) =>
  createElement(StorybookTheme, {
    Story,
    theme: context.globals.theme === "light" ? "light" : "dark",
  });

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Synarava theme",
      defaultValue: "dark",
      toolbar: {
        icon: "mirror",
        items: ["dark", "light"],
      },
    },
  },
  decorators: [withTheme],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /date$/i,
      },
    },
  },
};

export default preview;

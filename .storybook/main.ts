import type { StorybookConfig } from "@storybook/react-vite";
import { resolve } from "path";

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  docs: { autodocs: "tag" },
  async viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@": resolve(__dirname, ".."),
      "next/link": resolve(__dirname, "./mocks/next-link.tsx"),
      "next/navigation": resolve(__dirname, "./mocks/next-navigation.ts"),
    };
    return config;
  },
};

export default config;

// This file has been automatically migrated to valid ESM format by Storybook.
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { resolve, dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
  stories: ["../components/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-mcp", "@storybook/addon-docs"],

  framework: {
    name: "@storybook/react-vite",
    options: {},
  },

  async viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "@/lib/db": resolve(__dirname, "./mocks/db.ts"),
      "@/app/admin/actions/storefront-href": resolve(
        __dirname,
        "./mocks/storefront-href-action.ts",
      ),
      "@": resolve(__dirname, ".."),
      "next/image": resolve(__dirname, "./mocks/next-image.tsx"),
      "next/link": resolve(__dirname, "./mocks/next-link.tsx"),
      "next/navigation": resolve(__dirname, "./mocks/next-navigation.ts"),
      ".prisma/client/index-browser": resolve(__dirname, "./mocks/prisma-client-browser.ts"),
      "server-only": resolve(__dirname, "./mocks/server-only.ts"),
      "node:crypto": resolve(__dirname, "./mocks/node-crypto.ts"),
      "@prisma/client": resolve(__dirname, "./mocks/prisma-client.ts"),
      "@prisma/client/index-browser": resolve(__dirname, "./mocks/prisma-client.ts"),
    };
    return config;
  }
};

export default config;

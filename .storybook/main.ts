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
    // Array form: longer `find` keys must come before the `@` prefix alias.
    // Object form lets `@` steal `@/app/...` and `@/lib/...` before mocks apply.
    const existing = config.resolve.alias;
    const prior = Array.isArray(existing)
      ? existing
      : existing
        ? Object.entries(existing as Record<string, string>).map(([find, replacement]) => ({
            find,
            replacement,
          }))
        : [];
    config.resolve.alias = [
      { find: "@/lib/db", replacement: resolve(__dirname, "./mocks/db.ts") },
      {
        find: "@/app/admin/actions/storefront-href",
        replacement: resolve(__dirname, "./mocks/storefront-href-action.ts"),
      },
      {
        find: "@/app/admin/actions/reviews",
        replacement: resolve(__dirname, "./mocks/reviews-actions.ts"),
      },
      {
        find: "@/app/admin/actions/marketing",
        replacement: resolve(__dirname, "./mocks/marketing-actions.ts"),
      },
      { find: "next/image", replacement: resolve(__dirname, "./mocks/next-image.tsx") },
      { find: "next/link", replacement: resolve(__dirname, "./mocks/next-link.tsx") },
      {
        find: "next/navigation",
        replacement: resolve(__dirname, "./mocks/next-navigation.ts"),
      },
      { find: "next/cache", replacement: resolve(__dirname, "./mocks/next-cache.ts") },
      { find: "next/headers", replacement: resolve(__dirname, "./mocks/next-headers.ts") },
      {
        find: ".prisma/client/index-browser",
        replacement: resolve(__dirname, "./mocks/prisma-client-browser.ts"),
      },
      { find: "server-only", replacement: resolve(__dirname, "./mocks/server-only.ts") },
      { find: "node:crypto", replacement: resolve(__dirname, "./mocks/node-crypto.ts") },
      { find: "@prisma/client", replacement: resolve(__dirname, "./mocks/prisma-client.ts") },
      {
        find: "@prisma/client/index-browser",
        replacement: resolve(__dirname, "./mocks/prisma-client.ts"),
      },
      { find: "@", replacement: resolve(__dirname, "..") },
      ...prior.filter(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "find" in entry &&
          ![
            "@/lib/db",
            "@/app/admin/actions/storefront-href",
            "@/app/admin/actions/reviews",
            "@/app/admin/actions/marketing",
            "next/image",
            "next/link",
            "next/navigation",
            "next/cache",
            "next/headers",
            ".prisma/client/index-browser",
            "server-only",
            "node:crypto",
            "@prisma/client",
            "@prisma/client/index-browser",
            "@",
          ].includes(String((entry as { find: unknown }).find)),
      ),
    ];
    config.define = {
      ...config.define,
      "process.env": {},
      "process.env.NODE_ENV": JSON.stringify("development"),
    };
    return config;
  }
};

export default config;

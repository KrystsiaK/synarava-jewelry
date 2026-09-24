import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // GHA runners under load exceed the 5s default on heavy admin form suites.
    testTimeout: 15_000,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      exclude: [
        "**/*.stories.tsx",
        "**/__tests__/**",
        "**/node_modules/**",
        "components/ui/index.ts",
        "components/shop/index.ts",
        "lib/db.ts",
        "lib/env.ts",
        "lib/s3.ts",
        "lib/stripe.ts",
        "lib/commerce/**",
        "lib/auth/**",
        "lib/content/**",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      "server-only": resolve(__dirname, "test/server-only.ts"),
    },
  },
});

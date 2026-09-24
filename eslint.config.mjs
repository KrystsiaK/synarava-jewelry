import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files:
    "coverage/**",
    "graphify-out/**",
    "storybook-static/**",
    // Local agent/tooling bundles are not application source.
    ".agents/**",
    ".claude/**",
    ".codex-tmp/**",
    "artifacts/**",
    "edited-product-photos/**",
  ]),
  // Vendored Bklit chart kit (portal axes, mount gates, motion measurement)
  // uses patterns React 19 eslint forbids; keep other rules, relax those two.
  {
    files: ["components/charts/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
]);

export default eslintConfig;

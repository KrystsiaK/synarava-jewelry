// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

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
    // ECC Cursor vendor surface (CommonJS hooks/scripts/skills) — not app code.
    // Keep .cursor/rules/** on the lint surface if/when they become JS/TS.
    ".cursor/scripts/**",
    ".cursor/hooks/**",
    ".cursor/skills/**",
    ".cursor/.agents/**",
    ".cursor/.pi/**",
    "artifacts/**",
    "edited-product-photos/**",
    "services/sku-api/src/generated/**",
    "services/sku-api/dist/**",
    "packages/*/dist/**",
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
  // Admin UI must use synarava-cms field primitives — no raw form tags.
  // Library implementations live under components/admin/shared (exempt).
  {
    files: ["components/admin/**/*.{js,jsx,ts,tsx}", "app/admin/**/*.{js,jsx,ts,tsx}"],
    ignores: ["components/admin/shared/**", "components/synarava-cms/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='select']",
          message:
            "use AdminSelectField / AdminTextField / AdminCheckboxField / AdminLongTextField from @/components/synarava-cms",
        },
        {
          selector: "JSXOpeningElement[name.name='input']",
          message:
            "use AdminSelectField / AdminTextField / AdminCheckboxField / AdminLongTextField from @/components/synarava-cms",
        },
        {
          selector: "JSXOpeningElement[name.name='textarea']",
          message:
            "use AdminSelectField / AdminTextField / AdminCheckboxField / AdminLongTextField from @/components/synarava-cms",
        },
      ],
    },
  },
  ...storybook.configs["flat/recommended"]
]);

export default eslintConfig;

// ESLint 9 flat config. Replaces .eslintrc.cjs, which ESLint 9 refused to
// load, leaving `pnpm lint` broken and no lint running anywhere (Next 16 no
// longer lints during `next build`). Mirrors the previous rule set:
// next/core-web-vitals + typescript-eslint type-checked + drizzle guards.
//
// Severity policy (see docs/LAUNCH_PLAN.md, Phase 0):
// - Correctness rules are errors and block CI.
// - The `any` / `no-unsafe-*` family and the stylistic type-checked rules are
//   warnings, capped by `--max-warnings` in package.json. The cap is a ratchet:
//   lower it as files are cleaned, never raise it. Many current offenders are
//   deleted outright in Phase 1 (custom checkout, discounts, shipping zones).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
// Only the rule tables are read from the plugin package; the plugin itself
// is already registered under "@typescript-eslint" by eslint-config-next's
// typescript preset, and flat config refuses a second registration.
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import drizzle from "eslint-plugin-drizzle";

// Rules of the last (rule-bearing) entry of a typescript-eslint flat preset.
const presetRules = (name) => tsPlugin.configs[name].at(-1).rules;

// Downgrade every rule in a table to "warn", preserving options.
const asWarnings = (rules) =>
  Object.fromEntries(
    Object.entries(rules).map(([rule, level]) => [
      rule,
      Array.isArray(level) ? ["warn", ...level.slice(1)] : "warn",
    ]),
  );

export default defineConfig([
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "coverage/**",
    "drizzle/**",
    "next-env.d.ts",
    "*.config.*",
    "scripts/**",
  ]),

  ...nextVitals,
  ...nextTs,

  // Type-aware rules for application code. `projectService` lets
  // typescript-eslint reuse tsconfig.json without listing files here.
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { drizzle },
    rules: {
      ...presetRules("flat/recommended-type-checked"),
      ...asWarnings(presetRules("flat/stylistic-type-checked")),

      // Ratchet set: warnings for now (capped), errors once the count is 0.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      // React Compiler era hook rules: existing setState-in-effect patterns
      // are refactored in Phase 3/4 (CLAUDE.md wants fewer effects anyway).
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/globals": "warn",

      // Carried over from .eslintrc.cjs
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      // A DELETE or UPDATE without .where() would touch every row.
      "drizzle/enforce-delete-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
      "drizzle/enforce-update-with-where": [
        "error",
        { drizzleObjectName: ["db", "ctx.db"] },
      ],
    },
  },

  // Tests mock freely; the unsafe-* family only adds noise there.
  {
    files: ["src/__tests__/**"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-empty-function": "off",
    },
  },
]);

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A leading underscore marks a value dropped on purpose, e.g. `const { secret: _secret, ...rest } = row`
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
      // React Compiler guidance: flags the fetch-on-mount pattern ~45 screens use
      // (useEffect(() => { load(); }, [load]) with a loading flag). It works and this app doesn't use the
      // compiler, so it stays visible as a warning instead of failing CI; convert screens to a data
      // library (e.g. TanStack Query, as the apps use) when they are next reworked.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

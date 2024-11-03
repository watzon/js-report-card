import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(process.cwd(), "tsconfig.json");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  // Convert existing configs that don't have flat config support yet
  ...compat.extends("prettier", "turbo"),
  
  {
    files: ["**/*.js", "**/*.jsx", "**/*.ts", "**/*.tsx"],
    plugins: {
      "only-warn": (await import("eslint-plugin-only-warn")).default
    },
    languageOptions: {
      globals: {
        React: true,
        JSX: true,
      },
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      }
    },
    settings: {
      "import/resolver": {
        typescript: {
          project,
        },
      },
    },
    ignores: [
      // Ignore dotfiles
      ".*.js",
      "**/node_modules/*",
      "**/dist/*",
    ],
  }
]; 
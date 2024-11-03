import path from "node:path";
import { fileURLToPath } from "node:url";
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import libraryConfig from "@repo/config/eslint/library.mjs";

// Get current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default [
  jest.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  ...libraryConfig,
  
  // Project-specific overrides
  {
    files: ["src/**/*.js", "src/**/*.ts"],
    languageOptions: {
      globals: {
        node: true,
        jest: true,
      },
      parserOptions: {
        project: "./tsconfig.lint.json",
        tsconfigRootDir: __dirname,
      },
    }
  }
]; 
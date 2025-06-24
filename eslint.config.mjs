import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

const eslintConfig = [
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "functions/lib/**"],
    rules: {
      // TypeScript-aware rules
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "error",
    },
  },
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "functions/lib/**"],
    rules: {
      // JavaScript rules
      "no-unused-vars": "warn",
      "prefer-const": "error",
    },
  },
  {
    // Allow console in scripts and test files
    files: ["scripts/**/*.js", "**/*.test.{ts,tsx,js,jsx}", "jest.setup.js"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-unused-vars": "off",
    },
  },
];

export default eslintConfig;

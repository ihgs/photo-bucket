import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "node_modules/",
      "dist/",
      "dev-dist/",
      "coverage/",
      "test-results/",
      "playwright-report/",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "ユーザー入力の直接挿入は禁止（憲章 技術的制約）" },
        { property: "outerHTML", message: "ユーザー入力の直接挿入は禁止（憲章 技術的制約）" },
      ],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);

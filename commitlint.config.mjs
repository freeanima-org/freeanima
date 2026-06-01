/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  ignores: [(message) => message.startsWith("Merge ")],
  rules: {
    // 与 docs/versioning.md、.releaserc.json 对齐
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "perf", "docs", "chore", "refactor", "test", "ci", "build", "revert"],
    ],
    // 允许中文 subject
    "subject-case": [0],
  },
};

/** @typedef {import('conventional-changelog-conventionalcommits').PresetConfig} PresetConfig */

/** @type {PresetConfig} */
const presetConfig = {
  types: [
    { type: "feat", section: "Features" },
    { type: "fix", section: "Bug Fixes" },
    { type: "perf", section: "Performance" },
    { type: "revert", section: "Reverts" },
    { type: "docs", section: "Documentation", hidden: false },
    { type: "chore", section: "Miscellaneous", hidden: false },
    { type: "refactor", section: "Refactoring", hidden: false },
    { type: "test", section: "Tests", hidden: false },
    { type: "ci", section: "CI", hidden: false },
    { type: "build", section: "Build", hidden: false },
  ],
};

/** conventionalcommits preset 默认用 * 列表符；oxfmt 统一为 -，此处 patch 使生成即符合 format。 */
async function dashListWriterOpts() {
  const createPreset = (await import("conventional-changelog-conventionalcommits")).default;
  const { writer } = await createPreset(presetConfig);
  return {
    commitPartial: writer.commitPartial.replace(/^\*/, "-"),
    mainTemplate: writer.mainTemplate.replace(/^\* /gm, "- "),
  };
}

module.exports = (async () => {
  const writerOpts = await dashListWriterOpts();

  return {
    branches: ["main", "master"],
    tagFormat: "v${version}",
    plugins: [
      [
        "@semantic-release/commit-analyzer",
        {
          preset: "conventionalcommits",
          releaseRules: [
            { breaking: true, release: "minor" },
            { type: "feat", release: "patch" },
            { type: "fix", release: "patch" },
            { type: "perf", release: "patch" },
            { type: "revert", release: "patch" },
          ],
        },
      ],
      [
        "@semantic-release/release-notes-generator",
        {
          preset: "conventionalcommits",
          presetConfig,
          writerOpts,
        },
      ],
      [
        "@semantic-release/changelog",
        {
          changelogFile: "CHANGELOG.md",
          changelogTitle:
            "# 变更日志\n\n版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。\n新版本节由 [semantic-release](https://semantic-release.gitbook.io/) 根据 Conventional Commits 自动写入顶部。\n",
        },
      ],
      [
        "@semantic-release/npm",
        {
          npmPublish: false,
        },
      ],
      [
        "@semantic-release/exec",
        {
          prepareCmd: "bun run build:cli",
          publishCmd: "bash scripts/publish-cli.sh",
        },
      ],
      [
        "@semantic-release/github",
        {
          successComment: false,
          failComment: false,
        },
      ],
      [
        "@semantic-release/git",
        {
          assets: ["CHANGELOG.md", "package.json"],
          message: "chore(release): ${nextRelease.version}\n\n${nextRelease.notes}",
        },
      ],
    ],
  };
})();

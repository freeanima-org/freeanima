# Electron 桌面壳打包

> `src/app/shell/desktop/`：main/preload 经 esbuild 打出 `electron-dist/*.cjs`，再由 electron-builder 生成安装包。

## 根因（频发类）

| 现象                                 | 典型原因                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `default is not a constructor`       | ESM-only 包（如 `electron-store`）被 **external**，CJS `require().default` 在运行时不是构造函数                                                |
| `Cannot find module 'xxx'`           | 根 `package.json` 依赖被标 external，但 **安装包不携带 node_modules**（`electron-builder.yml` 仅 `electron-dist` + `vendor` + `package.json`） |
| 开发 `dev:electron` 正常、安装包崩溃 | 开发机有完整 `node_modules`，与 asar 内运行时环境不一致                                                                                        |

## 强制策略（代码 SSOT）

1. **安装包不带 node_modules**（`electron-builder.yml` 仅 `electron-dist` + `vendor` + `package.json`）。根 `package.json` 里绝大多数依赖会被 esbuild 标为 **external**，运行时 `require` 会失败。
2. **主进程 npm 依赖默认加入 `BUNDLED_NPM_PACKAGES`**（`build-electron.ts`），打进 `main.cjs`。ESM-only（如 `electron-store`）尤其必须内联。
3. **打包后断言**：`assertElectronMainBundle()` 禁止 `require("electron-store")` 等；`bundleElectronMain` 与 `build-electron.test.ts` 执行。
4. **仅 `electron` + 可选 native** 可留在 `ELECTRON_MAIN_EXTERNAL_ALLOWLIST`；新增 native 依赖须同时改 `electron-builder.yml` 携带二进制。

## 禁止

- 在主进程新加 `import` 后只跑 `dev:electron`、不更新 `BUNDLED_NPM_PACKAGES`、不跑 `build-electron.test.ts`。
- 对 ESM-only 包依赖 runtime `require().default`（除非已确认内联进 bundle）。

## 发版前检查

```bash
bun test src/app/shell/desktop/build-electron.test.ts
bun run package:windows   # 或 CI desktop-shell-release
```

Windows 安装包需在目标机 **冷启动** 验证一次（无开发用 node_modules）。

## 安装器（Windows NSIS）

- 覆盖安装前：`--quit-for-install` 由 `electron/main-entry.ts` **先于** 主逻辑加载（避免旧版 main 启动即崩时无法响应安装器）。
- 删旧目录失败（20 次重试后仍有残留）时 **中止安装** 并提示手动删除；日志：`%TEMP%\FreeAnima-Desktop-install.log`。
- 首次启动未配置 Hub API Token：打开 `/settings`（连接），companion SAP **延后连接**（有 token 后再 `reconnectCompanionSap`）。
- 主窗口 UI：默认本地 `vendor/shell-ui`（来自 `web/dist`）；调试用 `DESKTOP_SHELL_VITE_URL` 或 `DESKTOP_UI_MODE=remote`。

## 相关文件

| 文件                                          | 作用                                             |
| --------------------------------------------- | ------------------------------------------------ |
| `build-electron.ts`                           | esbuild 配置、vendor 构建、electron-builder 调用 |
| `electron-main-bundle-assert.ts`              | main.cjs 不变量                                  |
| `electron-builder.yml`                        | 打进 asar 的文件清单（无 node_modules）          |
| `.github/workflows/desktop-shell-release.yml` | Release 构建                                     |

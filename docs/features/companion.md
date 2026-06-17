---
title: Desktop Companion
---

# 桌面伴侣（Companion）

> **Dynamic SAP 卫星**：单体桌面 GUI 应用，不经 `config.yaml` managed 托管。

桌面伴侣是运行在用户桌面上的 SAP Type B 应用：Tauri 透明壳 + 内嵌 Bun sidecar，通过 SAP 向 Hub **注册在线实例**（不注册 Agent 工具）。

## 架构

```text
用户桌面（单体应用）
├── Tauri 壳 — 双窗口、点击穿透、托盘
│   ├── companion 窗 — 透明置顶，VRM 渲染与本地交互
│   └── settings 窗 — 普通有边框窗口，从托盘打开
└── Bun sidecar — runSapTransport（Hub 注册）
         ↕ SAP WS（可跨机）
    anima service Hub
```

与 Parlor / 结对编程的区别：

|             | Parlor / 结对编程            | Companion                                 |
| ----------- | ---------------------------- | ----------------------------------------- |
| UI          | 浏览器 Web UI                | 原生透明伴侣窗 + 独立设置窗               |
| 部署        | Managed（可与 service 同机） | Dynamic（用户自行启动）                   |
| 客户端与 UI | 可分离                       | 伴侣渲染与设置窗分离，同属一个 Tauri 应用 |

## 功能

- VRM 角色渲染（Three.js + `@pixiv/three-vrm`）；VRM 1.0 与 0.x 自动校正朝向
- **VRMA 动作库**（`@pixiv/three-vrm-animation`）：待机循环 + 点击部位触发动作
- 透明置顶 companion 窗（160×260，脚底对齐底边、上方留摆臂空间）+ 角色区域可点、空白穿透
- **本地交互**：拖拽移动窗口；点击头/躯干/手臂/腿触发不同 VRMA 动作
- **空闲巡逻**：无交互 3 分钟后沿屏幕**工作区内边缘**四角匀速巡逻；任意交互停止并重置计时
- **双击巡逻**：双击角色立即进入巡逻；先从当前位置走到**最近的工作区边缘**，再沿边缘顺时针巡逻
- **启动归位**：首次加载 VRM 后从工作区**中心**走到**左上角**；之后待机于左上角
- 系统托盘：显示/隐藏伴侣、打开设置、退出
- 设置窗：Hub URL、VRM 模型导入与路径、VRMA 动作包导入、位移动作按需导入（走路/攀爬）

## 模型与动作

仓库**不捆绑** `.vrm` / `.vrma` 文件。

### VRM 模型

1. 从 [VRoid Hub](https://hub.vroid.com/) 或 [VRoid Studio](https://vroid.com/en/studio) 获取允许使用的 `.vrm` 模型
2. 从系统托盘打开**设置**，点击「导入模型」
3. 模型保存到 `~/.anima/companion/models/`（可通过 `FREEANIMA_HOME` 覆盖数据根目录）

开发期可将文件放入 `satellites/companion/public/models/` 作为回退目录。

### VRMA 动作

1. 从系统托盘打开**设置**
2. 点击「打开 BOOTH 下载页」，登录 pixiv 后下载 `VRMA_MotionPack.zip`
3. 点击「导入动作包 ZIP」（官方 zip 内为 `vrma/` 子目录，导入时会自动展平）

动作保存到 `~/.anima/companion/motions/`（`.vrma` 文件在根目录，无 `vrma/` 子层）。开发期回退目录见 [`public/motions/README.md`](../../satellites/companion/public/motions/README.md)。

BOOTH 官方包需登录，无法无账号自动下载。若自建 zip 镜像，可设置 `COMPANION_VRMA_ZIP_URL`，sidecar 启动时会尝试拉取。

未放置 VRMA 时回退到程序化 idle 动画。

### 位移动作（走路 / 攀爬，按需导入）

默认巡逻位移使用程序化 walk（不依赖外部 VRMA）。如果你希望更自然的走路或纵向攀爬动作，可以在设置中分别导入：

- **走路（walk）**：`.vrma` 或 Mixamo `.fbx`（会自动转换为 `.vrma`）
- **攀爬（climb）**：`.vrma` 或 Mixamo `.fbx`（会自动转换为 `.vrma`）

导入后文件保存到 `~/.anima/companion/motions/`，并写入 `~/.anima/companion/config.json` 的 `locomotion` 段落。清除后会回退到程序化动作。

配置持久化在 `~/.anima/companion/config.json`。

## 开发与运行

### 浏览器开发（无需 Tauri）

```bash
bun satellites/companion/dev.ts
# 伴侣：http://127.0.0.1:4176
# 设置：http://127.0.0.1:4176/#/settings
```

环境变量：

| 变量                     | 默认                    | 说明                                    |
| ------------------------ | ----------------------- | --------------------------------------- |
| `FREEANIMA_URL`          | `http://127.0.0.1:2658` | Hub 地址（可跨机）                      |
| `SATELLITE_PORT`         | `4176`                  | sidecar HTTP 端口                       |
| `SATELLITE_INSTANCE_ID`  | 随机 UUID               | 实例 ID                                 |
| `COMPANION_VRMA_ZIP_URL` | （空）                  | 可选；直链 zip 镜像，sidecar 启动时下载 |

### Tauri 桌面壳

```bash
cd satellites/companion
bun install
bun dev.ts

bun run build:windows
bun run build:windows:installer
```

### 常见问题

| 现象                 | 处理                                                                      |
| -------------------- | ------------------------------------------------------------------------- |
| 双击无窗口           | 看系统托盘；托盘 → **设置…** 导入 `.vrm`                                  |
| 点击无动作           | 设置 → **导入动作包 ZIP**；或确认 `~/.anima/companion/motions/` 已有 VRMA |
| 无法连 Hub           | 确认 `anima service` 已运行；设置中 Hub URL 正确                          |
| 后台启动失败         | 查看 `%USERPROFILE%\.anima\companion\shell.log`；安装 WebView2 运行时     |
| 升级安装无法覆盖 exe | 托盘 → **退出** 后再运行安装包；新版安装器会自动结束 sidecar 进程         |
| 退出后 sidecar 仍在  | 请用托盘 **退出**（勿直接结束 companion-shell）；新版会一并结束 sidecar   |

## 相关文档

- SAP 卫星指南：[`satellite-guide.md`](../sap/satellite-guide.md)
- SAP 安全模型：[`security-model.md`](../sap/security-model.md)

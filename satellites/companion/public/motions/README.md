# VRMA 动作目录

本仓库**不捆绑** `.vrma` 动作文件。

## 推荐方式（设置 → 动作库 Tab）

1. 从系统托盘（Tauri）或页面「设置」打开设置
2. 在 **动作库** Tab 点击「打开 BOOTH 下载页」，登录 pixiv 后下载 `VRMA_MotionPack.zip`
3. 点击「导入动作包 ZIP」（会自动解开 `vrma/` 子目录，文件保存到 `motions/` 根目录）
4. 在 **动作槽位** Tab 为各槽位（`idle`、`in_place`、`walk`、`climb` 等）勾选已导入的动作

官方 zip 内结构为 `vrma/VRMA_*.vrma`，无需手动解压或调整目录。

文件会解压到 `~/.anima/companion/motions/`（可通过 `FREEANIMA_HOME` 覆盖数据根目录）。

## 槽位说明

| 槽位       | 用途                              |
| ---------- | --------------------------------- |
| `idle`     | 待机循环                          |
| `rest`     | 休息（仅 `play_slot` 或手动触发） |
| `in_place` | 点击身体任意部位时随机播放        |
| `walk`     | 横向巡逻时的移动动画（可选）      |
| `climb`    | 纵向巡逻时的移动动画（可选）      |

槽位未绑定动作时不播放动画。巡逻仍会平移窗口；仅在有对应 VRMA 时播放移动动画。

## 开发期回退

也可将下列文件手动放入此目录（`public/motions/`），并在动作槽位中勾选：

- `VRMA_01.vrma` — 建议绑定 `idle`
- `VRMA_02.vrma`、`VRMA_03.vrma`、`VRMA_06.vrma`、`VRMA_07.vrma` — 建议绑定 `in_place`

来源：[VRoid 官方 7 种免费 VRMA 套装](https://vroid.com/en/news/6HozzBIV0KkcKf9dc1fZGW)（[BOOTH 5512385](https://booth.pm/ja/items/5512385)）。使用前请阅读商品页许可条款。

## 自动下载（可选）

BOOTH 官方链接**需要登录**，无法无账号静默下载。若你自行托管 zip 镜像，可设置环境变量：

```bash
COMPANION_VRMA_ZIP_URL=https://example.com/VRMA_MotionPack.zip
```

sidecar 启动时会尝试下载；设置页也会出现「从镜像自动下载」按钮。

## 巡逻走路 / 攀爬（可选）

在 **动作槽位** Tab 为 `walk`（横向移动）或 `climb`（纵向移动）导入并绑定 In Place 的 VRMA 后，巡逻时会播放对应槽位动作；未绑定则窗口仍平移，角色不播移动动画。

### Mixamo（免费，需 Adobe 账号）

- 站点：<https://www.mixamo.com/>
- 下载：**FBX**、**Without Skin**、勾选 **In Place**
- 在设置中通过动作库导入 FBX，sidecar 会转换为 `.vrma`

许可以各资源商品页为准；导入后仅保存在本机 `~/.anima/companion/motions/`。

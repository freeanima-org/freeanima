# VRMA 动作目录

本仓库**不捆绑** `.vrma` 动作文件。

## 推荐方式（设置页导入）

1. 从系统托盘打开**设置**
2. 点击「打开 BOOTH 下载页」，登录 pixiv 后下载 `VRMA_MotionPack.zip`
3. 点击「导入动作包 ZIP」（会自动解开 `vrma/` 子目录，文件保存到 `motions/` 根目录）

官方 zip 内结构为 `vrma/VRMA_*.vrma`，无需手动解压或调整目录。

文件会解压到 `~/.anima/companion/motions/`（可通过 `FREEANIMA_HOME` 覆盖数据根目录）。

## 开发期回退

也可将下列文件手动放入此目录（`public/motions/`）：

- `VRMA_01.vrma` — 待机循环
- `VRMA_02.vrma` — 头部点击（打招呼）
- `VRMA_03.vrma` — 手臂点击（V 字）
- `VRMA_06.vrma` — 躯干点击（模特姿势）
- `VRMA_07.vrma` — 腿部点击（屈伸）

来源：[VRoid 官方 7 种免费 VRMA 套装](https://vroid.com/en/news/6HozzBIV0KkcKf9dc1fZGW)（[BOOTH 5512385](https://booth.pm/ja/items/5512385)）。使用前请阅读商品页许可条款。

## 自动下载（可选）

BOOTH 官方链接**需要登录**，无法无账号静默下载。若你自行托管 zip 镜像，可设置环境变量：

```bash
COMPANION_VRMA_ZIP_URL=https://example.com/VRMA_MotionPack.zip
```

sidecar 启动时会尝试下载；设置页也会出现「从镜像自动下载」按钮。

未放置动作文件时，伴侣将回退到程序化 idle 动画。

## 巡逻走路 / 攀爬（可选扩展）

当前**巡逻位移**使用程序化摆腿（`VrmProceduralLocomotion`），不依赖 VRMA。  
VRoid 官方 7 件套**不含**走路循环或攀爬，若要横向蹦蹦跳跳、纵向攀爬，需自行准备额外动作并导入 `~/.anima/companion/motions/`（Companion **不二次分发**第三方 `.vrma`，仅播放用户本地文件）。

### 推荐：Mixamo（免费，需 Adobe 账号）

- 站点：<https://www.mixamo.com/>
- 搜索示例：
  - 横向：`Happy Walk`、`Skipping`、`Cartwheel Walk`
  - 纵向：`Climbing Ladder`、`Ledge Climb`、`Wall Climb`
- 下载：**FBX**、**Without Skin**、勾选 **In Place**（原地循环，避免位移）
- 转为 `.vrma`：
  - [fbx2vrma-converter](https://github.com/tk256ailab/fbx2vrma-converter)（命令行，适合 Mixamo FBX）
  - 或 Unity + [UniVRM](https://github.com/vrm-c/UniVRM) / [AnimationClipToVrmaSample](https://github.com/malaybaku/AnimationClipToVrmaSample)（`.anim` → `.vrma`）

### BOOTH 免费资源（多为 `.anim`，需 Unity 转 VRMA）

| 资源                  | 链接                                                                | 说明                                                     |
| --------------------- | ------------------------------------------------------------------- | -------------------------------------------------------- |
| VRM お人形遊び 动画包 | [fumi2kick/items/1655686](https://fumi2kick.booth.pm/items/1655686) | 0 日元，含**歩き**循环 `.anim`，许可允许在其他 app 使用  |
| BOOTH VRMA 分类       | [booth.pm 标签 VRMA](https://booth.pm/ja/items?tags=VRMA)           | 筛选「0 JPY」找原生 `.vrma`；走路/攀爬较少，需逐个看预览 |

### 免费自制 VRMA（简易循环）

- [VRMお手軽ポーズ](https://www.vrmwebpose.app/)：浏览器免费，可导出 `.vrma` 简易循环（适合轻量蹦跳，质感一般）
- VRM Posing Desktop（Steam 付费，搜索 _VRM Posing Desktop_）：关键帧做 loop 后导出 `.vrma`

### 许可提醒

- 各资源**商品页条款为准**；多数禁止二次分发进安装包或公开镜像
- 导入后仅保存在本机 `~/.anima/companion/motions/`，与官方 VRoid 包相同用法

接入 Companion 后，需在 `app/src/renderer/motions/manifest.json` 增加 `locomotion` 映射（代码侧尚未实现方向分流，可后续 PR）。

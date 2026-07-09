# 桌面伴侣设置

伴侣配置分两层存储：

| 层级                              | 内容                                                        | 存取                                          |
| --------------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| **Hub PG**（`companion_profile`） | 行为、模型、动作库、槽位                                    | 设置 → Hub 服务 → 桌面伴侣；经 Hub RPC / HTTP |
| **本机**                          | 窗口显隐（`companion-shell` scope）、SAP 运行时状态（只读） | 设置 → 本机 → 桌面伴侣                        |

Sidecar 本地 `~/.anima/companion/config.json` 仅为 **hub-sync 缓存**，设置 UI 不直接读写。

修改 Hub profile 后，sidecar 通过 `companion.sync.pull` 同步到本机；overlay 通过 `emitConfigChanged` 刷新。

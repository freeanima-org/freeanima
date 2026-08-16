# 变更日志

版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。
新版本节由 [Release Please](https://github.com/googleapis/release-please) 在 Release PR 合并时写入顶部。

## [0.11.0](https://github.com/freeanima-org/freeanima/compare/v0.10.1...v0.11.0) (2026-08-16)


### ⚠ BREAKING CHANGES

* max_turns→max_loop_iterations； goal turn_*→continue_*； compression.max_rounds→max_message_pairs； 无双读，依赖 migration 改写存量。
* **conversation:** conversations.module 已删除；会话不再使用 remote:/sap:/cron 作为 platform；请改用 flat platform + scenario，并执行本次数据迁移。
* **toolset:** Outpost tool.register 默认由 private(mask-only) 改为 catalog；未显式传 private/visibility 的远程工具集会进入目录与搜索。
* **portal:** Firefox gecko id 从 vault@freeanima.com 改为 extension@freeanima.com，已装用户须卸旧装新
* 不再支持 locale 切换与英文 UI/docs SSOT；构建不再依赖 gettext/po4a。
* 删除 ToolMask/bindOpenAiCompatibleLlm/RPC 旧导出与 ui-kit disabled 等兼容 props
* **vault:** Habitat 不再自动生成 agent-machine.key 作为真相源； 未解锁时 Agent 注密（cron/工具/vault()）失败。需在数据维护页从 User 库解锁并 provision 本地缓存。
* **memory:** 移除 memory_recall。请改用 memory_semantic_search、 memory_limbic_search、memory_autobiographical_search、conversation_search。

### Features

* **anima-uri:** 完善聊天引用 chip、协议提示与实体浮层 ([09ae57c](https://github.com/freeanima-org/freeanima/commit/09ae57c9be2000973bb700576cd6b45fa124c373))
* **app-frame:** 窄屏底栏支持常用模块个数 ([03acac3](https://github.com/freeanima-org/freeanima/commit/03acac38bd7cdd7b32b7bb431f38a27e07ff0763))
* **auth:** 支持 Service API Token 再次复制与改名 ([3832408](https://github.com/freeanima-org/freeanima/commit/3832408a79463c35181b9a870c18cfbd501efe3c))
* **autollm:** 贯通 acting subjectId 并堵住 subject_kind 旁路 ([7d7e6cc](https://github.com/freeanima-org/freeanima/commit/7d7e6cc6ba3de8561c96bd55442ce833f69e0e15))
* **bookmark:** 浏览器书签双向同步与壳浏览页 ([5bbb676](https://github.com/freeanima-org/freeanima/commit/5bbb6761df7f0dcb7ccb0bdc0f870278a0a41166))
* **browser-extension:** sync version with project, zip pack for canary/release ([81b28e8](https://github.com/freeanima-org/freeanima/commit/81b28e8441fc0df6f12894dfa2446b1741b1ed4f))
* **browser:** 支持 browser_navigate 按次指定 Camofox profile ([9b50e41](https://github.com/freeanima-org/freeanima/commit/9b50e41a73a5f8395c40fa5c3734be3ce0c1c71a))
* **calendar:** 增加事件日程模块与统一日历视图 ([0faf725](https://github.com/freeanima-org/freeanima/commit/0faf72555cdc07d6e3887579336f8d01f0181a1c))
* **calendar:** 实体浮层增加统一在模块中打开 ([a68c236](https://github.com/freeanima-org/freeanima/commit/a68c236e397b2ef365a472e7c15613b4d4c5fa2f))
* **calendar:** 持久化日程工具栏开关到本机 ([38b253d](https://github.com/freeanima-org/freeanima/commit/38b253d6533cdfb939ba345b5a33adae098fd9be))
* **calendar:** 月周视图显示跨日彩色事件条 ([fdea8f3](https://github.com/freeanima-org/freeanima/commit/fdea8f3c523c4162e6572c9acbd7433776379056))
* **chat:** Codex 式合并折叠 tool 活动条 ([3a6b81a](https://github.com/freeanima-org/freeanima/commit/3a6b81a8afb54a593d5a65aec24e0281b737c5e8))
* **chat:** touch 侧栏用归档按钮替代「更多」 ([29b5f0e](https://github.com/freeanima-org/freeanima/commit/29b5f0e6ae86d9878300c0614049fc95dce5fe16))
* **chat:** 切模块与后台时保持朗读播放 ([0d994ae](https://github.com/freeanima-org/freeanima/commit/0d994ae611597b7b55e4818ec02a8007afa2efb5))
* **chat:** 支持聊天附件与模型输入模态标注 ([90c20bb](https://github.com/freeanima-org/freeanima/commit/90c20bbd9f4e155e9799a6c5923fae90a6d8563a))
* **chat:** 朗读时对代码块/表格/链接等做占位过滤 ([4a1d32f](https://github.com/freeanima-org/freeanima/commit/4a1d32f7b95056daab89646ee7ce97f7c87d401f))
* **chat:** 顶栏流式自动朗读开关 ([5bc486f](https://github.com/freeanima-org/freeanima/commit/5bc486f31151a0205c184d939189271b73f6b947))
* **coding:** Agent Window 三栏与 LLM 三层超时 ([c474d99](https://github.com/freeanima-org/freeanima/commit/c474d992bb5c0682f9bbd8777d9504e432619bfa))
* **coding:** file_patch 立即写盘并精简 Agents 侧栏 ([7f2115a](https://github.com/freeanima-org/freeanima/commit/7f2115a0992e7f9e3bd5a8e834fe7e7c8b4865c3))
* **coding:** 仅 Coding 会话加载项目 Agent 上下文 ([8ff3238](https://github.com/freeanima-org/freeanima/commit/8ff32389ff03992726145bef30e9b667832d3288))
* **coding:** 复用 Chat 对话原子并接入 tool strip ([7dd01b0](https://github.com/freeanima-org/freeanima/commit/7dd01b0f78589f686504ad5e071203066793f359))
* **coding:** 新建 Agent 支持下拉选择已有工作区 ([460a90f](https://github.com/freeanima-org/freeanima/commit/460a90ff207270ce44ce8ca06226bbd4704fc34f))
* **conversation:** 统一 flat platform 与 scenario，移除 module ([edede33](https://github.com/freeanima-org/freeanima/commit/edede33e5ce7def0c15f25048b30d2db29d11fbe))
* **dev:** Habitat 开发态 debounce 硬重启 ([0b1f708](https://github.com/freeanima-org/freeanima/commit/0b1f70886c67ece5d84111df80361965e9ebe2f3))
* **email:** 邮件附件接入对象存储并修复 agent 下载鉴权 ([1592a18](https://github.com/freeanima-org/freeanima/commit/1592a1880941ea05bf533689904b58734b5232dc))
* **entity:** 实体页支持过滤与按 id/关键词搜索 ([5307a9a](https://github.com/freeanima-org/freeanima/commit/5307a9a03af24f3fee0c5f39482e2eb5f7a5db97))
* **extension:** 优化 Vault 保存提示、加密缓存与页内填充 ([207b150](https://github.com/freeanima-org/freeanima/commit/207b1502b7d745678a8ff8500c57f8ec4bb48a08))
* **extension:** 支持 Firefox Vault canary 自托管发运 ([f62f5b6](https://github.com/freeanima-org/freeanima/commit/f62f5b6270ea151a08fa3d3581f73ce46388f39a))
* **extension:** 选项 Tab 显示扩展版本号 ([0d08860](https://github.com/freeanima-org/freeanima/commit/0d08860f8324d32e0c3a3976d0ecce26f98d6c8e))
* **fts:** 补齐 entities 向量续跑并增强 embedding 重建韧性 ([39b1a73](https://github.com/freeanima-org/freeanima/commit/39b1a73aedeb37b180bae351a84be86b1ea15a79))
* **habitat:** 定时任务增删与 cronjob 工具拆分 ([ea8069c](https://github.com/freeanima-org/freeanima/commit/ea8069c8e446a027abd6a25136222130aefb27c9))
* **llm:** 多协议 Format/Preset 与连接设置页重构 ([812db21](https://github.com/freeanima-org/freeanima/commit/812db2140d3c94e35257fc213732bfffebadd958))
* **llm:** 接入 models.dev 元数据并完善场景模型选择器 ([914347c](https://github.com/freeanima-org/freeanima/commit/914347c0cd24781d47196b9698a0f81c9bfe71ca))
* **memory:** Reflect 按簇单轮巩固并展示发现时间 ([c5689ea](https://github.com/freeanima-org/freeanima/commit/c5689ead63aa7865cbbb6906ffa46149d2d9be0a))
* **memory:** 优化上下文管理可观测与常驻配置 ([0fb70e4](https://github.com/freeanima-org/freeanima/commit/0fb70e42a86ba403a30fe378cfa366929062fa8c))
* **memory:** 内建 retain/reflect 并废止浅深睡巩固 ([319e362](https://github.com/freeanima-org/freeanima/commit/319e362892f23d5aef6d51aece40333051bcf45b))
* **memory:** 取消统一 recall，改按范围独立检索 ([9d2894b](https://github.com/freeanima-org/freeanima/commit/9d2894bad3fd4ae9c7c6ff46130460571b510423))
* **memory:** 时间摘要批量异步进度与月年选择器 ([2d2b477](https://github.com/freeanima-org/freeanima/commit/2d2b4774680f83588bd843db987ac60132ed4e3f))
* **memory:** 时间摘要期结束后汇总与系统合摘要页 ([cf57e22](https://github.com/freeanima-org/freeanima/commit/cf57e22cfc8cf95074165af49cb627032ec52808))
* **memory:** 语义记忆向量聚类并按簇分批 reflect ([9194eb2](https://github.com/freeanima-org/freeanima/commit/9194eb2c066d86e13737d957959fd391235a923b))
* **memory:** 语义记忆页展示聚类族并支持筛选与全量校准 ([87ea287](https://github.com/freeanima-org/freeanima/commit/87ea287b6087e8465f880609cdf607bcaa0d385f))
* **note:** 新增笔记本模块 ECS 与壳入口 ([e05455a](https://github.com/freeanima-org/freeanima/commit/e05455a60e9a285515f6c3d1413e95ad66b80f23))
* **notification:** 可绕过失败按 CST 日双 Inbox 通知 ([2ce726f](https://github.com/freeanima-org/freeanima/commit/2ce726ffd804184ccf4a0597281a3bf7dde6fcc8))
* **object-storage:** 实体满期 purge 时按引用安全清理对象存储 ([fecd132](https://github.com/freeanima-org/freeanima/commit/fecd1324d0e97355bf6342758f20e0ab676c83e6))
* **pack:** 本机轨改为 local 并自动 stamp 版本 ([efbb742](https://github.com/freeanima-org/freeanima/commit/efbb7421c33ec09f32661f243492f0b1accbf4cf))
* **portal:** 浏览器入口改名为 FreeAnima 并更换 Firefox gecko id ([2e94fad](https://github.com/freeanima-org/freeanima/commit/2e94fadd98685617d29d0c931be60c86d0377e33))
* **prompt:** 按 conversations.module 区分工作与数字人类模式 ([475ed45](https://github.com/freeanima-org/freeanima/commit/475ed45aaf8e5892936eddc1d0c85826393946ef))
* **redis:** 下沉 core/redis 并接入分布式锁 ([a53198b](https://github.com/freeanima-org/freeanima/commit/a53198b7fa415e704b4014de9deec117a4558fa3))
* **search:** 检索索引迁至旁表并引入 SearchBackend ([3233521](https://github.com/freeanima-org/freeanima/commit/3233521084aecc1ca7905902f5c3fec2bc37a8e6))
* **subagent:** 子流式投影 live steps 并折叠显示最新子工具 title ([310b761](https://github.com/freeanima-org/freeanima/commit/310b761a686ebe4aa979077e08a1ca0ff4764ecd))
* **subagent:** 支持温度采样档位并打通 requestParams ([586aced](https://github.com/freeanima-org/freeanima/commit/586aced87a6d2a280fcfd5239810708635d05dee))
* **task:** 支持任务事件互转、邮件挂载与删除确认语义 ([bc417fd](https://github.com/freeanima-org/freeanima/commit/bc417fd26f173c580d810e7c4a10df115168c4fa))
* **task:** 支持滴答式重复任务与完成历史 ([16e4a07](https://github.com/freeanima-org/freeanima/commit/16e4a07abfde5bb393f7c84ba6428679c0e94f7d))
* **task:** 滴答 CSV 导入、时段多提醒与 RPC 超时三档 ([9081cec](https://github.com/freeanima-org/freeanima/commit/9081cecc9028e36b80cfad0aaa04f652fa0b63d7))
* **task:** 统一并突出任务优先级视觉 ([f6ee888](https://github.com/freeanima-org/freeanima/commit/f6ee888bd0be5a9a7f4b6ece99992c63ff92418d))
* **task:** 补齐提醒闭环、子任务、周历拖拽、假日农历重复与看板 ([92b4e64](https://github.com/freeanima-org/freeanima/commit/92b4e6435e158072d27ce1e0027b3e58f969e3d2))
* **temporal-summary:** 跳过占位、补跑缺失与截断放宽 ([dc4f9d4](https://github.com/freeanima-org/freeanima/commit/dc4f9d4e610ebda4f1df70f49db49404ff13d74a))
* **toolset:** 引入三级可见度并压缩系统提示目录 ([f95b4c4](https://github.com/freeanima-org/freeanima/commit/f95b4c4b23279c356e67d59a7a523740efc11027))
* **tools:** 支持会话级 toolset_unload ([70d1aad](https://github.com/freeanima-org/freeanima/commit/70d1aadd83ad54d7e4dad9e69d57378637b3227d))
* **ui-kit:** 常用模块个数改为 Slider ([8747718](https://github.com/freeanima-org/freeanima/commit/8747718defb9e65b09d196a72387f4a757e48d50))
* **ui-kit:** 日期选择改为 Calendar 并加快捷项 ([0a759df](https://github.com/freeanima-org/freeanima/commit/0a759dfbd4ce22871ddfc4e4d9497d2dee113fb6))
* **ui:** 实体主组件下拉与设置密钥明文展示 ([d5b62d1](https://github.com/freeanima-org/freeanima/commit/d5b62d1a7ccc351818fa7611d0324eea894eeb2e))
* **ui:** 统一自动保存的防抖与节流窗口 ([9980f9b](https://github.com/freeanima-org/freeanima/commit/9980f9b530daec86c13802572e6a8ab41133f82c))
* **ui:** 聊天顶栏朗读改用 Toggle 基元 ([76dfe14](https://github.com/freeanima-org/freeanima/commit/76dfe140ee81132ebc53668b9cffb76d8348e494))
* **update:** 修复壳更新进度并增加服务检查升级 ([899b32b](https://github.com/freeanima-org/freeanima/commit/899b32b17b07b5a58b735a74140c1fd1112adcca))
* **vault:** Agent 根密钥改由 User 库托管并可重建缓存 ([ae3bbef](https://github.com/freeanima-org/freeanima/commit/ae3bbeffcdffa64fa257511c978dcbced2f3eb84))
* **vault:** 增加 Vault 引用选择器并接入密钥 UI ([e076f9f](https://github.com/freeanima-org/freeanima/commit/e076f9f2d34b0fdf5f260dc231680157fadfa9b9))
* **vault:** 自动填充按最近使用排序并修复扩展 popup 样式 ([8dcf154](https://github.com/freeanima-org/freeanima/commit/8dcf15479227e6d83bca0bc28c66cf927ce2077a))


### Bug Fixes

* **calendar:** 收敛为时间入口并修复日界与任务打开 ([cafe37e](https://github.com/freeanima-org/freeanima/commit/cafe37e1c550f0472b6cc610bb330341e5c4db74))
* **calendar:** 日程 range 不再展示已完成与搁置项目 ([0110fee](https://github.com/freeanima-org/freeanima/commit/0110fee298e18bd9c72aee287dfdff3e4038b243))
* **chat:** 修复删除未读会话后角标与列表不同步 ([177832f](https://github.com/freeanima-org/freeanima/commit/177832f97647b9479a9f59a7c8c70d811731dbb2))
* **chat:** 修复键盘弹起后输入与键盘间透明空隙 ([0989acb](https://github.com/freeanima-org/freeanima/commit/0989acbdfea15c20ee7e52725b5239d7e830c54d))
* **chat:** 回合中断后展示【继续】并支持从当前链续跑 ([15351a6](https://github.com/freeanima-org/freeanima/commit/15351a63779a42be91e2da177889cafa1b6c366f))
* **chat:** 工具活动条标题改为变更时纵向滚入 ([a5d0d18](https://github.com/freeanima-org/freeanima/commit/a5d0d18636b465d87cea9b9fca707be732d2aae7))
* **chat:** 延后系统提示拼装并按粒度缓存 sys_roll ([122bbf6](https://github.com/freeanima-org/freeanima/commit/122bbf602a7e190df81bf1e9be0f04f30aef51cb))
* **chat:** 流错误后应展示错误而非卡在撰写中 ([c449d09](https://github.com/freeanima-org/freeanima/commit/c449d09bbb4dee82c861755e7df37a52cc0706cd))
* **ci:** 修复 canary 扩展与 Android 打包失败 ([cf625b6](https://github.com/freeanima-org/freeanima/commit/cf625b6f90629186d3e39e31ce7e3bf796c0261b))
* **cli:** standalone 关闭 bunfig autoload ([3559d31](https://github.com/freeanima-org/freeanima/commit/3559d316274baa6670ec08c72036e5ad5154d171))
* **cli:** 修正 web dist 的 dir: 路径并强制仓内占位 ([f639aba](https://github.com/freeanima-org/freeanima/commit/f639aba278e5350305be9c5a5e71e154de401766))
* **coding:** terminal_run 支持引号内空格的 argv 拆分 ([ac4108e](https://github.com/freeanima-org/freeanima/commit/ac4108e1572432686311061f1f90ac60b3525e90))
* **coding:** 阻止 domain barrel 把 jieba 泄入 SPA ([2f7fcfc](https://github.com/freeanima-org/freeanima/commit/2f7fcfc8bbd1d55ac225e5a3e3fe623725076630))
* **compress:** 摘要与预算不再读取会话 meta.model ([05edc3d](https://github.com/freeanima-org/freeanima/commit/05edc3d912ec55686137c33aaccb4e6ffc1e9255))
* **config:** isolate PG-dependent world-context to prevent bun leaking into Vite deps scan ([103741c](https://github.com/freeanima-org/freeanima/commit/103741cf1bcc56d07f490198ea3400dd4cfd9606))
* **db:** 兼容并迁移遗留 cached_toolsets 对象数组 ([e946ce0](https://github.com/freeanima-org/freeanima/commit/e946ce0a19bee234500c1ddfdc5d8ad49b79caa7))
* **db:** 将 max(pos) 聚合强制 ::int 避免 BigInt 相加崩溃 ([5742fb9](https://github.com/freeanima-org/freeanima/commit/5742fb92acfe9a9c27c8367dda3b3463b6cef4b4))
* **email:** 点开未读邮件后延迟刷新列表 ([383d142](https://github.com/freeanima-org/freeanima/commit/383d142d065ca8ced8facbc4b4c638eb846e8ff9))
* **email:** 避免自发送在已发送箱出现双份副本 ([1ca4efa](https://github.com/freeanima-org/freeanima/commit/1ca4efa897a83925618813af9f99337162a28ff4))
* **embedding:** 元数据更新不再清向量重嵌 ([79d58e5](https://github.com/freeanima-org/freeanima/commit/79d58e52e73bba25f67fc2c6d68443ce1f1172cc))
* **entity:** user 可读 agent world 实体并补列表预览 ([a16293a](https://github.com/freeanima-org/freeanima/commit/a16293a06129ecf8cec0724330a0a77a1f70dda2))
* **extension:** 修正迁包后 tsconfig 相对路径 ([6873494](https://github.com/freeanima-org/freeanima/commit/6873494ae46297bc2a96f288612c6701b31b9644))
* **extension:** 已有凭证跳过保存提示并支持离线只读 ([ad7c517](https://github.com/freeanima-org/freeanima/commit/ad7c51795592fc193036df7a70640db87b400251))
* **extension:** 跨平台 zip 打包并修复 SW hydrate 误锁 ([bc8399f](https://github.com/freeanima-org/freeanima/commit/bc8399f5e00fdfba8f0cc18ee1392be08b5e11db))
* **fts:** 嵌入 jieba 词典并回退中文问句整句零召回 ([71062ca](https://github.com/freeanima-org/freeanima/commit/71062cacebbc32945cbcc505cd979207cae61ed7))
* **habitat:** 顶栏与测试连接对齐 WebView 可达性 ([24f9050](https://github.com/freeanima-org/freeanima/commit/24f905051bb4d7ffc5ca99b5807932bc0c54df23))
* **layers:** gen 后 oxfmt，避免 pg-shapes 漂移误报 ([8b6f6a0](https://github.com/freeanima-org/freeanima/commit/8b6f6a0ed33636dda941b7d454474ab186dd1c18))
* **llm:** 修正 max_tokens 超限并理顺配置与压缩窗口 ([d888304](https://github.com/freeanima-org/freeanima/commit/d888304f1f2ac753a2348f4286e26a3456996423))
* **memory:** retain 收尾总结并按消息分侧召回 ([7797f18](https://github.com/freeanima-org/freeanima/commit/7797f18eaf92ec88ab8064fe530435f0480f49aa))
* **memory:** 修复时间摘要漏统并增加强制重跑 ([075b8fd](https://github.com/freeanima-org/freeanima/commit/075b8fd7ba348679c95d85d7770b3efec72cd21d))
* **memory:** 兼容遗留 sap: platform，修复时间摘要补全失败 ([7450523](https://github.com/freeanima-org/freeanima/commit/74505235675d09c80ba43f93934f47f67c0ee2be))
* **memory:** 同伴合摘要不在对话热路径打 LLM ([a9ecd69](https://github.com/freeanima-org/freeanima/commit/a9ecd697a0fbc9081a3bc6809ada76132ec488ca))
* **memory:** 恢复 acp_tasks 遗留 agent 键读路径归一化 ([31f4782](https://github.com/freeanima-org/freeanima/commit/31f478284227c5d45f96b12fa0a2c2bce7147258))
* **memory:** 按消息活动触发时间摘要并收紧 /summarize 写回 ([8ab2738](https://github.com/freeanima-org/freeanima/commit/8ab27383db35f75fa77c8a9ad753cdc71eae57d4))
* **memory:** 提升被动召回精度（实词 FTS + 向量 boost） ([03ff9e6](https://github.com/freeanima-org/freeanima/commit/03ff9e605a6653ec33272e33f532d97b370941c0))
* **object-storage:** 换字节与创建失败时释放无引用 blob ([57d61c5](https://github.com/freeanima-org/freeanima/commit/57d61c5b4c1f2389b586210969914748f1d6b311))
* **redis:** 连接失败降级锁并隔离 migrate 键 ([6ad6287](https://github.com/freeanima-org/freeanima/commit/6ad62874950e81beb72fcbb4e1e493d79a58993a))
* **repo:** 对齐三分包后的测试与工具链路径 ([cdf2c03](https://github.com/freeanima-org/freeanima/commit/cdf2c03f3bc14bf9715854e5db87e0707d5e9814))
* **site:** 补齐 Astro 类型引用以修复 CI oxlint ([7375d15](https://github.com/freeanima-org/freeanima/commit/7375d1537619863b95ddae70c12352269fdb6162))
* **speech:** 流式自动朗读预取与中途开启游标 ([e6ecb6a](https://github.com/freeanima-org/freeanima/commit/e6ecb6a80dca493251a4d9602951e7e8193c6002))
* **speech:** 隔离 MediaSource mock 并处理 ended 竞态 ([70ddf12](https://github.com/freeanima-org/freeanima/commit/70ddf12d26a94cbfe0ba770da3305b0d6ffca65a))
* **tag:** 修复标签选择器空白并固定可搜弹出层高度 ([c1e9ede](https://github.com/freeanima-org/freeanima/commit/c1e9ede95cbe7a04c048dd8511115da2f0554bb6))
* **task:** 为滴答导入 Tabs 回调补 Key 类型 ([03b519f](https://github.com/freeanima-org/freeanima/commit/03b519f3b5dbdb83130a8286827eba1f9b358654))
* **task:** 修复重复面板空白并支持每月农历 ([06e1900](https://github.com/freeanima-org/freeanima/commit/06e1900c1b831c7543e58eacd9bc8e1f0ea033cb))
* **task:** 修正归档检查参数类型以通过 exactOptionalPropertyTypes ([73bc46f](https://github.com/freeanima-org/freeanima/commit/73bc46ffd71df0e1e7af314dc703b81fac6bfbf1))
* **task:** 归档清单上完成/跳过任务应拒绝 ([8ab8120](https://github.com/freeanima-org/freeanima/commit/8ab81208799af168df65c4660ec3b0585785d311))
* **task:** 无日期则禁止重复与提醒，并修复日历重复展开 ([0590868](https://github.com/freeanima-org/freeanima/commit/0590868ea83781fb2217fff52e6e81a6e3118f20))
* **tauri:** 修复 Windows 检查更新后安装卡死 ([44fcb1b](https://github.com/freeanima-org/freeanima/commit/44fcb1b337b63751b93560893d6135c7cbcc402e))
* **tauri:** 登记 apk-installer ACL 以修复手机应用更新 ([a45f45c](https://github.com/freeanima-org/freeanima/commit/a45f45ca2ebe176cdf8ea3850bb8b1ca609b5065))
* **test:** task_create 提醒用例补 due_at ([b383dff](https://github.com/freeanima-org/freeanima/commit/b383dff891ae26031984350c0150dcebdf5095aa))
* **test:** 修复 CI mock.module 写穿与 platform 用例 ([e513b8f](https://github.com/freeanima-org/freeanima/commit/e513b8f1e555d2c6b55c5593870cf69ae20d31b0))
* **test:** 加固 speech mock this 绑定与 prime 断言 ([40330ab](https://github.com/freeanima-org/freeanima/commit/40330ab9dee5af8d220bdb4bf4ffdd94a0abfa3c))
* **test:** 未读 COUNT 用例改用合法 remote companion platform ([613db05](https://github.com/freeanima-org/freeanima/commit/613db0534a4483ff757c48a3f99c55d3f0ea6da7))
* **test:** 消除 mock.module 部分 stub 对同进程单测的污染 ([ea80c05](https://github.com/freeanima-org/freeanima/commit/ea80c05a0f6b44ab2c099c7ab1566d78d3304039))
* **test:** 清除 item-ownership 测试中误入的 cherry-pick 冲突标记 ([8931a95](https://github.com/freeanima-org/freeanima/commit/8931a954f2ab0fe9504f2db66a333f418b4ff55a))
* **test:** 集成 teardown 放弃挂起压缩摘要避免 hook 超时 ([777a305](https://github.com/freeanima-org/freeanima/commit/777a305c0600c97887d9e74b80f833c0a9028016))
* **ui-kit:** fix Dialog layout — force single-column grid on DialogPrimitive ([e94910c](https://github.com/freeanima-org/freeanima/commit/e94910cdb0019804e8ea94987c4a5cb75429906d))
* **ui-kit:** raise ModalSheetPresent dialog max-height from 32rem to 48rem ([d3792d0](https://github.com/freeanima-org/freeanima/commit/d3792d0ea877983074cc0f0b4778f6c920013ee7))
* **ui:** 为 Tabs onSelectionChange 回调补 Key 类型 ([05884c0](https://github.com/freeanima-org/freeanima/commit/05884c0f0a6bca09b92b365ead7cded2d89423bc))
* **ui:** 修复手机端日记/任务详情软键盘双弹 ([f695fec](https://github.com/freeanima-org/freeanima/commit/f695fecf6166486e11d0e68c41d411a8b632d37b))
* **ui:** 列表弹窗固定高度并区内滚动 ([a6d62de](https://github.com/freeanima-org/freeanima/commit/a6d62deeb76105f7072c49084ebaf3d1c8a9d37d))
* **vault:** User 库解锁时自动确保 Agent 根密钥 SSOT ([c7d76c9](https://github.com/freeanima-org/freeanima/commit/c7d76c9625b2a85026faf6126db09c2b6f3d53ed))
* **vault:** 收紧扩展凭据浮层并改 Habitat 日期为选择器 ([9658c53](https://github.com/freeanima-org/freeanima/commit/9658c538e9457a1519db463226836cfa15496ffe))


### Documentation

* **product:** 落盘 src 分层方向与三分包路线图 ([a1772bf](https://github.com/freeanima-org/freeanima/commit/a1772bf89f9e3cdab03a716903fbf478d68bb8d2))


### Miscellaneous

* **config:** 移除已弃用的 PATHS 与无效 tunnel 告警 ([025320a](https://github.com/freeanima-org/freeanima/commit/025320aa45a9f98582c8abfc12ec3123da1fd7f5))
* **cursor:** 自动验收技能对齐风巢 MCP 新名称 ([333a76f](https://github.com/freeanima-org/freeanima/commit/333a76f6a0569693ea6375d65a8febe57c047145))
* **deps-dev:** bump the dev-dependencies group across 1 directory with 11 updates ([60c5dfd](https://github.com/freeanima-org/freeanima/commit/60c5dfd3a3176a8ec79f8e12052f464ae4cfa42c))
* **deps:** bump the production-dependencies group across 1 directory with 22 updates ([c92f13d](https://github.com/freeanima-org/freeanima/commit/c92f13d883191af4cfe0c379f4d9a4941750ef6f))
* **install:** 恢复可移植 bun.lock 并默认 frozen-lockfile ([64cc540](https://github.com/freeanima-org/freeanima/commit/64cc5409a8408b1b54be3b4e49ad3a167b3cf00e))
* **lint:** 继续收紧 type-aware 规则并对齐 CI ([a6d0c22](https://github.com/freeanima-org/freeanima/commit/a6d0c223cea19940298f2d79084d14aadfeb8661))
* **memory:** 移除 MEMORY.md/USER.md 遗留 RPC 与 status 字段 ([797d6ad](https://github.com/freeanima-org/freeanima/commit/797d6ad5057883dfa2afd0fb02b1880b636f85cd))


### Refactoring

* **chat:** 抽出 ConversationTranscript 供 Chat 与 Coding 共用 ([0e8aab3](https://github.com/freeanima-org/freeanima/commit/0e8aab3ed9fad748c93744f7e3c6789d749b7d42))
* **cli:** docs 经 dir: 嵌入，收缩 standalone embeds 清单 ([5775eff](https://github.com/freeanima-org/freeanima/commit/5775effb6d42a418ced5279c2fb2b0a5813674a4))
* **cli:** migrations 经 dir: 嵌入，并将 bunx 统一为 bun x ([ff3bed8](https://github.com/freeanima-org/freeanima/commit/ff3bed84d69225678273e1d5b0ac31bba53e8b4f))
* **cli:** web dist 经 dir: 嵌入，standalone-embed 仅注入 meta ([44e6667](https://github.com/freeanima-org/freeanima/commit/44e66672ba5148d31de30249809d60dcc8408904))
* **cli:** 用 Bun.build files 注入 meta，源码 CLI 懒加载 dir: ([1c1c354](https://github.com/freeanima-org/freeanima/commit/1c1c35487fabf4aaec00b8b2e4baf052c66c76f7))
* **companion:** 移除 FBX 与动作包 zip 导入 ([6557bf4](https://github.com/freeanima-org/freeanima/commit/6557bf423c74d727fb2e15e714c66cf7159248fa))
* **cron:** 将 email-sync-all 迁为进程内 builtin ([7a23bb3](https://github.com/freeanima-org/freeanima/commit/7a23bb355afe0e15db3707d265a34c303d769972))
* **cursor:** 以 .cursor/rules 取代 AGENTS.md 与 .agent/rules ([504566a](https://github.com/freeanima-org/freeanima/commit/504566a91984182562585f9d6e39b03aae3170f4))
* **db:** 将 conversation_meta 从 StoredMessage union 拆出 ([1312e40](https://github.com/freeanima-org/freeanima/commit/1312e40435c014a6b52de3b5d42e84d0c6cd8d73))
* **engine:** 将 agent loop 的会话假设改为 opts 注入 ([b11d9b9](https://github.com/freeanima-org/freeanima/commit/b11d9b9b05ae08803cbad890f5164680c5f9fb74))
* **habitat:** AutoLlm 四层提示组装并迁移调用方 ([757ba4c](https://github.com/freeanima-org/freeanima/commit/757ba4c05731d0aeeb9c6a5c405555d94d99bb21))
* **hooks:** 删除未接线的 EventBus 整栈与死 hook ([ff90c9e](https://github.com/freeanima-org/freeanima/commit/ff90c9eff573abbc8c568331b33e6d41c44c65e8))
* **host/config:** split Node-only imports out of config barrel ([24a5ddc](https://github.com/freeanima-org/freeanima/commit/24a5ddc402849bd7fb8c6abfb2fcc3c3356d2eca))
* **kernel:** 将 config 机制迁入 config-mechanism ([58b2b5b](https://github.com/freeanima-org/freeanima/commit/58b2b5be0353aea251680527acdf08852a801e0d))
* **layers:** codegen 替代 createSelectSchema 出口 pg-shapes ([2c9eb50](https://github.com/freeanima-org/freeanima/commit/2c9eb5096e8619e9a0d050cee2eafd4491252af3))
* **layers:** 剪断 shared→host 与 frontend→db ([779337f](https://github.com/freeanima-org/freeanima/commit/779337f318664da29672ef745dcd91412f5c5b60))
* **lint:** 将仓库护栏迁入 oxlint jsPlugins ([723145a](https://github.com/freeanima-org/freeanima/commit/723145a41d51387fb5d052d388b413c61a270343))
* **memory:** 拆除 limbic/dream/narrative 写路径并去掉 park ([6f0bc98](https://github.com/freeanima-org/freeanima/commit/6f0bc98d0a39bc7884d06fe8de60b34a3d78c1c2))
* **memory:** 记忆维护脱离 DAG 并改名为 memoryMaintenance ([7805957](https://github.com/freeanima-org/freeanima/commit/7805957851d0d9ff71ee4bda8d3cef9547142189))
* **prompt:** 系统提示与旁注改用 XML 外壳划界 ([c588e26](https://github.com/freeanima-org/freeanima/commit/c588e26d65b90b742cf12214e39cc65a8216a905))
* **repo:** 落地 P5 shared/habitat/frontend 三分包 ([5df82b4](https://github.com/freeanima-org/freeanima/commit/5df82b47bc239f63aa71329055813489b37c91ac))
* **toolset:** 合并内置 ToolSet 并提高目录信息密度 ([e305ec8](https://github.com/freeanima-org/freeanima/commit/e305ec8c1cfd17fb300829f4a2fd39193e9d2adb))
* 将 dir: 插件抽至 bun-plugin-dir-import ([25c3014](https://github.com/freeanima-org/freeanima/commit/25c3014104c5edde1105b3cd8ee07b03d4b542d8))
* 拆除 i18n，产品与文档全面改回中文 ([bbfbddc](https://github.com/freeanima-org/freeanima/commit/bbfbddc16ce19647782e4847e16ca5e31cc5f438))
* 清理弃用依赖别名并归一遗留配置 ([b3c6a8d](https://github.com/freeanima-org/freeanima/commit/b3c6a8d13f16aedc7f15d0bda234c52bf557304e))
* 统一回合/引擎轮/工具轮次术语并迁移字段 ([a72dca9](https://github.com/freeanima-org/freeanima/commit/a72dca9541c3f81144d4c937a44bd746b840d1b0))


### Tests

* **email:** 消除 softDelete 并行 mock 污染 ([d8152cf](https://github.com/freeanima-org/freeanima/commit/d8152cf3bb3bb2b0ef3283d6c20c7afd6f7fddb4))
* **email:** 附件存储改用 setForTest 注入避免 mock.module 串扰 ([7cbe99c](https://github.com/freeanima-org/freeanima/commit/7cbe99c114249c7ab02360c5422f378b0ebb20f5))
* **memory:** 补全 system-rolls mock 的指令导出 ([fba45c9](https://github.com/freeanima-org/freeanima/commit/fba45c96a6c7a50c1ec3d4d0f1d23f26d774af0a))
* 对齐 park 默认与 PROFILE_CHAT 预算的集成断言 ([d48d2c8](https://github.com/freeanima-org/freeanima/commit/d48d2c865898986d163cea53e4a3860975e77460))
* 对齐延后系统提示、content ToolSet 与压缩 catalog 回退 ([8fb9963](https://github.com/freeanima-org/freeanima/commit/8fb996350c0fdda23e38b8c69a530bfc943f97aa))
* 引入 core/enhanced 分层与 pre-push 门禁 ([f9cd9ef](https://github.com/freeanima-org/freeanima/commit/f9cd9ef68494b61c1a21a7461368d7d6529e71b6))


### CI

* **test:** 集成测试与文档改用 pgvector/pgvector:pg18 ([5516096](https://github.com/freeanima-org/freeanima/commit/551609644bd4f3deff3496623c02764c7b849580))

## [0.10.1](https://github.com/freeanima-org/freeanima/compare/v0.10.0...v0.10.1) (2026-07-31)


### Features

* **email:** 新邮件通知携带 from 与 message_id ([db73cc0](https://github.com/freeanima-org/freeanima/commit/db73cc0169ecc830c5ebdec82443150395fb1f63))
* **host:** 落地 Context Engineering 脊柱（大输出再取 + 提示预算） ([041a06e](https://github.com/freeanima-org/freeanima/commit/041a06efcc351459e3da098bf69bc6d71fa325a8))
* **portal:** 落地 PortalQueryClient 并统一入口数据切面 DX ([9f66a01](https://github.com/freeanima-org/freeanima/commit/9f66a016fef199cfd3bde5c07df821f3607f2906))
* **self:** 自我层慢维护提议与自传栈下线 ([9b2cd9d](https://github.com/freeanima-org/freeanima/commit/9b2cd9d3cd95b91797f88ffb9f019776de408b8e))
* **settings:** 局域网 TLS 证书改为按钮触发弹窗 ([f7ea79d](https://github.com/freeanima-org/freeanima/commit/f7ea79db7a473e93871b739c0f9449bc4d172d3b))
* **subagent:** 落地内部 subagent 并移除 ACP ([acc649e](https://github.com/freeanima-org/freeanima/commit/acc649ef31e52794454fff76c7a85fd33743cd26))
* **tools:** 本地工具强制 _title 调用意图供 UI 展示 ([b650820](https://github.com/freeanima-org/freeanima/commit/b6508206fad6b9e62ced817d8dd81a238c56eb69))
* **vault:** 扩展与壳共用 ui-kit 编辑表单并修中文搜索 ([10bfa95](https://github.com/freeanima-org/freeanima/commit/10bfa958af1be0630dadb844455b0198b00c6a80))


### Bug Fixes

* **ci:** canary 发布前清空滚动 Release 旧资产 ([bba5aa6](https://github.com/freeanima-org/freeanima/commit/bba5aa698771346ccd0fdf02ae2610a6b0244f5a))
* **companion:** 切模清场与正交描边，并修 Windows exactOptional 类型 ([937bee9](https://github.com/freeanima-org/freeanima/commit/937bee9bdbb6da3c2ddef57c0f4169207d47d672))
* **companion:** 模型切换清场、关显示离线，二进制传输默认 10 分钟超时 ([034425a](https://github.com/freeanima-org/freeanima/commit/034425ae392259b6fb51685941ca27bd07cecadd))
* **compression:** 避免 patch meta 时误清空摘要边界 ([ec0a455](https://github.com/freeanima-org/freeanima/commit/ec0a455e38d86fb6f68c40faacf28d269b9326d9))
* **dev:** Habitat 启动失败时不启动 Web ([4365eb4](https://github.com/freeanima-org/freeanima/commit/4365eb487f43830c1232ef21f5f1765ea0fd8255))
* **portal:** 修复 usePortalRead 列表刷屏死循环 ([7e256b4](https://github.com/freeanima-org/freeanima/commit/7e256b4a27e4d38c0c759b11927fd0dcd6ab6153))
* **test:** 修复 Windows 单元测试路径策略与夹具 ([84dd300](https://github.com/freeanima-org/freeanima/commit/84dd300cc824ef03ce779aff92db159725c0bbcd))
* **ui-kit:** 为 ContextMenu PopoverContext Consumer 标注类型 ([7e2e078](https://github.com/freeanima-org/freeanima/commit/7e2e078e56e59534e0353abf75513a33e725053d))


### Documentation

* **agents:** 明确正确路径优先于最小 diff ([3b7c654](https://github.com/freeanima-org/freeanima/commit/3b7c654582f7206203e80cb8125bc67beedb651d))
* **ops:** 补充 Windows 源码开发指引并跨平台化 just dev ([dfce0f1](https://github.com/freeanima-org/freeanima/commit/dfce0f12cf7b76957c5a37f56e976f58c4110be7))


### Miscellaneous

* 统一文本换行为 LF（.gitattributes） ([e840430](https://github.com/freeanima-org/freeanima/commit/e840430a2ab0a797d3286813ab75e5e30131adf1))


### Refactoring

* **auto-llm:** 侧车 LLM 统一落库并记录 messages ([2b4acc5](https://github.com/freeanima-org/freeanima/commit/2b4acc5d43f35edec77965df781e594b586d6870))
* **email:** 调整邮箱工具栏布局 ([3da3e96](https://github.com/freeanima-org/freeanima/commit/3da3e96911a37fe7d1998da0eeca071bcc8d27cb))
* **entity:** 统一标签字段为顶层 tag_ids ([927e8bd](https://github.com/freeanima-org/freeanima/commit/927e8bdf3e4b1f97fdfe7ca4b142361f0c3e74b3))
* **hooks:** 统一 on/subscribe 实时派发并移除生产 EventBus 队列 ([28b42a8](https://github.com/freeanima-org/freeanima/commit/28b42a8d37d94d4e48f51695622235383c140fd4))
* **ui-kit:** 将 shadcn 底层从 Radix 换为 React Aria ([78a9a1b](https://github.com/freeanima-org/freeanima/commit/78a9a1ba672d56c382a5eaadcde4e82c2cc28ed6))
* **ui:** 优先社区方案降维护成本 ([a08dc1f](https://github.com/freeanima-org/freeanima/commit/a08dc1f81058206a93903672febca24d0be13ade))
* **ui:** 统一列表行与交互模式到 ListRow ([864d4d4](https://github.com/freeanima-org/freeanima/commit/864d4d402524e31cf81d7e2f7b54089f76f7b0f2))

## [0.10.0](https://github.com/freeanima-org/freeanima/compare/v0.9.3...v0.10.0) (2026-07-29)


### ⚠ BREAKING CHANGES

* 包路径与目录布局变更（原 platform/frontend 等）。
* 移除 config.yaml web.* 与 anima web / anima vault 子命令。

### Features

* **alert:** 本机提醒优先伴侣气泡，覆盖聊天/收件箱/番茄钟 ([0db53fc](https://github.com/freeanima-org/freeanima/commit/0db53fc00231ba966303d5e7c0c6823cfed2685c))
* **companion:** 全屏 WebGL 舞台与正交屏内定位 ([7b2fdf9](https://github.com/freeanima-org/freeanima/commit/7b2fdf9892db290c5c0df6f14d6b92dbc7e7a802))
* **email:** 多箱同步、批量操作与跨 world 定时新邮件通知 ([5fccb0d](https://github.com/freeanima-org/freeanima/commit/5fccb0ddf94e1433f7e3a6c10200bf079f5380c9))
* **entity:** 软删、组件删除语义与 Entity 回收站模块 ([5355d3a](https://github.com/freeanima-org/freeanima/commit/5355d3a37dc3361c93b1e61e8015fc8ca2c5234f))
* **extension:** Vault 扩展会话、编辑与图标 ([1be468b](https://github.com/freeanima-org/freeanima/commit/1be468bb2f1f7e1f74edffdf6387e2e26cd622ff))
* **memory:** 时间摘要高度压缩并告警 system 截断 ([589e015](https://github.com/freeanima-org/freeanima/commit/589e015919720e0b15c55fd3ba43b59e690605ad))
* **object-storage:** 对象存储 SSOT，并落地 companion 配置 v2 ([5995ca7](https://github.com/freeanima-org/freeanima/commit/5995ca780c029086fee5978ef7436c3514a65ec1))
* **portal:** 四入口形态目录与 Vault 浏览器扩展 ([db3e234](https://github.com/freeanima-org/freeanima/commit/db3e234e178f94e70f0806192d93a0c6e8a77fa7))
* **shell:** 通知与聊天导航未读角标及应用图标 Attention ([da09a11](https://github.com/freeanima-org/freeanima/commit/da09a11d0730765e5cccc2c2c64ca9238b5acca3))
* **skills:** Skills ECS 与 CapabilityPolicy，退役能力面罩 ([7b0b2c4](https://github.com/freeanima-org/freeanima/commit/7b0b2c490096a32d52fb94a01332abfdddd74692))
* **skills:** 技能自进化旁路与元技能 skill-curation ([699cae7](https://github.com/freeanima-org/freeanima/commit/699cae77129ffa5131c84fdc700e6efd63bf6c8f))
* **sleep:** Habitat 一键补睡眠，并解耦 cascade/ref-sync 对深睡的依赖 ([160a95c](https://github.com/freeanima-org/freeanima/commit/160a95c9673f99f12104d789b95137fc4e0373fc))
* **sleep:** 定时深睡改为每周一，并区分 auto_llm runName ([4107096](https://github.com/freeanima-org/freeanima/commit/4107096883e406c3378bd5d0e2c619a106f45369))
* **task:** compact 任务详情支持全屏编辑页 ([9eb6cff](https://github.com/freeanima-org/freeanima/commit/9eb6cffcc04b92ad426c8e86e9ae3b34e438ef31))
* **tauri:** 隔离 dev 壳身份与数据目录，并双写带版本的 pack 产物名 ([f35bb94](https://github.com/freeanima-org/freeanima/commit/f35bb94eaafbf8aa4bf01ff76a47b80073f577fd))
* **tls:** 可选 Let's Encrypt HTTP-01，保留局域网 mkcert ([114036a](https://github.com/freeanima-org/freeanima/commit/114036ae354c255eb590c2a21940c0655d22ed46))
* **tools:** 增加 Habitat 运维 ToolSet ops ([ab60f5a](https://github.com/freeanima-org/freeanima/commit/ab60f5aa3f784523ce62a29b9b18b02b73a21e1e))
* **vault:** 实体 revisions 与凭证历史回滚 ([a5a6180](https://github.com/freeanima-org/freeanima/commit/a5a61808a43f4b285af7d193781e9f4d549ced50))
* 去掉 bootstrap web 配置与 anima web/vault 子命令 ([8fc0ce9](https://github.com/freeanima-org/freeanima/commit/8fc0ce953d794dbbc68dcdacc67a824ec66015fa))


### Bug Fixes

* **browser:** 对齐 Camofox profile 默认值并补充说明 ([433ea3e](https://github.com/freeanima-org/freeanima/commit/433ea3e272c06ad026de0d8a9d3787b0db92ed18))
* **ci:** 修复 Quality 挂死与 createServiceKernel ZodError ([0d14704](https://github.com/freeanima-org/freeanima/commit/0d1470403c29f139693f7b91c9245fe0e9070bb7))
* **companion:** 上传走统一 Habitat client 并清除 sidecar 遗留命名 ([38d3491](https://github.com/freeanima-org/freeanima/commit/38d3491bb5b87a18331432f294cc7c915633b352))
* **companion:** 用 https 伪 URL 作 Cache API key ([17183ab](https://github.com/freeanima-org/freeanima/commit/17183abc2087713251145f5f5a3f4fb8be0a4927))
* **companion:** 跨窗广播配置变更到 overlay ([bdef4c2](https://github.com/freeanima-org/freeanima/commit/bdef4c26b582380beac1291957631dd08b6c4c0c))
* **cron:** 内置调度改进程内 Bun.cron 并修复 Inbox 推送丢失 ([741a9be](https://github.com/freeanima-org/freeanima/commit/741a9be05f8737087f48ad26efccf1a627a6b215))
* **diary:** 列表刷新不再清空本地日记块缓存 ([8829a0a](https://github.com/freeanima-org/freeanima/commit/8829a0a261adf50cc1bccb27bc0493f462239c3f))
* **docs:** 重命名 tools/object_storage 避免 po4a master 冲突 ([1749481](https://github.com/freeanima-org/freeanima/commit/1749481cadbb73a819bf49ca3e1c5882607ed29d))
* **email:** 缺 account_id 时按 subject_kind 解析发信 world ([cbd3124](https://github.com/freeanima-org/freeanima/commit/cbd312468982a51da50e0ce17dce6a9377e39b05))
* **llm:** 一次性 completion 显式 tool_choice none ([7c5d4af](https://github.com/freeanima-org/freeanima/commit/7c5d4af70eeb2fe2395d9d9ef9205b2c88d3b129))
* **memory:** 浅睡情绪抽取仅用当日消息，避免过去情绪反复写入 ([5fdeb0c](https://github.com/freeanima-org/freeanima/commit/5fdeb0cb8e918cc73a818ded369a59ea036256e2))
* **mobile:** 恢复 canary 版本写入并修复 APK 更新进度 ([148bb6a](https://github.com/freeanima-org/freeanima/commit/148bb6a8669f3f779d3bf10ab5ff26bb96f9508e))
* **notification:** 按 World 路由邮件/任务通知并强制 subject_kind ([9c5d143](https://github.com/freeanima-org/freeanima/commit/9c5d14380084d6ae9770abb0f555b105458d9bdf))
* **outpost:** 远程工具改为注册时绑定连接通道 ([f949303](https://github.com/freeanima-org/freeanima/commit/f9493036b3e94db6d33178172fc0bfe5c2d01411))
* **portal:** 修复 Android 本机 Alert 权限与优先横幅 ([d21379a](https://github.com/freeanima-org/freeanima/commit/d21379a2be0957a4764c1bdd827066451c850c64))
* **portal:** 桌面通知/角标/托盘与对象存储错误文案 ([6011b01](https://github.com/freeanima-org/freeanima/commit/6011b01ef564b6d88d441ceccc42cb1ecf20ac3b))
* **remote-tools:** 允许跨对话调用已注册前哨工具 ([1e582aa](https://github.com/freeanima-org/freeanima/commit/1e582aa1947c9a201c85a98f6e6e7d3114547e41))
* **security:** 自动化场景默认禁止所有工具 ([cc3375b](https://github.com/freeanima-org/freeanima/commit/cc3375bb40cccee0e34e1a7f43b613b803ceac45))
* **site:** 修复文档站构建的 po4a master 冲突与 Paraglide site 接线 ([996b94b](https://github.com/freeanima-org/freeanima/commit/996b94bc3d250c98e5d2cdf6dde3866eeddb28ae))
* **standalone:** 随包资源改 Bun 嵌入，修复 compile 后 ENOENT ([38bc8ec](https://github.com/freeanima-org/freeanima/commit/38bc8ec80ef9c5b2ab073d90dec5cfbf1c1075d4))
* **tag:** 修复常用标签 suggest 计数并改进 TagPicker 导航 ([d075331](https://github.com/freeanima-org/freeanima/commit/d075331423cf0ad521425dd95425410fd799f0a8))
* **tauri:** 修复自启幂等、无模型穿透与托盘退出 ([ffa78ad](https://github.com/freeanima-org/freeanima/commit/ffa78ad13865a38cd6e6ee9c0a53574420ecf524))
* **tauri:** 原生 HTTP 使用系统 CA 以支持 mkcert HTTPS ([8a4c44f](https://github.com/freeanima-org/freeanima/commit/8a4c44fe723f6588f6b03f329b419724f8dbe829))
* **tauri:** 去掉 NSIS 匹配中的非空断言 ([c03c14f](https://github.com/freeanima-org/freeanima/commit/c03c14fdd3554920b7237c74fcfe3f9d5eba5e6e))
* **tauri:** 按 Cargo 包名解析 Android gen 模块路径 ([90b92a7](https://github.com/freeanima-org/freeanima/commit/90b92a757cf50b9727cca8f3518b683b32ec05db))
* **tauri:** 按 productName 选取 NSIS，并补齐 dev 品牌标识 ([cbef9d5](https://github.com/freeanima-org/freeanima/commit/cbef9d5fe49d3b8698b81e22a16476d162cc78a9))
* **test:** 补齐 subject_kind 并更新 companion 上传用例 ([d9f2c64](https://github.com/freeanima-org/freeanima/commit/d9f2c64ad70a39ad8d55b2eb6e00d312855c1424))


### Documentation

* **aspects:** 新增 Portal 数据面并迁入离线/刷新文档 ([925c5d7](https://github.com/freeanima-org/freeanima/commit/925c5d7c3ae065a94c176d7d4f3f236c3d96ccda))
* **ui:** 新增 UI/UX 设计规范目录并收薄 agent rules ([7d3d044](https://github.com/freeanima-org/freeanima/commit/7d3d044d7b7ac7c2b82c80feec8f8c529b571587))
* 清理根目录 bun run 残留并转发集成测试路径 ([6745a05](https://github.com/freeanima-org/freeanima/commit/6745a05e29d2015015b34388b1b5b85adfc61db3))
* 重组文档五档并重命名 freeanima_docs ToolSet ([c66972e](https://github.com/freeanima-org/freeanima/commit/c66972e5f8907a82746228e1b5b2ceaa45b3eb55))


### Miscellaneous

* **deps:** bump actions/cache from 4 to 6 in the github-actions group ([71a53fc](https://github.com/freeanima-org/freeanima/commit/71a53fc67aa5149f94e1d969aa6883273a8cbf6a))
* **deps:** 升级 npm 依赖至最新 ([45f0580](https://github.com/freeanima-org/freeanima/commit/45f05807aba27998da9bdae8c744ed80bad7eb15))
* **i18n:** 同步 po4a 与文档站侧栏译文 ([b119ab3](https://github.com/freeanima-org/freeanima/commit/b119ab3464ac700ee065c5db4299e88e30468cdb))


### Refactoring

* **config:** runtime 配置按段落库并清理 companion /api/config ([57324e6](https://github.com/freeanima-org/freeanima/commit/57324e637f7fa6be3ef9b2715033261eb7c63b9a))
* **config:** 拆分 bootstrap/runtime 并支持配置热 apply ([dbf937a](https://github.com/freeanima-org/freeanima/commit/dbf937ab800efedef9265220543b1e752cce125b))
* **frontend:** 澄清 Shell 与应用布局并重命名包 ([2e1e548](https://github.com/freeanima-org/freeanima/commit/2e1e54888354b0609bf76cfad313c69706de884f))
* **http:** tls.mode 三分法并去掉 cors_origins ([dbb5215](https://github.com/freeanima-org/freeanima/commit/dbb5215862d01216320ef5735216e182ef74f6f7))
* 按 host/client/ui-kit 重划代码分层并拆分 i18n ([c37c9ce](https://github.com/freeanima-org/freeanima/commit/c37c9ce3ee71f3c08e58f5b134125b025c28c244))

## [0.9.3](https://github.com/freeanima-org/freeanima/compare/v0.9.2...v0.9.3) (2026-07-24)


### Features

* **browser:** browser_type 支持 vault secret 注入 ([76616ee](https://github.com/freeanima-org/freeanima/commit/76616ee907a10524fd4fb0625ac20691d05f6eb1))
* **chat:** 会话未读同步并加固 PG 集成隔离 ([06f92fe](https://github.com/freeanima-org/freeanima/commit/06f92fe38a6ea04a79d9f66af5af77df8f1de46c))
* **chat:** 弱网与刷新后续接流式输出 ([fe19050](https://github.com/freeanima-org/freeanima/commit/fe190504f92eaf9a079262a280100b4e97ea7328))
* **chat:** 新增 /summarize 手动会话压缩 slash 命令 ([2bb5678](https://github.com/freeanima-org/freeanima/commit/2bb56784aabe36b96fd33c3c41420bdc0d294a02))
* **cli:** standalone 多版本安装到 ~/.local/bin ([2c1ae53](https://github.com/freeanima-org/freeanima/commit/2c1ae53a0b4ff28751b11a70b5b3ecab8e1230d4))
* **diary:** 内容块可选标题、标签与日记块模板 ([e0e550d](https://github.com/freeanima-org/freeanima/commit/e0e550d853f50777dad7f700981a123781ca0a77))
* **email:** MIME 解码入库并支持收发箱与 HTML 沙箱 ([e729626](https://github.com/freeanima-org/freeanima/commit/e729626b1c9d7bdff60e98530ce858e656a7edb2))
* **email:** 支持 provider 预设与邮件账户 UI 管理 ([f56e639](https://github.com/freeanima-org/freeanima/commit/f56e639588ca7b9be6f3f23f5427ab5c8dc29839))
* **email:** 未读筛选与邮件快捷操作 ([4dcd45f](https://github.com/freeanima-org/freeanima/commit/4dcd45f1b9c353d83aaa32cd2678690429a8ee53))
* **mcp:** 栖息地统一管理入站 MCP，并支持 Streamable HTTP ([f1ec5ed](https://github.com/freeanima-org/freeanima/commit/f1ec5ed319f0772cbdc63569746a70381cc047a9))
* **offline:** 在线读写优先直连 Hub，消除多余同步等待 ([949c375](https://github.com/freeanima-org/freeanima/commit/949c37540ffea3b45286058ae6c49798da6bda66))
* **project:** 项目任务列表支持标签平铺过滤 ([79491f3](https://github.com/freeanima-org/freeanima/commit/79491f363ba2dbed021a6b49a43db98e49bf3431))
* **shell:** 统一 Portal 为单一 Tauri 工程并移除 Electron/Capacitor ([ab7332a](https://github.com/freeanima-org/freeanima/commit/ab7332a72bd92da4dedd31b799e7b31ec1cef115))
* **tag:** 统一实体挂标签 TagPicker 与按场景 suggest ([bc160b2](https://github.com/freeanima-org/freeanima/commit/bc160b28186c67037da8eb279998830b5e058f94))
* **task:** 新任务置顶并采用间隔 sort_order 重排 ([27bb01b](https://github.com/freeanima-org/freeanima/commit/27bb01b493f0328a11fa90b63b84ec844e4d12eb))
* **tools:** 将 return schema 写入 tools description 供 LLM 读取 ([6c86030](https://github.com/freeanima-org/freeanima/commit/6c86030d622bc6b1931e9fcc22e3e2ec5f86ca1e))
* **tools:** 新增 docs ToolSet 供 agent 查询产品文档 ([344bc37](https://github.com/freeanima-org/freeanima/commit/344bc377e747f5001c19ecb64f0cff25375a2ea9))
* **ui:** 快捷菜单改用 Radix Context Menu 以规避视口边界 ([c0529a3](https://github.com/freeanima-org/freeanima/commit/c0529a355e3a2087a52d04ce77f9894a477ef1f1))
* **vault:** 凭证库支持 TOTP 并优化条目 UI ([323963c](https://github.com/freeanima-org/freeanima/commit/323963cb6e04784a60404d16d9025fb8ded833dc))


### Bug Fixes

* **browser:** secret 仅保留必填 id 与 field ([ac1cbee](https://github.com/freeanima-org/freeanima/commit/ac1cbee97f4a9127ef5e26a16f6f24fcc42ddd8c))
* **chat:** 在线优先写路径并修复刷新续传异常 ([e5fbdfe](https://github.com/freeanima-org/freeanima/commit/e5fbdfec1d657f90cb185cfed40716e24618a480))
* **chat:** 流式生成中允许输入并入队 ([6c85de2](https://github.com/freeanima-org/freeanima/commit/6c85de23158e9a06a76131c25aec46406098e055))
* **ci:** mobile companion-dist 占位并稳住 Tauri Windows/CodeQL ([a54c179](https://github.com/freeanima-org/freeanima/commit/a54c1797c8ca568c4a746d0fc838a9e7dccf8a11))
* **ci:** prepare-tauri 在无 rg 时跳过陈旧 target 探测 ([17d111d](https://github.com/freeanima-org/freeanima/commit/17d111df958cb5707441d445da708261ac13deaa))
* **ci:** Windows 交叉打包安装 libappindicator3-dev ([3d70a4e](https://github.com/freeanima-org/freeanima/commit/3d70a4efe21b5e98538871bef184140e687a6fd0))
* **ci:** Windows 交叉编译安装 llvm-lib 供 ring/cc-rs ([051f78f](https://github.com/freeanima-org/freeanima/commit/051f78f349ab6bbcfaa1c23edc37e372ebb7b30e))
* **db:** 启动时 PostgreSQL 失败输出可诊断中文提示 ([ce40ea2](https://github.com/freeanima-org/freeanima/commit/ce40ea28c6996b94d543f596e596af01d46e8b5b))
* **desktop:** 避免 contextBridge hubFetch 丢失 Response.text ([5416b90](https://github.com/freeanima-org/freeanima/commit/5416b901f41d915e81a6fa3d0ba1f0e96c07b036))
* **diary:** 修复日记列表无限滚动连拉全库 ([533d410](https://github.com/freeanima-org/freeanima/commit/533d41065519aa0ecff2ce808059067257a3ffd1))
* **diary:** 列表懒加载正文并支持实体标签建议 ([ab0ade1](https://github.com/freeanima-org/freeanima/commit/ab0ade1e812cf5c3830f29a0686b556e89bb8c19))
* **diary:** 列表按 entry_at 降序分页，默认每页 20 条 ([3289e2c](https://github.com/freeanima-org/freeanima/commit/3289e2ccba9a387aa7063e86aada6590fea59190))
* **email:** 删除账户时级联清理本地邮件与附件 ([b04c55d](https://github.com/freeanima-org/freeanima/commit/b04c55d05472939210677acef5fd85e8c9ea86bc))
* **env-health:** 将 RSS band 加宽至 512 MiB ([cbf977d](https://github.com/freeanima-org/freeanima/commit/cbf977d56cec2522fc69a6801042bea938026dfb))
* **habitat-client:** 修正 HTTP 回退时 /rpc/v1 路径重复 ([d89124d](https://github.com/freeanima-org/freeanima/commit/d89124da6c8d914b0fe33cb12029a189ab4db128))
* **mcp:** 出站仅暴露 task_* 任务项工具 ([d4599b5](https://github.com/freeanima-org/freeanima/commit/d4599b5091fe10b435aad370d8cc7cb6da07593a))
* **memory:** FTS 默认 OR 并暴露被动召回调试与门槛配置 ([7bb89cb](https://github.com/freeanima-org/freeanima/commit/7bb89cbe30bcffd86269432c93e1cde2b97444ba))
* **memory:** 修正 temporal_summary_peers 桶结束时间 −8h 偏差 ([53f6d7a](https://github.com/freeanima-org/freeanima/commit/53f6d7a784086c799565bd90b8a7289656d35584))
* **pomodoro:** 宽屏双栏布局并允许专注历史滚动 ([24ccc47](https://github.com/freeanima-org/freeanima/commit/24ccc4781366955edd2da6190fdd9362a906db16))
* **runtime:** 尊重空 tools 数组，避免误开全量工具 ([f00e7ef](https://github.com/freeanima-org/freeanima/commit/f00e7ef848eef92bfaba8797edcd35420498f752))
* **shell:** 修复 vite.config 无法解析路径导致 install-cli 失败 ([9a2be84](https://github.com/freeanima-org/freeanima/commit/9a2be84fa485ce99a645ea8d01d84b9ed3935443))
* **shell:** 同步失败 toast 改为重试与丢弃 ([745cb85](https://github.com/freeanima-org/freeanima/commit/745cb8550016f7d02a2cf9011b56eea34553cfae))
* **task/project:** 刷新标签池避免筛选栏显示裸 id ([43c4062](https://github.com/freeanima-org/freeanima/commit/43c40627ccb36e87712d7228c002540d91a885b0))
* **tauri:** 修复托盘/图标/更新与 overlay 空窗回归 ([33a5d45](https://github.com/freeanima-org/freeanima/commit/33a5d45f081242e1e425bf0b8e01a720c4a64f28))
* **tauri:** 修复桌面伴侣 overlay 并改为工作区全屏 ([10ecc60](https://github.com/freeanima-org/freeanima/commit/10ecc60ee63e8e655c3d997592626de1d4ebb517))
* **test:** 无 query 时验证 semantic memory 按 reference_count 排序 ([6e93beb](https://github.com/freeanima-org/freeanima/commit/6e93bebd8bba3a121339bd0b2eebd901e9bb3bb2))
* **test:** 适配无 clearPgTables 的集成隔离并补文档 title ([c4d28b0](https://github.com/freeanima-org/freeanima/commit/c4d28b01b2044d1e44d64d3d5bf1d043dafc7add))
* **ui:** compact 下 list-detail drawer 避让壳底栏 ([78c69f4](https://github.com/freeanima-org/freeanima/commit/78c69f43a6cfa14499c4520d65cd1f78e906a8ac))
* **ui:** 不可恢复删除须确认，并修复日记触屏操作图标 ([7d99282](https://github.com/freeanima-org/freeanima/commit/7d99282d95a89711ea3ad7d2199de9c763a8d500))
* **vault:** 按字段名解析 custom_fields 并防御性 trim ([9d96a84](https://github.com/freeanima-org/freeanima/commit/9d96a84a1277e92958f179ff37bdbe72526ddd92))


### Performance

* **ci:** 加速 Tauri 打包并移除 package-manual ([aa92fa4](https://github.com/freeanima-org/freeanima/commit/aa92fa413f5501092be8f879d737c53841ffdf9a))
* **db:** 优化 reference_count 全表重算与 messages trigram 慢查询 ([a585a0e](https://github.com/freeanima-org/freeanima/commit/a585a0e8a60796ff33ab68733cdf5e6ef36ee650))


### Documentation

* **sap:** 对齐 Habitat RPC 并薄化 companion runtime ([9748e5a](https://github.com/freeanima-org/freeanima/commit/9748e5a739bc2320d85cccbfb74563d07c03bcf5))
* **vault:** 清理 pass 文案并澄清 bootstrap 仅支持 env() ([b0fb9df](https://github.com/freeanima-org/freeanima/commit/b0fb9df7c57ef3869b29de2b1617fe3d87af5c10))


### Miscellaneous

* **cursor:** 新增项目级自动验收技能（浏览器 E2E + RPC） ([c4be1da](https://github.com/freeanima-org/freeanima/commit/c4be1dace62403922be3bc11d2568370331cc4a8))


### Refactoring

* **companion:** overlay WebView-host 承接 remote_tools.attach ([838efac](https://github.com/freeanima-org/freeanima/commit/838efacad426587498b6875331dfa7263c88fbfd))
* **diary:** 日记条目标签迁至顶层 tag_ids ([8e47ee8](https://github.com/freeanima-org/freeanima/commit/8e47ee84dd961bdf648bbd84396dce091f4d8fe8))
* **habitat:** 产品与目录统一为栖息地命名 ([3271f4d](https://github.com/freeanima-org/freeanima/commit/3271f4df5c1550b9bfde6ab3f14d9f1ae2b371b1))
* **memory:** deep sleep 以 PG 为 SSOT，去掉 JSON 与 error.log 复述 ([5a6ed40](https://github.com/freeanima-org/freeanima/commit/5a6ed406e3f3603d740af5ee31f803232ae7645b))
* **memory:** 移除旧记忆引用标记兼容残留 ([92d4208](https://github.com/freeanima-org/freeanima/commit/92d42086c32ebf00fa59f7b331b69771a3c5d333))
* **offline:** 统一离线命名为 snapshot/outbox 并清理 hub 遗留 ([83ca923](https://github.com/freeanima-org/freeanima/commit/83ca923b3f30f4bf1e5261ca3500d2d8a8fb970a))
* **shell:** 清理 Electron/Capacitor 遗留并同步 po4a ([5f1150c](https://github.com/freeanima-org/freeanima/commit/5f1150cc6269953c344ae312b7affc14c1b48a12))
* **tool:** 去掉 FREEANIMA_ALLOW_SHELL 门禁 ([9c5f056](https://github.com/freeanima-org/freeanima/commit/9c5f056bddff52975af81680243b7109e64ab4de))
* 将 Hub 命名统一为 Habitat/栖息地 ([e7d5de1](https://github.com/freeanima-org/freeanima/commit/e7d5de1bdacb7d3ee4c152eaa0256cbe6a361294))
* 废止 SAP，远程工具并入 Habitat RPC ([2122a26](https://github.com/freeanima-org/freeanima/commit/2122a26f284273dcf731fa31f78f8db362b83474))
* 清除 satellite/SAP，引入 Outpost 并将 companion 并入 features ([3e01c25](https://github.com/freeanima-org/freeanima/commit/3e01c25b32e95b512396af4f8a3eb1dce736a330))
* 统一 Habitat 命名并去除 wire 习语 ([7b5ecd1](https://github.com/freeanima-org/freeanima/commit/7b5ecd1f0771facb60bb69b7d961b7c4a4947092))


### Tests

* **chat:** 修复 CI 中 active-stream-persist 被 mock.module 污染 ([5c15def](https://github.com/freeanima-org/freeanima/commit/5c15deffb5fe6afd61d68498dcdebccebe62595a))
* **sap:** 对齐远程工具命名 remote_ 前缀 ([6c0f7cb](https://github.com/freeanima-org/freeanima/commit/6c0f7cb8e0210a15226fb9245bff72259d8976dd))
* **shell:** 修正 module-selection 存储键与 habitatScope 对齐 ([d71fedc](https://github.com/freeanima-org/freeanima/commit/d71fedc5d6179a0ef2ccd8d6bd2e19b39f059b15))
* **vault:** 为 sealAgentVaultItem mock 补参数类型 ([0dc081d](https://github.com/freeanima-org/freeanima/commit/0dc081d2a61c35582f73dfd55068566fdfbb711b))


### CI

* CodeQL 仅周更运行，减少 PR 扫描开销 ([2d9d6b4](https://github.com/freeanima-org/freeanima/commit/2d9d6b42f1c581bfb35eef2880ff61c7de1de798))


### Build

* 以 just 模块统一构建入口并清空 package.json scripts ([97f9f29](https://github.com/freeanima-org/freeanima/commit/97f9f291b1a928da5c67d7fdd9750d734dd10f37))

## [0.9.2](https://github.com/freeanima-org/freeanima/compare/v0.9.1...v0.9.2) (2026-07-19)


### Features

* **chat:** 支持 slash 一级子命令补全 ([0a00f5e](https://github.com/freeanima-org/freeanima/commit/0a00f5eed9b4f29c0c01f9f571943b62cc17e075))
* **chat:** 本机设置开启 LLM 调试，快照改 Redis 按需拉取 ([f9ffe5f](https://github.com/freeanima-org/freeanima/commit/f9ffe5fe6634c3139d8c768c6f870aa049e9c836))
* **hub:** 只读 GET JSON 支持 ETag/304 协商缓存 ([e34bdc8](https://github.com/freeanima-org/freeanima/commit/e34bdc8c4c418e18f89e68c6c3033ea7e3a2fc2b))
* **memory:** 落地时间摘要（全局 entity + 当天会话 JSONB） ([100f033](https://github.com/freeanima-org/freeanima/commit/100f0337fc669b4f3a10bc438eb0f6308a52e0a1))
* **runtime:** 环境感知基线采集与变更通知 ([cd84519](https://github.com/freeanima-org/freeanima/commit/cd845191b844bc6bef0191ab1e6bd61b12cbbd8a))
* **runtime:** 用户活跃统计面板与 env-health 基线迁 Redis ([4852eeb](https://github.com/freeanima-org/freeanima/commit/4852eeb48e63532c8022d130fb231c183d81f9f8))
* **tag:** 引入独立 Tag Entity 并以任务为试点接入 ([f3a0478](https://github.com/freeanima-org/freeanima/commit/f3a04780703753e2d508789b81993114b2c0206d))
* **task:** 任务行展示标签并复用详情面板 ([bbfd994](https://github.com/freeanima-org/freeanima/commit/bbfd99483ec9400383b7e2d9c7c4eeb0a788116c))
* **task:** 全局搜索独立列表态并智能清单自动填 due ([3f9e3ca](https://github.com/freeanima-org/freeanima/commit/3f9e3ca25ca8ca78d915363f45c29308246a1487))
* **tool:** 为 Tool 入参加运行时校验门闸 ([984497d](https://github.com/freeanima-org/freeanima/commit/984497d0d9c5359c42f6d1451e90b35188c8e9ab))
* **update:** 三端升级增加下载进度反馈 ([7005c22](https://github.com/freeanima-org/freeanima/commit/7005c22364e77fd663f0fa266eeab5f6da443de1))
* vault 按次 secrets、配置明文与 LLM 路由可观测 ([5adf85f](https://github.com/freeanima-org/freeanima/commit/5adf85f6e6d3ec8bf54f3e3cfa24e071dd8334e5))


### Bug Fixes

* **console:** 修复运维台对话列表因 sap:: 过滤恒为空 ([243a5f8](https://github.com/freeanima-org/freeanima/commit/243a5f82c9082b6e161d6a5f20ed569bc187cec9))
* **db:** 修复 Bun SQL 裸绑 string[] 导致浅睡查询失败 ([4637665](https://github.com/freeanima-org/freeanima/commit/4637665b44ffe8fbf7324aff13e71454362ef0f9))
* **desktop:** 主进程合并系统 CA，修复 mkcert HTTPS 测试连接 ([285dff7](https://github.com/freeanima-org/freeanima/commit/285dff7cf85c543310e893740f6df9c58cfcb315))
* **dev:** Ctrl+C 时按进程组清理 hub/vite 子进程 ([8e5c52f](https://github.com/freeanima-org/freeanima/commit/8e5c52f8d82f18dba682b5f212e19ba206b1efa3))
* **memory:** 精简时间摘要并剥离寒暄开场 ([28c2ba9](https://github.com/freeanima-org/freeanima/commit/28c2ba96634e9a722fc49b767f99dc3cf17dbcb9))
* **mobile:** 修复 Android versionCode 回绕导致无法覆盖安装 ([52417dc](https://github.com/freeanima-org/freeanima/commit/52417dc661ff63674d01eb02bedd5c6d47d9db0e))
* **task/project:** 修复无缓存清单崩溃并优化项目详情 ([e213fbd](https://github.com/freeanima-org/freeanima/commit/e213fbd10f67384cf8835726359c7e02bf0eec51))
* **task:** 支持 task_create/update 的 tags 名称挂载 ([a839c72](https://github.com/freeanima-org/freeanima/commit/a839c72b984ba181bb943dc78e5fa5397075c76b))
* **test:** 对齐 tag_ids、world subject 与日记 hybrid 排序断言 ([5cc0f39](https://github.com/freeanima-org/freeanima/commit/5cc0f39b18bb4e6479c249d242b995c2a05101be))
* **worlds:** 新实例自动绑定 user/agent subject id ([b1489c5](https://github.com/freeanima-org/freeanima/commit/b1489c5c21d1460c02fc40b3eb37e169183dddfa))


### Documentation

* **naming:** 定稿栖息地/入口产品文案并同步 UI ([f7b3300](https://github.com/freeanima-org/freeanima/commit/f7b33001f64226b5ef89596d5dbfc6f001dffe43))


### Refactoring

* **project:** 移除里程碑与完成标准，改用 content 背景说明 ([3f536b6](https://github.com/freeanima-org/freeanima/commit/3f536b61d1808e64c359555f0753504029aba519))

## [0.9.1](https://github.com/freeanima-org/freeanima/compare/v0.9.0...v0.9.1) (2026-07-17)


### Features

* **alert:** 三壳统一本机预登记 Alert（schedule⊕cancel） ([61c3369](https://github.com/freeanima-org/freeanima/commit/61c3369c05eda076dc801003fedfb8d34d835732))
* **chat:** slash 终端结果走 RPC 面板/toast，开发禁用 PWA ([e983b2a](https://github.com/freeanima-org/freeanima/commit/e983b2a357b023315b9f9a373ab66c9e6b8ba12b))
* **chat:** 聊天室消息尾页分页与向上加载历史 ([c1bca48](https://github.com/freeanima-org/freeanima/commit/c1bca48aff29671eff15f580d21af94d0b4613bc))
* **dev:** 多 worktree 本地开发 DX 与 Just 入口精简 ([0a43c1c](https://github.com/freeanima-org/freeanima/commit/0a43c1cc917cb64478fb053245c8440a124cae44))
* **diary:** 升级为容器 + text content_block 模型 ([e1ae68f](https://github.com/freeanima-org/freeanima/commit/e1ae68f4f97ff037c85da365347b96c07eebb9ec))
* **entity:** 实现 content_block ToolSet（CRUD/检索/排序） ([da0137f](https://github.com/freeanima-org/freeanima/commit/da0137f9675c560d727ecc34b63ee333942653e4))
* **entity:** 注册 content_block 与语义组件模型 ([10f1240](https://github.com/freeanima-org/freeanima/commit/10f124097e70794f7b6f275246243196ca2c6696))
* **gateway:** 消息网关配置化与连接探测 ([bb30652](https://github.com/freeanima-org/freeanima/commit/bb3065224b425436391bd13cb818edb797705084))
* **memory:** 将 limbic/narrative/dream 迁入日记 content_block ([cdc4d6e](https://github.com/freeanima-org/freeanima/commit/cdc4d6ef0ad14e71d7af31bc24474e38586c0c76))
* **memory:** 将 semantic_memory 迁入 entities 并统一 anima 引用 ([82b4128](https://github.com/freeanima-org/freeanima/commit/82b4128c992df9e62a4f192c2be3582b725c0f80))
* **project:** 接入 Tier 2-CRUD 离线优先 ([c173cf3](https://github.com/freeanima-org/freeanima/commit/c173cf37a0d752056ae66868559b0432b07a3eed))
* **shell:** 引入 Anima URI 与 entity overlay，并接入任务/番茄钟 ([7c230cb](https://github.com/freeanima-org/freeanima/commit/7c230cbdb578d696448deabae3ab6129bd213b16))
* **shell:** 模块排序、底栏满铺与 sonner 状态提示 ([603fe9e](https://github.com/freeanima-org/freeanima/commit/603fe9e641cf4f8790c9574616304e692652f227))
* **task/project:** 侧栏统计、隐藏已完成与移动端手势/弹窗优化 ([62d8d44](https://github.com/freeanima-org/freeanima/commit/62d8d442710aba20c4dc103314b190cb197dde92))
* **task:** 任务归属互斥并拆分清单/项目 Hub 入口 ([4acdaa7](https://github.com/freeanima-org/freeanima/commit/4acdaa768366da8f52557d6852334dbe9aa63710))
* **ui:** 任务详情按滴答清单瘦身并精简关于页 ([72e560b](https://github.com/freeanima-org/freeanima/commit/72e560bd08832d5a937192fad157261ad9aa37bb))
* **ui:** 增加多套强调色主题以便区分环境 ([1feffbe](https://github.com/freeanima-org/freeanima/commit/1feffbe3b16bda340f0acb1443f0ffe4353985e1))
* **ui:** 建立壳子/布局/交互三维度正交标准并收敛 API ([cb59bc5](https://github.com/freeanima-org/freeanima/commit/cb59bc54a14f30e60b44396d73c19e9e10c4fab5))
* **ui:** 统一产品页手动刷新与下拉刷新 ([c35158d](https://github.com/freeanima-org/freeanima/commit/c35158dd6b766d7a8aa237d7b7569860442d4300))
* **update:** 支持 GitHub Release 公共代理下载 ([cbc1d2d](https://github.com/freeanima-org/freeanima/commit/cbc1d2d18b7c59a1ad632aa2753d9ddeaaa52225))


### Bug Fixes

* **ci:** 对齐 Android SDK 缓存路径与 runner 预置 ANDROID_HOME ([7ffee85](https://github.com/freeanima-org/freeanima/commit/7ffee853addd6643aaa4a94f7e457b0aada14349))
* **cli:** 修复 standalone 缺少 tiktoken_bg.wasm 导致启动失败 ([fae9659](https://github.com/freeanima-org/freeanima/commit/fae9659b6b39d5512e798bde22b057197f400122))
* **cli:** 将 StartLimitIntervalSec 移到 systemd [Unit] 段 ([662717c](https://github.com/freeanima-org/freeanima/commit/662717c5a330bcd2dc8af401164f7bc60490e1b3))
* **config:** 已知运行时段未写入时 getSection 返回空对象 ([d5aa85a](https://github.com/freeanima-org/freeanima/commit/d5aa85a94c0feb9b0651b9e34d03b6b1c5abfcc2))
* **db:** 加速记忆迁移消息替换并延长 Hub 探活 ([8541305](https://github.com/freeanima-org/freeanima/commit/8541305df2720a772915cdb1c3206d56290310c1))
* **db:** 默认关闭 PG idleTimeout，避免 Bun 误杀长迁移 ([ba0793e](https://github.com/freeanima-org/freeanima/commit/ba0793edef3ff6f255c61e3c9f9fcb546a9e2587))
* **desktop:** 修复 Windows 自动更新在删旧版后中断 ([a479b58](https://github.com/freeanima-org/freeanima/commit/a479b58f578721d6f8ad913f3cf69edeb047631e))
* **dev:** 降噪 Vite Hub WS 代理良性断开并自动解析 Hub 端口 ([c9da389](https://github.com/freeanima-org/freeanima/commit/c9da389e91f1466ac86610d0a7c9ff9e67ed6464))
* **goal:** judge 失败时暂停并关闭推理，避免续跑死循环 ([fb5192d](https://github.com/freeanima-org/freeanima/commit/fb5192d39122216e4e7f10ddda1acad43b47d7aa))
* **llm:** 会话标题生成关闭 thinking，避免输出预算被推理占满 ([4a5cdd0](https://github.com/freeanima-org/freeanima/commit/4a5cdd08ac0244ffe8cf9fb8acb7969e6ea098e3))
* **mobile:** CI 固定 Android upload 签名以支持 canary 覆盖升级 ([0440c78](https://github.com/freeanima-org/freeanima/commit/0440c78c72f7eb761f102211e3aa29a7ee444894))
* **offline:** 收紧 temp-id 生命周期契约，修复日记/任务保存失败 ([cf8c4ca](https://github.com/freeanima-org/freeanima/commit/cf8c4ca5c3c4edfbc2f3916b0555b4cf41cc5cae))
* **project:** 接入 milestone 搜索过滤并修复壳 Tailwind [@source](https://github.com/source) ([c1f4474](https://github.com/freeanima-org/freeanima/commit/c1f4474e5c888cbe10dc637ef38054f76f53cf2e))
* **search:** hybrid 检索去掉向量通道，优先关键词匹配 ([aea881e](https://github.com/freeanima-org/freeanima/commit/aea881e97871ef29493238ac9c4dc96126fc1628))
* **shell:** 切换 user/agent 时同步清空项目与保险库选中态 ([48bb905](https://github.com/freeanima-org/freeanima/commit/48bb9051f11c088d6e500f848eacb820e2dd3a37))
* **shell:** 手机 Hub 设置改用 HTTP 按段拉取配置 ([eb7f9a0](https://github.com/freeanima-org/freeanima/commit/eb7f9a0698dc762d8df9c547b914a3d2bf8bbbaa))
* **speech:** 提高 Hub TTS 分段门槛，避免短句被强制切开 ([8240969](https://github.com/freeanima-org/freeanima/commit/82409697726b4e2b9518a26154db6571e7f6ee0b))
* **task:** toolset 支持按 project_id 列任务与搜索 ([f0407b0](https://github.com/freeanima-org/freeanima/commit/f0407b063d97594157bf86d1cda2d543817d8946))
* **task:** 用 PG advisory lock 防止并发创建重复默认收件箱 ([4c11c2d](https://github.com/freeanima-org/freeanima/commit/4c11c2d729e490f88fa59792057f739e7630d772))
* **test:** 对齐 semantic_memory entity 化后的集成断言 ([1eac92c](https://github.com/freeanima-org/freeanima/commit/1eac92c285868dd3473904073ada7748235efb01))
* **test:** 项目任务创建不再同时传 list_id ([7d53d17](https://github.com/freeanima-org/freeanima/commit/7d53d172cadeea0de82562184f3b8f095047e20e))
* **update:** canary 按完整版本串比较并对齐 Android versionCode ([2c62d82](https://github.com/freeanima-org/freeanima/commit/2c62d82956a4acd62aaa64685fea3edc3dd79b2b))
* **upgrade:** standalone 升级改为先下载校验再停服替换 ([6914a46](https://github.com/freeanima-org/freeanima/commit/6914a46d21883877e3f0acce2af11488f4f0afea))


### Performance

* **ci:** 缓存 Android SDK/Gradle 并加速 Mobile 打包 ([0781a7e](https://github.com/freeanima-org/freeanima/commit/0781a7e9db560e5e5fcf172faaa7b36f021cd5c6))


### Miscellaneous

* **i18n:** 补全 UI 中文译文并同步 po4a 目录 ([85917a3](https://github.com/freeanima-org/freeanima/commit/85917a3e4ac8fd28e64f97c57136276ca2fd5a96))
* 修复 app-update 格式以通过 pre-commit ([25c1c2c](https://github.com/freeanima-org/freeanima/commit/25c1c2cb2d054e78c5bc46969a31241def283c0c))


### CI

* **build:** 统一 canary/release 三端打包并默认 dev channel ([79c8d89](https://github.com/freeanima-org/freeanima/commit/79c8d89a155e6779e6c5096c924c9f6338f4e609))
* **desktop:** 缓存 electron-builder 工具以加速 Windows 交叉打包 ([c02559b](https://github.com/freeanima-org/freeanima/commit/c02559b5f38d730f023fcbf1303daa447d3a8140))

## [0.9.0](https://github.com/freeanima-org/freeanima/compare/v0.8.5...v0.9.0) (2026-07-15)


### ⚠ BREAKING CHANGES

* 移除 Cloudflare Tunnel 远程访问能力

### Features

* **ci:** 增加 canary 滚动预构建与通道更新 ([7af7ab7](https://github.com/freeanima-org/freeanima/commit/7af7ab702b6cd5e8cf3b8b8a31d929d51640aa53))
* **conversation:** CST 02:00 日界后重建系统提示词 ([a164e40](https://github.com/freeanima-org/freeanima/commit/a164e40cb6fa0ba6c5071c7ca528d2a1e706c307))
* **entity:** 实现 world_config subject read/write 授权 ([370d146](https://github.com/freeanima-org/freeanima/commit/370d14632ea35807b5f2de4d04b69514aa876cce))
* **install:** 增加 curl|bash standalone 安装脚本与统一手册 ([3ea4af4](https://github.com/freeanima-org/freeanima/commit/3ea4af4ebe3e37f921821beaaba8e862c47df0ed))
* **pomodoro:** 用 Hub WS 推送替代 active 状态周期轮询 ([1a8c1cf](https://github.com/freeanima-org/freeanima/commit/1a8c1cf25ef0c50f2b5d7824aedd88d17da8e0a9))
* **release:** 三端更新检测与单文件 standalone 安装 ([4da99b1](https://github.com/freeanima-org/freeanima/commit/4da99b1555f3776aa72fa275e5245ebab00b20ae))
* **release:** 以 Linux standalone 替代 npm 与 Docker 分发 ([4d87c9c](https://github.com/freeanima-org/freeanima/commit/4d87c9cb2b2b409a3050ca3ff663bd952bd1c708))
* **tools:** 加固 terminal/file/code_execute 工具面安全 ([d4fe596](https://github.com/freeanima-org/freeanima/commit/d4fe59616b6d9bb233ad6695e10a00e1a4b92a55))


### Bug Fixes

* **boot:** 修复空库冷启动与 LLM/Web 配置闭环 ([8ee33b3](https://github.com/freeanima-org/freeanima/commit/8ee33b3166f70667fded49809b852bfa8f2895bb))
* **chat:** Hub 未就绪时避免进入聊天反复新建会话 ([7faa9a5](https://github.com/freeanima-org/freeanima/commit/7faa9a50237c91b4f26e6239ab1fd90f834233f4))
* **chat:** 弱网下同一 client_op_id 避免双重触发 turn ([e922a1a](https://github.com/freeanima-org/freeanima/commit/e922a1a4e20f3e552f7b402dd0d75bb36c30017c))
* **ci:** switch Desktop Windows build to Linux cross-compilation ([c87afe3](https://github.com/freeanima-org/freeanima/commit/c87afe307972ce1cc34f3587aac89092a8b92e75))
* **ci:** 修复 Quality 中 sethome/upgrade 与空 gitleaks allowlist ([dcbde17](https://github.com/freeanima-org/freeanima/commit/dcbde17d58c4f87728dc4328cd407d3364c9bbcf))
* **ci:** 统一 esbuild 并加强 Windows 冷装，修复 Canary Desktop ([834077d](https://github.com/freeanima-org/freeanima/commit/834077d15388b816c24ccdc7e523a4c3f17781a9))
* **ci:** 缓解 Windows Canary bun install ENOENT 与 husky prepare 失败 ([74ba234](https://github.com/freeanima-org/freeanima/commit/74ba2349609d31bcd1b425830cd5d95f6abab572))
* **hub:** 修复 HTTP 下 GET query 400 与 randomUUID 报错，并增加项目重命名 ([2c284dc](https://github.com/freeanima-org/freeanima/commit/2c284dc179846c60dbab71e4d0830d7ffcc1d336))
* **hub:** 前端 typed client 改用 client 子模块避免打入服务端图 ([de9d13b](https://github.com/freeanima-org/freeanima/commit/de9d13bfdaa55cfd5fde1a8e6a4626ae26311be6))
* **hub:** 前端安装 client method registry 修复 unknown hub method ([dec4828](https://github.com/freeanima-org/freeanima/commit/dec48283fd5ad99d9a9a719faa4be1d0571b8e87))
* **memory:** 检索嵌入短超时 fail-open，hybrid 三路并行 ([f5033b8](https://github.com/freeanima-org/freeanima/commit/f5033b801e0abec8e03335ea65c587fd74621a43))
* **mobile:** 修复本地 SPA 暗屏与 TTS MP3 播放 ([95edc30](https://github.com/freeanima-org/freeanima/commit/95edc30c5648ddd090ac12d4814ee89d34e81d91))
* **offline:** 修复离线同步卡住无报错与配置删除不生效 ([7492e23](https://github.com/freeanima-org/freeanima/commit/7492e232358c137b09e06915474b745de8a31079))
* **shell:** 避免手机浏览器 UA 误判为 Capacitor 壳 ([3bf91d5](https://github.com/freeanima-org/freeanima/commit/3bf91d522567b0e2933a5438f776cf14ce01f04c))
* **task:** 修复清单拖出文件夹并同步项目树拖拽 ([a29bec2](https://github.com/freeanima-org/freeanima/commit/a29bec2d01bb83a075824f781b1f03b2ea8fad2e))
* **task:** 消除清单计数 N+1 以加速任务列表接口 ([869fe0c](https://github.com/freeanima-org/freeanima/commit/869fe0c78612662b03bb9f1ed305e2373c4e62aa))
* **task:** 移动到弹窗保留文件夹以展示子清单 ([c21136a](https://github.com/freeanima-org/freeanima/commit/c21136ab27a9b862599b8e94161277afb1a80ca1))
* **test:** 消除 FTS write 测试 mock.module 污染 buildFtsTsQuery ([7cfb837](https://github.com/freeanima-org/freeanima/commit/7cfb8373555852d8761ec1933df1426f2188887e))


### Performance

* **db:** 补齐检索索引并消除热路径写放大 ([ce6e682](https://github.com/freeanima-org/freeanima/commit/ce6e6828776eeade0761256e8014aa783ea672c9))


### Miscellaneous

* **deps-dev:** bump the dev-dependencies group with 4 updates ([16940f6](https://github.com/freeanima-org/freeanima/commit/16940f64c006b0dc83edb55a486620821a82245c))
* **deps:** bump softprops/action-gh-release ([0c7b825](https://github.com/freeanima-org/freeanima/commit/0c7b8252f5ec7eb0b7d19eae1f50e0c0213355e8))


### Refactoring

* **cli:** 拆分 Web 构建职责并加速 standalone 打包 ([270fd33](https://github.com/freeanima-org/freeanima/commit/270fd33aabab6b8b9cda4b7699c362efca15160f))
* **cli:** 源码用 dev:hub 起 Hub，service 仅 standalone ([e1f4e23](https://github.com/freeanima-org/freeanima/commit/e1f4e2393e06e8c8e35b1c2c68d30a3334aa501e))
* **shell:** Desktop/Mobile 默认本地打包 web/dist ([1225dc2](https://github.com/freeanima-org/freeanima/commit/1225dc204066be3b74cd40a0cec9edf77d36d576))
* **tokenizer:** 用 tokenx 估算替代进程内 HF 词表预加载 ([d287b30](https://github.com/freeanima-org/freeanima/commit/d287b30327fe87e1f87091b22e390f72b8c5fb11))
* 移除 Cloudflare Tunnel 远程访问能力 ([153945a](https://github.com/freeanima-org/freeanima/commit/153945a01a033bc7ef3211b58c207cfee242351d))

## [0.8.5](https://github.com/freeanima-org/freeanima/compare/v0.8.4...v0.8.5) (2026-07-11)


### Features

* **brand:** 全端应用图标替换为新 logo ([d0e36bc](https://github.com/freeanima-org/freeanima/commit/d0e36bc63abe006542dc362244bcae1499956a42))
* **chat:** 离线 outbox 发送与跨端 tail 冲突处理 ([331881f](https://github.com/freeanima-org/freeanima/commit/331881fc34bc8232260dcd0d05eb5dd965c025f3))
* **config:** 外部服务配置测试连接并降级 embedding 检索 ([ab8abd8](https://github.com/freeanima-org/freeanima/commit/ab8abd8dd3c475118d1684e6b416e0510d2394e8))
* **hub:** health/TLS 收进 RPC 并支持 method 级 auth optional ([07c556f](https://github.com/freeanima-org/freeanima/commit/07c556ffb889623c9690086e9e5ca0dceef4c949))
* **hub:** health/TLS 收进 RPC 并支持 method 级 auth optional ([276b041](https://github.com/freeanima-org/freeanima/commit/276b0416001910208055e4098edde810bcc9e121))
* **hub:** Hub RPC HTTP 迁移为 RESTful 路径 ([dd5fdff](https://github.com/freeanima-org/freeanima/commit/dd5fdff3b1f15dfece38f620430f1aa1f47c3a53))
* **hub:** Hub RPC 支持非 JSON 请求/响应与 callRaw ([bc1f81b](https://github.com/freeanima-org/freeanima/commit/bc1f81b2ea54fb88effa6e886abbd74b12953ad7))
* **hub:** platform hub-router 运行时聚合 feature routes ([96e8e86](https://github.com/freeanima-org/freeanima/commit/96e8e86ac29be8f6f6db1102d66528b2d28a7f4b))
* **hub:** TTS 迁入 Hub RPC 并移除 Elysia 层 ([9d2a5cd](https://github.com/freeanima-org/freeanima/commit/9d2a5cdefeca5ebb143f3e4efbd5fdc574077aef))
* **offline:** 实现卫星壳离线平台并在断连时跳过 Hub RPC ([2ca2088](https://github.com/freeanima-org/freeanima/commit/2ca2088851aa6bd37a56cc4043965621bc689a40))
* **pomodoro:** 时长封顶、壳层后台计时与 Hub 多端同步 ([c436750](https://github.com/freeanima-org/freeanima/commit/c4367505dbb1aa3d625d59caf78afad98729ebfe))
* **pomodoro:** 番茄钟、任务专注分段与本机 Alert 通知 ([9725c25](https://github.com/freeanima-org/freeanima/commit/9725c2569649aca9d9d79d0a4df2ea7399b64dc7))
* **project:** 项目管理模块与任务/项目 UI 交互优化 ([08d321f](https://github.com/freeanima-org/freeanima/commit/08d321f6fe5c0aab4ace627dabff739c3d5b4359))
* **runtime:** 时间感知前缀注入 CST 周几 ([5c95943](https://github.com/freeanima-org/freeanima/commit/5c959430843b8238b95af8c5d558c74333db4915))
* **settings:** Hub 配置平铺侧栏并完善 LLM 与会话标题 ([596cc11](https://github.com/freeanima-org/freeanima/commit/596cc1189bb805a1430147733d44830b4719032f))
* **task:** 智能清单与侧栏重构 ([99fb592](https://github.com/freeanima-org/freeanima/commit/99fb592f992fa763528a22ccd1c5eaf80388b25f))


### Bug Fixes

* **chat:** 修复首条消息自动生成会话标题的竞态与 UI 刷新 ([4aa87f0](https://github.com/freeanima-org/freeanima/commit/4aa87f044b6556e50d60639427097fa0757d5fd9))
* **ci:** 修复 0.8.5 PR Quality 与 Build site 失败项 ([b600924](https://github.com/freeanima-org/freeanima/commit/b60092401e4cedb66deb41a8f88750e1fdc32162))
* **cli:** 修复 shell 补全脚本算术比较语法错误 ([5cda7d9](https://github.com/freeanima-org/freeanima/commit/5cda7d9d314b3ea5a0f803ab2d67804a67d75be0))
* **companion:** 补回 sidecar 运行时 API 导出 ([4d6379f](https://github.com/freeanima-org/freeanima/commit/4d6379fd01a0948eb5db6212ceb32c7d79e1bbb0))
* **config:** 修复 Hub 设置页 config.get 误读 config.data ([10c5bbe](https://github.com/freeanima-org/freeanima/commit/10c5bbeaeaddce8b8ddcf293fd5bca77c95f37e1))
* **hub:** 修复 RPC 遗留调用并补全 tokens handler ([6ece19e](https://github.com/freeanima-org/freeanima/commit/6ece19ea460da87e04516a17983a5fc27dda85a8))
* **pomodoro:** 修复多端活跃态 Hub 同步 ([80dd734](https://github.com/freeanima-org/freeanima/commit/80dd734adf580d4f981110f4fad8ec6afab7b184))
* **settings:** 修复配置侧栏滚动并开放 Hub 伴侣设置全平台 ([6a3a23d](https://github.com/freeanima-org/freeanima/commit/6a3a23d57c58a336880a12453a52a52ec7e9b185))
* **shell:** 修复移动壳插件桥接、Alert 平台与番茄钟跳过重复记录 ([5aa6a6f](https://github.com/freeanima-org/freeanima/commit/5aa6a6ffbca507994c72aaec35acf12ea68e1eb7))
* **shell:** 远程 Hub 页改用 nativePromise 桥接 Capacitor 插件 ([4f489df](https://github.com/freeanima-org/freeanima/commit/4f489df61e1b89d998d0b386c9eecdfeac03d10c))
* **task:** 任务到期提醒改推 user 收件箱 ([ac1753d](https://github.com/freeanima-org/freeanima/commit/ac1753d8a678a9eba1c1f28e4e57774378acae14))
* **task:** 修复桌面截止日期选择器并恢复 web 构建 ([659d129](https://github.com/freeanima-org/freeanima/commit/659d1291e0ca572b4aee1b03f0bca3f03087307b))
* **test:** 集成测试注册 health.probe 等 public Hub handler ([2908597](https://github.com/freeanima-org/freeanima/commit/290859753b8b03a82b9828a8b5f2735148243d87))


### Miscellaneous

* **brand:** oxfmt 格式化品牌图标脚本与 Logo 组件 ([c125fd6](https://github.com/freeanima-org/freeanima/commit/c125fd6cdea8c1a2555f5a657ae5f169a902556c))
* **deps:** 更新依赖至最新版本 ([c122846](https://github.com/freeanima-org/freeanima/commit/c1228468124d45fb7ba04a9388472a01dae16f12))
* **mobile:** 从版本库移除 cap sync 生成的 capacitor.settings.gradle ([cbd95a2](https://github.com/freeanima-org/freeanima/commit/cbd95a2caf0fdb3388f38089a2f3adbd2c764c0e))
* **mobile:** 忽略 cap sync 生成的 capacitor.settings.gradle ([796dcd5](https://github.com/freeanima-org/freeanima/commit/796dcd517ab42c1bd2755fba3d851160f1cb9891))
* 添加 Hub RPC 相关 plan 并忽略 .cursor/plans 格式化 ([02216d5](https://github.com/freeanima-org/freeanima/commit/02216d5dd09780ad1603706ddfc4be1fda2e0800))


### Refactoring

* **auth:** 移除 pin-loopback 与 config.json token 自动注入 ([5954701](https://github.com/freeanima-org/freeanima/commit/5954701299e1abf2f63bc8e1dc763f21ae447fb3))
* **build:** 统一 tsconfig 别名并约束相对 import 深度 ([26d937b](https://github.com/freeanima-org/freeanima/commit/26d937bb4a3c3ac70a41d4b223b8718dbbf8e636))
* **config:** Bootstrap 内化并以 RuntimeConfig 为对外 SSOT ([c17778d](https://github.com/freeanima-org/freeanima/commit/c17778d5823e90f9c4434413e5746580d366e23d))
* **hub:** 内联 feature routes 并收敛 registry 与 typed client ([d5bee4a](https://github.com/freeanima-org/freeanima/commit/d5bee4a7b99d709fd04bc365924fb4be9bc22fc3))
* **settings:** 桌面伴侣设置分层并移除 Sentry ([063e59d](https://github.com/freeanima-org/freeanima/commit/063e59d03aec6b12a4cfd0d18110edd01486c241))
* 架构清理二期 — Dream 归位、core/repos 塌缩与 Console 瘦身 ([254e212](https://github.com/freeanima-org/freeanima/commit/254e212a0310adbf5e4c803b1145af12d04c429d))
* 清理迁移遗留与重复实现 ([c177ec3](https://github.com/freeanima-org/freeanima/commit/c177ec3ed7c11abb457aa5773dd3bcbe89344a92))

## [0.8.4](https://github.com/freeanima-org/freeanima/compare/v0.8.3...v0.8.4) (2026-07-08)


### Features

* **chat:** 新增 LLM 调试侧栏并提升 passive recall 关联度 ([6645bb2](https://github.com/freeanima-org/freeanima/commit/6645bb288445e8d68bf5824d7c192db498c8e773))
* **chat:** 聊天室消息增加语音朗读与外露操作栏 ([d4ca6d0](https://github.com/freeanima-org/freeanima/commit/d4ca6d017c2b997d1f80b0ebbbbc3a86885c4eb6))
* **companion:** 伴侣配置与资产上收 Hub，桌面 sidecar 瘦身 ([0c9d5f3](https://github.com/freeanima-org/freeanima/commit/0c9d5f37bbf558fa87e935b34af259459073eadc))
* **config:** 运行时配置迁入 PostgreSQL 并在 Shell 可编辑 ([105f8d4](https://github.com/freeanima-org/freeanima/commit/105f8d493a61046e47ee6927bd491d4de7e8bf1b))
* **desktop:** 在设置中增加显示伴侣开关并移除托盘菜单项 ([63d9a39](https://github.com/freeanima-org/freeanima/commit/63d9a394e9799d4fa4cc773319b66a28d86deca7))
* **hub-rpc:** 新增 HTTP POST /hub/rpc/v1 传输适配 ([4a29de8](https://github.com/freeanima-org/freeanima/commit/4a29de8855df9053fa0060b6768ad8c3829f4511))
* **hub:** 局域网 TLS 信任引导与移动壳 Hub 连接修复 ([12b52f1](https://github.com/freeanima-org/freeanima/commit/12b52f199379b8b070dfe39ad049c6b48ca96028))
* **hub:** 支持双端口原生 HTTPS 与自动 TLS 证书 ([4cb8284](https://github.com/freeanima-org/freeanima/commit/4cb8284a6ccefb6ecf62555459267d9898c40d64))
* **settings:** 设置关于页展示 service/web/native 构建元数据 ([f164d46](https://github.com/freeanima-org/freeanima/commit/f164d46460ee5111e922452869b737649deb8e56))
* **shell-ui:** 布局能力正交、列宽拖拽与桌面启动修复 ([d69bfb4](https://github.com/freeanima-org/freeanima/commit/d69bfb4385331e424f27ce46e91363902a6bec3e))
* **shell-ui:** 重设计 Shell 布局为 Rail 导航并支持模块开关 ([b8c1b01](https://github.com/freeanima-org/freeanima/commit/b8c1b01e3ef33629e06307b21336583728d2a0ee))
* **speech:** Edge TTS 流式合成与客户端边收边播 ([922f2a7](https://github.com/freeanima-org/freeanima/commit/922f2a7dc967ce2633028a6a2538079701cc55d2))
* **speech:** 接入 Hub Edge TTS 并修复播放切换回放旧音频 ([a0b8d56](https://github.com/freeanima-org/freeanima/commit/a0b8d56fc2b29b7d14bc04ee5ecd0b071fcda67b))
* **speech:** 新增 Hub 语音配置并在聊天朗读中生效 ([e210fae](https://github.com/freeanima-org/freeanima/commit/e210fae4778eb0af161957844676cb6dfc9198ea))
* **tools:** 为 diary/dream/email 添加 world_id，notification 添加 subject_id ([3064bf2](https://github.com/freeanima-org/freeanima/commit/3064bf21cd75f8cd90c08287f24e57991f0dbd53))


### Bug Fixes

* **app-mobile:** 修复 debug:android 的 bundled 构建与 cap sync ([bb15e64](https://github.com/freeanima-org/freeanima/commit/bb15e64163294e6e6589a61a1be6680c338248d8))
* **chat,task:** 修复发送占位、用户气泡换行与右键移动到 ([aaafb39](https://github.com/freeanima-org/freeanima/commit/aaafb399e5902952da4de63f4acde7930f589717))
* **chat:** 优化聊天输入区并调整顶栏布局 ([dc34d35](https://github.com/freeanima-org/freeanima/commit/dc34d35bc508c8c2702b8e0f00d27817b71c852c))
* **chat:** 修复手机端 slash 候选菜单被裁切不可见 ([2c0ef71](https://github.com/freeanima-org/freeanima/commit/2c0ef71482ae7ec40a49a5574e5961bb4a7b4e17))
* **chat:** 修复手机端已连接但消息发不出去 ([815ee39](https://github.com/freeanima-org/freeanima/commit/815ee39adfb21726c5966ef7e7b613433af9e800))
* **chat:** 进入聊天室时不再自动聚焦输入框 ([5c4b4dd](https://github.com/freeanima-org/freeanima/commit/5c4b4dd40e665ab6d222051abdea858a31a1b844))
* **ci:** 修复 typecheck 失败并处理 PR review 意见 ([453b297](https://github.com/freeanima-org/freeanima/commit/453b2970f6610db2689bf6ec3e7a422cdd5cc4fc))
* **desktop:** 为任务栏与 Dock 设置应用窗口图标 ([6698f23](https://github.com/freeanima-org/freeanima/commit/6698f23f4612419154675dc2a57cb721b436a120))
* **desktop:** 未配置 Hub Token 时引导设置并强化安装器清理 ([5051c5a](https://github.com/freeanima-org/freeanima/commit/5051c5ae575c7a801c832cbfcad034947b4e60b6))
* **diary:** 修复自动保存丢字并默认打开今天日记 ([d807341](https://github.com/freeanima-org/freeanima/commit/d8073410ee3ee62f6bc6e1aef14f13ba223b698d))
* **diary:** 修复进入 tab 时今日日记未自动选中 ([f854559](https://github.com/freeanima-org/freeanima/commit/f85455911f8d27aab4283b3e975c5d6da6cb0de2))
* **diary:** 日记侧栏固定宽度不随内容撑开 ([712b0e7](https://github.com/freeanima-org/freeanima/commit/712b0e73d677c8d109ce3673cd10601022fb9dff))
* **diary:** 进入时自动打开今日条目并保留正文空白 ([fc5cdc9](https://github.com/freeanima-org/freeanima/commit/fc5cdc9b2195431696958fb6add1f8cbf17bf36e))
* **layers:** 消除 shell-sdk 与 satellite 的 hub-client 层依赖违规 ([f989568](https://github.com/freeanima-org/freeanima/commit/f989568182657988d1b2fe5b4853c7caca9b6219))
* **mobile:** 修复 Android 关于页 native 构建信息与 debug:android 构建 ([5ef5834](https://github.com/freeanima-org/freeanima/commit/5ef58346c0d6d1e175d330b735fc6a0059cf19c1))
* **mobile:** 远程 Hub 页通过 localhost 资产展示原生壳版本信息 ([943c9da](https://github.com/freeanima-org/freeanima/commit/943c9da2478687b9f5b7892e5c0c667558dc3218))
* **search:** 保留 hybrid 检索相关性顺序 ([36a3e97](https://github.com/freeanima-org/freeanima/commit/36a3e97b5f1a43d41a1c19a51181e2f4505b14ad))
* **shell-ui:** 修复窄屏桌面设置页 tabs 缺失 ([2aabdf7](https://github.com/freeanima-org/freeanima/commit/2aabdf7b82e75dca6c5d9b6bdf3b61469867d1b4))
* **shell-ui:** 稳定 Rail 侧栏展开收起与图标间距 ([c6cbebe](https://github.com/freeanima-org/freeanima/commit/c6cbebec5e3823f32340173894e7d9963606f045))
* **shell:** 修复 Hub 配置体验与被动记忆注入 ([21b85e0](https://github.com/freeanima-org/freeanima/commit/21b85e0712af90e6dd027d112e63fee985309871))
* simplify close() in WebStaticServerHandle ([6378a1c](https://github.com/freeanima-org/freeanima/commit/6378a1c08eb31c84224a1726190152ee90b133da))
* **task:** 修复移动到清单弹窗并区分桌面/移动布局 ([a4e5de7](https://github.com/freeanima-org/freeanima/commit/a4e5de79a3fd729d11ed2e811f3b1d3d2bd7ef69))
* **task:** 归档清单脱离文件夹并平铺显示 ([8fa42d7](https://github.com/freeanima-org/freeanima/commit/8fa42d7e58b4c2fbe08bfd75492fcd1b846cc070))
* **task:** 按布局区分「移动到清单」弹窗形态 ([803f807](https://github.com/freeanima-org/freeanima/commit/803f807b7679b093340963cdc8d7622855c9adbd))
* **tests:** deduplicate userCallerAuth helper and use explicit conversation mapping ([95039b6](https://github.com/freeanima-org/freeanima/commit/95039b6bfd6d79c09982f7aebbd4ffde5e206859))
* **tests:** fix 5 CI failures in server health, world scope, and conversation list tests ([031512c](https://github.com/freeanima-org/freeanima/commit/031512c9951bf2657a2394060fef82d9d5945b2b))
* **tests:** fix 5 CI unit test failures (tunnel config, static server, paraglide) ([4a05796](https://github.com/freeanima-org/freeanima/commit/4a0579664c3cc97847932d6779c491ed9225df94))
* **test:** 修复 capacitor-local-asset 测试中 fetch mock 类型 ([b57e8c4](https://github.com/freeanima-org/freeanima/commit/b57e8c4650ab4b391dcecacb186391b71e66f832))
* **test:** 修复全量单测污染与 CI 缺少 paraglide 编译 ([9520138](https://github.com/freeanima-org/freeanima/commit/952013875b31cee6d490c8cd9b09f60fd5d91454))
* **ui-kit:** 统一全局细滚动条样式 ([fbfed37](https://github.com/freeanima-org/freeanima/commit/fbfed379e6aaef5e92a6ffa5977dc633b7e275aa))
* **web:** 手机浏览器直连 Hub 时走 Web bridge 而非 Capacitor ([736663e](https://github.com/freeanima-org/freeanima/commit/736663eaa13b8141836d5a7a5abb37499e34505e))


### Refactoring

* **app-mobile:** 移除 bundled UI，debug:android 改为 remote ([753c829](https://github.com/freeanima-org/freeanima/commit/753c8293b0ecf331ede1015a236dce245953cecc))
* **console:** admin 命名统一为 console 并同步 Hub 多传输 ([8cefb90](https://github.com/freeanima-org/freeanima/commit/8cefb90909d0f1a72e55935eb383f3cd0b2d590e))
* **hub-rpc:** 统一业务通道并移除 Console REST 薄路由 ([6a38d77](https://github.com/freeanima-org/freeanima/commit/6a38d779e5eedbfde9658f0e2918fa726a3cabeb))
* **repo:** 单包收敛并清理 workspace 遗留 ([a58cc41](https://github.com/freeanima-org/freeanima/commit/a58cc411efe8c2437a7d72375a2f993ca65bf547))
* **repo:** 完成 features 纵向重组并移除 capabilities 门面 ([a5a9f05](https://github.com/freeanima-org/freeanima/commit/a5a9f052edbdbd77c003abb8d44bca0462309fa0))


### CI

* 暂停 Blackbox dispatch，保留 job 配置供日后恢复 ([98bed29](https://github.com/freeanima-org/freeanima/commit/98bed2964a316fb75195963b7e2f40886ac3c00f))

## [0.8.3](https://github.com/freeanima-org/freeanima/compare/v0.8.2...v0.8.3) (2026-07-02)


### Features

* **brand:** 落地 L01 主标并全平台生成图标 ([5b63f65](https://github.com/freeanima-org/freeanima/commit/5b63f653a225ad10b6515807a1d761228f4b50b2))
* **hub-rpc:** 引入 Hub RPC 传输层并移除 connectionKind ([00d16f2](https://github.com/freeanima-org/freeanima/commit/00d16f22c15566f2f2f2bc807088e94ddcc8b58c))
* **lint:** 启用 oxlint type-aware 并收紧 lint 纪律 ([962282f](https://github.com/freeanima-org/freeanima/commit/962282f8441c840f62020360e8b973e1844e5dac))
* **memory:** 梦境迁移到 dream_entry 实体并新增 Shell /dream 模块 ([5e00993](https://github.com/freeanima-org/freeanima/commit/5e009930d33539e357b4d94f51a07b9b37e99e6f))
* **memory:** 用户消息 turn 前自动注入相关语义记忆 ([17f8641](https://github.com/freeanima-org/freeanima/commit/17f8641d6a552855bab9d5113c9a9ccfe20d5dcc))
* **shell:** 模块切换与刷新时保留选中状态 ([8fd324b](https://github.com/freeanima-org/freeanima/commit/8fd324b785f8821e02946fbb0524785050aae379))
* **shell:** 统一网络与 Hub 连接状态展示 ([bbd5210](https://github.com/freeanima-org/freeanima/commit/bbd5210de7c07b4826ccc9b60e007e6017891fd4))
* **task,diary:** 任务与日记编辑自动保存 ([0ba2446](https://github.com/freeanima-org/freeanima/commit/0ba2446ea825a80d77f877f29d3f87d13dc05c71))
* **tools:** 精简 MCP/ToolSet world_id 默认按 caller subject 解析 ([08e4a73](https://github.com/freeanima-org/freeanima/commit/08e4a736c643d2caba2931155d48b39c4f822697))
* **vault:** 引入 Agent/User 保险库并替换 pass 凭据集成 ([81e11c2](https://github.com/freeanima-org/freeanima/commit/81e11c2673adb1e6e125a9acb2e755f9f0473139))
* **web:** 扩展 PWA 离线只读缓存与统一 UX ([715448a](https://github.com/freeanima-org/freeanima/commit/715448a97048b8de6c2e9a38db4821bdea6f13cf))


### Bug Fixes

* **admin:** 修复 API token 创建卡住与弹窗列表展示 ([9604ac3](https://github.com/freeanima-org/freeanima/commit/9604ac34c1de09986431318fd0375584c1407be1))
* **chat:** 移动端 Enter 换行而非发送 ([c98cc82](https://github.com/freeanima-org/freeanima/commit/c98cc82399d986e2b25287f8e1ad26cfdaa81c14))
* **chat:** 移动端 Enter 换行而非发送 ([6e305f4](https://github.com/freeanima-org/freeanima/commit/6e305f4aaa3a807d4984c68b202d7b4366871078))
* **chat:** 统一 bundled Chat 会话 platform 为 chat ([e4129b8](https://github.com/freeanima-org/freeanima/commit/e4129b889a99944eb1e6e6c67724da5cb3132a38))
* **platform:** preserve platformExtra for chat platform in buildPlatformInfo ([e7ddebf](https://github.com/freeanima-org/freeanima/commit/e7ddebfdfcc5df535488d12af67a9facb70c392f))
* **shell-ui:** 修复设置页侧栏在路由切换后不显示 ([96acd57](https://github.com/freeanima-org/freeanima/commit/96acd5744b9ac807be53e55bf5bc59172af39622))
* **task,email:** 任务与邮件搜索改走 SAP RPC ([caa842f](https://github.com/freeanima-org/freeanima/commit/caa842f5369d745b53fbecdd73c6ab9a3bbe9776))
* **task:** 修复窄屏任务详情编辑无法保存 ([07d275b](https://github.com/freeanima-org/freeanima/commit/07d275be207fb06ddcd7d76c366100cf48e503da))
* **task:** 切换 User/Agent 后刷新文件夹与清单 ([3c2a338](https://github.com/freeanima-org/freeanima/commit/3c2a33803fcd71081c72583e50bcc93243aff322))
* **tests:** 集成测试 Chat 平台改用 flat `chat` ([0e3df75](https://github.com/freeanima-org/freeanima/commit/0e3df752c3b4812daad649a35cf8b8f2e29e513b))


### Documentation

* **i18n:** 同步 Vault 迁移后的中英文文档与 PO 译文 ([dab2403](https://github.com/freeanima-org/freeanima/commit/dab2403e077d421698d3d7a6510d48e89482d6bb))


### Miscellaneous

* **deps:** 升级 Vite 6 至 Vite 8 ([7aba4f6](https://github.com/freeanima-org/freeanima/commit/7aba4f694ffb081ae0e29e69577bc1e28d140f51))
* **i18n:** pre-commit 不再检测翻译，留待 PR CI ([88178d1](https://github.com/freeanima-org/freeanima/commit/88178d18468e8978ad6b30f0834abffb7b16cafe))
* **i18n:** 从 CI 与 dep-check 移除 i18n 强制检测 ([660233e](https://github.com/freeanima-org/freeanima/commit/660233e318526c87054dd4d95222cd9c96cbd951))


### Refactoring

* **credentials:** 移除 pass 凭证页与旧凭据运行时逻辑 ([369ae76](https://github.com/freeanima-org/freeanima/commit/369ae760ded3e18a99dadd5cb7bdda1fed8901bb))
* **ui:** 布局层改由视口断点驱动 ([b3039c5](https://github.com/freeanima-org/freeanima/commit/b3039c589814327c337ad43d279baa92238b1b04))
* 彻底移除冰箱贴（fridge-magnet）功能 ([0fbb7a9](https://github.com/freeanima-org/freeanima/commit/0fbb7a9e106dc415adee5a3183e01fadb69a37f3))

## [0.8.2](https://github.com/freeanima-org/freeanima/compare/v0.8.1...v0.8.2) (2026-07-01)


### Features

* **email:** 邮箱三档响应式三栏布局 ([985c7d3](https://github.com/freeanima-org/freeanima/commit/985c7d3ee918599654125e735e57e8de53fe0531))
* **mobile:** 优化移动端聊天交互与壳层导航体验 ([3e06bb8](https://github.com/freeanima-org/freeanima/commit/3e06bb8cb3b237934e62282949a87e446ed2635b))
* **shell:** Hub Web SSOT 薄壳远程 UI 与 PWA 布局收敛 ([c20751f](https://github.com/freeanima-org/freeanima/commit/c20751f508ed6b9b370f02188f0c1942ae4efe97))
* **task:** 任务页三档响应式三栏布局 ([98302e8](https://github.com/freeanima-org/freeanima/commit/98302e8f1c1af91c27711156988a8d32a064f78a))
* **task:** 强化清单文件夹删除与归档规则 ([777544b](https://github.com/freeanima-org/freeanima/commit/777544bfcc0b426dba95c79a935ea5fa0f25194d))
* **web:** 完善 PWA manifest、更新安装 UX 与离线提示 ([098e374](https://github.com/freeanima-org/freeanima/commit/098e37463575ddac18fdbe2095aee2123960c0da))


### Bug Fixes

* **chat:** 聊天列表按最后更新时间降序排列 ([46a53c1](https://github.com/freeanima-org/freeanima/commit/46a53c1f02b4eaedd08e90ea1364a1ddf33066cd))
* **email:** 修复点击邮件时 markRead 因 world 不匹配报错 ([a252b0f](https://github.com/freeanima-org/freeanima/commit/a252b0fe35033c741ca4f518a2e23a1cafb44241))
* **i18n:** resolve 41 fuzzy PO entries in zh_CN translations ([60172ce](https://github.com/freeanima-org/freeanima/commit/60172cea2170f2bf36ca9f159a0b8a326a1f2363))
* **shell:** 修复仪表盘导航并统一窄屏浏览器布局 ([e591680](https://github.com/freeanima-org/freeanima/commit/e591680900a963a92b24674b2b727790fbd2e31f))
* **ui:** 修复 shell-bridge 只读冲突与任务子清单 prompt 不可用 ([94c3b62](https://github.com/freeanima-org/freeanima/commit/94c3b625326d4e7bad7962fb5ed4ea55387378d7))


### Performance

* **web:** shell-bridge 内容 hash、协商缓存与 tab 懒加载 ([1030a1c](https://github.com/freeanima-org/freeanima/commit/1030a1c71d1c86c555a5b6973b23be426866b946))


### Documentation

* 对齐文档与规范及当前实现 ([2bd479e](https://github.com/freeanima-org/freeanima/commit/2bd479e8ab516ecacb97bb5309badd21ba1e8895))


### Miscellaneous

* **css:** 主题色迁出裸 CSS 并统一用 Stylelint 校验 ([deeaa07](https://github.com/freeanima-org/freeanima/commit/deeaa0799ffe5e6a8a5638ad242e9667ac7402a4))
* **i18n:** 同步文档 pot 与 zh_CN 翻译 ([2cf879c](https://github.com/freeanima-org/freeanima/commit/2cf879c6b38d55d199b47c07214e54408eaa95aa))


### Refactoring

* **ui:** 迁移 DaisyUI 至 shadcn/ui 并修复壳层与 Alert 布局 ([7d61f8f](https://github.com/freeanima-org/freeanima/commit/7d61f8f6b76480607528631d65d9063c6eec91f2))

## [0.8.1](https://github.com/freeanima-org/freeanima/compare/v0.8.0...v0.8.1) (2026-07-01)


### Features

* **auth:** 实现 Service API Token 按 subject 认证 ([a773b2b](https://github.com/freeanima-org/freeanima/commit/a773b2bf394f8f4ef1cc0e1a35d5c646e8157b37))
* **entity:** 实体 World 归属显式化与 worlds 配置 ([a387e92](https://github.com/freeanima-org/freeanima/commit/a387e9242a5c4724e69e0a857ec52084152eb97e))
* **http:** Hub /web 静态托管与 http.cors_origins 解耦 ([35a834b](https://github.com/freeanima-org/freeanima/commit/35a834b716dfe3c34c9628897855e3e6a8720ae2))
* **hub:** 支持 http.host 配置与局域网 Web UUID 兼容 ([ddc1687](https://github.com/freeanima-org/freeanima/commit/ddc16871b7eed8df8617ba9632ad24fe47091d39))
* **shell:** 壳层全局 User/Agent Subject 切换 ([7e5e8ad](https://github.com/freeanima-org/freeanima/commit/7e5e8ade39addda29eb2fe2bb1cfd34dc3f27575))
* **task:** 任务列表显示 ID 并支持右键复制 ([dbc3189](https://github.com/freeanima-org/freeanima/commit/dbc3189e6f761ae56e31d8290f4fbe839b2c57f9))
* **task:** 任务清单支持嵌套文件夹 ([63d9c05](https://github.com/freeanima-org/freeanima/commit/63d9c055a5f9978823a8c11f2ba8bb6d34f78c92))
* **ui-kit:** 基于 DaisyUI 统一主题并封装复合组件 ([efb9ba1](https://github.com/freeanima-org/freeanima/commit/efb9ba192f25febc7ed85edd1788c4de745dcc01))
* **web:** 未配置 Token 时显示 Hub 连接引导页 ([0f55c45](https://github.com/freeanima-org/freeanima/commit/0f55c45550ce906df5b5877f6d6513ea76db67ee))


### Bug Fixes

* **ci:** 修复 admin-frontend 分层依赖与 PO fuzzy 条目 ([5eb1232](https://github.com/freeanima-org/freeanima/commit/5eb123264bb25f620dfd8524e90df3d98543a481))
* **ci:** 修复 CLI bundle 与启动前 FTS 分段 ([171ee4e](https://github.com/freeanima-org/freeanima/commit/171ee4e98ebed5d1659457ab0b4e49223f5a9590))
* **ci:** 修复 CLI 入口路径与 entity-crud-repo db.execute ([3de81a6](https://github.com/freeanima-org/freeanima/commit/3de81a6cc474600d21f09d38a800db0e20a3fe2b))
* **ci:** 修复集成测试 PG 连接泄漏与 meta patch 清除 ([3df3ab1](https://github.com/freeanima-org/freeanima/commit/3df3ab142f7bdecb6435da612595149534d8f80d))
* **ci:** 允许 Dependabot PR 触发 Blackbox dispatch ([757bb95](https://github.com/freeanima-org/freeanima/commit/757bb9561f4722652b9ecda9f3db77fd7174d1bc))
* **cli:** 修复 tunnel 托管与 Web 静态资源加载 ([0898d65](https://github.com/freeanima-org/freeanima/commit/0898d65779273ca22ea46dd23fd708b40771563e))
* **companion:** 修复 VRMLookAtQuaternionProxy 的 name 赋值类型错误 ([b79ae2e](https://github.com/freeanima-org/freeanima/commit/b79ae2ec67ca5df895775925393140b6a83c4bc3))
* **entity:** 先创建 user/agent subject 再分配默认私有 world，避免 id 冲突 ([387ac12](https://github.com/freeanima-org/freeanima/commit/387ac12d6e34f7d7f9b71085740d2885eba4ebc3))
* **lint:** 清零 oxlint WARN 并收紧 unicorn 规则 ([49ebc13](https://github.com/freeanima-org/freeanima/commit/49ebc13918847526338474920c35bc87603c8181))
* **sap:** 修正 handlers 子目录下的相对 import 路径 ([c706762](https://github.com/freeanima-org/freeanima/commit/c706762a28d24258e88af7ad8ed4128447867d64))
* **task:** 修复任务拖到清单失败 ([a8f61bf](https://github.com/freeanima-org/freeanima/commit/a8f61bfcea4647a6e97038aabed3f00f40534b43))
* **task:** 移动到弹窗支持文件夹树与搜索 ([f9e4f14](https://github.com/freeanima-org/freeanima/commit/f9e4f1482c3e1ac0ba6bca3457d5ca5f298c97bf))
* **ui-kit:** 补充 satelliteShell 类型并清理 format 遗留 ([f0e57f1](https://github.com/freeanima-org/freeanima/commit/f0e57f1ecbb712a944e54fb6acca12f1b3b24c20))
* **vite:** 用 resolveId 插件解析 SharedWorker 打包 URL ([0961293](https://github.com/freeanima-org/freeanima/commit/09612934b3d16bcfe1a21f2a75cde0439f460dab))
* **web:** SharedWorker 内建打包并修复 SAP WebSocket 升级 ([0762800](https://github.com/freeanima-org/freeanima/commit/0762800b5f0b02f7efbd9b79a069900817b5f6ce))


### Performance

* **install:** 加速 bun install 并消除 ensure-fbx2gltf 僵尸进程 ([2f8e985](https://github.com/freeanima-org/freeanima/commit/2f8e985d60b2df1257b063fc585decafe3cabbed))


### Miscellaneous

* **deps:** bump the production-dependencies group across 1 directory with 15 updates ([77f0cad](https://github.com/freeanima-org/freeanima/commit/77f0cad8c80b54008137c06ae19944026425c7ae))
* **deps:** 升级 commitlint、oxlint 等 devDependencies ([e3e73ab](https://github.com/freeanima-org/freeanima/commit/e3e73ab9e6c86035f479ce590d5748a8fbd501d7))
* **lint:** 收紧 TypeScript 与 oxlint 严格检查 ([ff8d07f](https://github.com/freeanima-org/freeanima/commit/ff8d07f9eed1bf533aa7834acbbb43fd7d94eb5b))
* 删除 multi-worktree-workflow 技能 ([8f39ec9](https://github.com/freeanima-org/freeanima/commit/8f39ec930ba2bcde7c22e2716a879d4d1966bcf7))


### Refactoring

* **frontend:** 划分 ui-kit/shell-sdk 并划清 SAP 边界 ([d954f57](https://github.com/freeanima-org/freeanima/commit/d954f57a1b7b5f4b847c1a22115c74e5f728afe1))
* **sap:** 移除浏览器 SharedWorker SAP 连接链路 ([50dcec7](https://github.com/freeanima-org/freeanima/commit/50dcec7410e03162035ce0f440a873f398d9a17f))
* 架构变迁遗留代码一次性清理 ([460786a](https://github.com/freeanima-org/freeanima/commit/460786a000b1ee3c4206fc3044727580f5f33e6b))

## [0.8.0](https://github.com/freeanima-org/freeanima/compare/v0.7.0...v0.8.0) (2026-06-29)


### ⚠ BREAKING CHANGES

* 设置契约迁入 shell-ui，form/component 分责
* 桌面/移动统一壳层与设置窗
* Admin 架构重组与命名统一
* **desktop-shell:** 拆分伴侣内容与通用桌面壳
* **satellite:** 将 parlor 重命名为 chat

### Features

* **admin:** 世界/主体管理页与对话术语统一 ([74257d6](https://github.com/freeanima-org/freeanima/commit/74257d64876aee659a75a7f58ed4044307acbd7a))
* **app-desktop:** 通用设置面板与开机自启动 ([f2dc9c0](https://github.com/freeanima-org/freeanima/commit/f2dc9c0913dc00617c7fcfc46040b51728f1580b))
* **app-mobile:** 新增 Android Capacitor 壳与会客厅 SAP 直连 ([eb384b5](https://github.com/freeanima-org/freeanima/commit/eb384b5ceefc8d4279fb5abc0ac262be4a7058c4))
* **app-web:** 新增浏览器开发壳，支持 dev:web 快速调试 UI ([e408fa9](https://github.com/freeanima-org/freeanima/commit/e408fa9f4f6addc308f96b5ca40d66d022dff0b7))
* **chat:** 支持会话归档与永久删除 ([8ac5260](https://github.com/freeanima-org/freeanima/commit/8ac526053ff2feaf277a3255b01d1998ed37088f))
* **cli:** tunnel status 增加 Cloudflare 边缘连接探测 ([fbb3d80](https://github.com/freeanima-org/freeanima/commit/fbb3d80fd366fa41636bcad3825d355bca6346e5))
* **companion:** change SAP toolset from private to public ([fdf6e9a](https://github.com/freeanima-org/freeanima/commit/fdf6e9abd3733548d8d2f61cdd8859c19a509c0b))
* **companion:** daisyUI 设置面板、动作导入与 runtime WebSocket ([c55d9ee](https://github.com/freeanima-org/freeanima/commit/c55d9ee04638c8338e06a3934ce617efc178fb03))
* **companion:** VRMA 交互、边缘巡逻与 Windows FBX 打包 ([ecb0b21](https://github.com/freeanima-org/freeanima/commit/ecb0b2185695f48da916a765861b1a8074bf2d61))
* **companion:** 修复 VRM 朝向并拆分桌宠/设置双窗口 ([86ecb3e](https://github.com/freeanima-org/freeanima/commit/86ecb3e0d62fd0af3f2d9e21e540dcefea1980d8))
* **companion:** 动作库预览支持拖拽旋转视角 ([84606d9](https://github.com/freeanima-org/freeanima/commit/84606d93b70bce0e2587c869736ba7e72daffca3))
* **companion:** 动作槽位体系、设置 Tab 化与 SAP 工具接入 ([df044b6](https://github.com/freeanima-org/freeanima/commit/df044b64660a1d8dce1a12315bedd00fec09bb82))
* **companion:** 完善桌宠散步动画与浏览器小视口 ([8350056](https://github.com/freeanima-org/freeanima/commit/835005633d29510afba720141a823854903cad94))
* **companion:** 素材稳定 ID、动作库修复与水平巡逻 ([372250f](https://github.com/freeanima-org/freeanima/commit/372250fd1ab919c1ab8bc72238dfa619c904b8a5))
* **companion:** 迁移桌面伴侣至 Electron 并修复打包与动画问题 ([3bf0848](https://github.com/freeanima-org/freeanima/commit/3bf08482790bbde093ed86d90a370aea5b600435))
* **companion:** 重构 sidecar 打包并修复巡逻与后台启动 ([3e39ad6](https://github.com/freeanima-org/freeanima/commit/3e39ad6d23b27368f60d11b0bb03a2ab4faa4720))
* **compress:** 统一 context_window 解析并优化 slash 展示 ([8435a4e](https://github.com/freeanima-org/freeanima/commit/8435a4e887c70d8f3458dea74d320e62d726da81))
* **desktop-shell:** 拆分伴侣内容与通用桌面壳 ([7cb3a52](https://github.com/freeanima-org/freeanima/commit/7cb3a523dd36875d26a08acc13c1d988cd5c112c))
* **desktop:** Admin 契约拆分与 Windows 打包命名优化 ([fa0932d](https://github.com/freeanima-org/freeanima/commit/fa0932d9283acecee1e44f50787a64d8181e812f))
* **diary:** 添加日记全栈能力与按 date 的 Agent ToolSet ([c87370a](https://github.com/freeanima-org/freeanima/commit/c87370a15404506288fc71ef711022e28a041efc))
* **email:** 邮箱迁入实体模型并迁至壳层 /email 模块 ([71555df](https://github.com/freeanima-org/freeanima/commit/71555df1004e77208b1cfba14554f7ed88d19345))
* **entity:** 实体复合搜索与任务跨清单检索 ([c5af266](https://github.com/freeanima-org/freeanima/commit/c5af266391af72fad526632e60e4908d70e954df))
* **entity:** 重构主体/世界归属模型并优化 Admin 管理 ([d3ae048](https://github.com/freeanima-org/freeanima/commit/d3ae048ebc04e1f6314748c4f9c57a0ddf34cc10))
* **fridge-magnet:** 以 assistant(fridge_context) 物化冰箱贴意识层 ([8bf90d9](https://github.com/freeanima-org/freeanima/commit/8bf90d927f8f20a360c792df2790bb5c16684d38))
* **gateway:** Discord clarify 选项渲染为交互按钮 ([b6b6799](https://github.com/freeanima-org/freeanima/commit/b6b6799526107c44637f28beff88240e6c2c4e26))
* **gateway:** 统一 IM 出站合并、origin_active 路由与工具展示策略 ([b6143f9](https://github.com/freeanima-org/freeanima/commit/b6143f91780e653fe84bc55d3b9bc564d9cc4fde))
* **goal:** 实现 Session Goal 机制（judge 续跑与斜杠命令） ([1d38d98](https://github.com/freeanima-org/freeanima/commit/1d38d98e91273e6a428596e0887a692b37ebec7f))
* **hub:** 移除 Tunnel Access，统一 remote_auth 直连与探活 ([a9ec57c](https://github.com/freeanima-org/freeanima/commit/a9ec57c0f8b0b5d9adaa83a9d7c84ac7d8d9b614))
* **mcp:** Hub /mcp 端点供外部 Agent 查询 FreeAnima 数据 ([6cff65c](https://github.com/freeanima-org/freeanima/commit/6cff65cddedd16ef1beed6ee836b3079521f3963))
* **memory:** limbic/自传体接入 FTS+向量 hybrid 检索 ([da72bf8](https://github.com/freeanima-org/freeanima/commit/da72bf8535f1e49688a93517a65505ef7312cd70))
* **notifications:** PG 通知收件箱、Agent 注入与任务提醒扫描 ([8814c98](https://github.com/freeanima-org/freeanima/commit/8814c98a6791719d34b47de81e45cfc5dd10c698))
* **notifications:** 新增 SAP 通知收件箱与 shell 通知模块 ([c65de85](https://github.com/freeanima-org/freeanima/commit/c65de853775d6ab9f97db6470d75ffb85b6d26e8))
* **parlor:** SAP 重连、流式队列/停止与会话体验修复 ([b2626f1](https://github.com/freeanima-org/freeanima/commit/b2626f18bfcde1160aacdbdd5fcbe98efbd95f7f))
* **parlor:** SAP 重连、流式队列/停止与会话体验修复 ([e4da37f](https://github.com/freeanima-org/freeanima/commit/e4da37fc1bc4d28659dcba5f5374fe86652c5f4d))
* **platform:** Hub remote_auth 与客户端 Hub 配置 ([4eb3fbc](https://github.com/freeanima-org/freeanima/commit/4eb3fbc182769925bc92dffabf4991ea119303bd))
* **platform:** inject conversation channel info into system prompt ([7507b80](https://github.com/freeanima-org/freeanima/commit/7507b80464d47ce632eb7712940b63b160ed9b68))
* **platform:** 客户端 bundled UI，Hub 仅保留 API 与 SAP ([c66f44d](https://github.com/freeanima-org/freeanima/commit/c66f44d984c178e3c5837ffd1ba1accf8f2179dc))
* **runtime:** 拆分 AutoLlmRun 原语并增加卧室审计页 ([7417a11](https://github.com/freeanima-org/freeanima/commit/7417a11822505cc567e4bd811200f9eb4fa574f0))
* **sap:** Chat 采用 singleton 固定 instance_id ([ede7561](https://github.com/freeanima-org/freeanima/commit/ede75619a3857fadf173aff6b5423f681e18b0fd))
* **shell-ui:** 统一 web/mobile/desktop 壳层样式与交互 ([ad625e7](https://github.com/freeanima-org/freeanima/commit/ad625e780c980d3ff61f92c5659c953eab82df6f))
* **shell:** 新增调试面板与桌面 settings.json 配置 ([517abc4](https://github.com/freeanima-org/freeanima/commit/517abc412e751871f7bf434cde74a32d4c26451a))
* **task:** 任务 SAP 化并修复 web dev 壳层 ([7e6af94](https://github.com/freeanima-org/freeanima/commit/7e6af94b1b0b6f9020bd6ea7678d51275a3b1ca9))
* **task:** 任务清单复用 closed 实现归档 ([c8a14aa](https://github.com/freeanima-org/freeanima/commit/c8a14aa8590dbda1bbb75fcf1f8ada200c818ba0))
* **task:** 任务迁至 entity 模型并完善 satellite 交互 ([a366119](https://github.com/freeanima-org/freeanima/commit/a366119ec16fc9659bda366ce33e53d9e99f2b64))
* **task:** 新增 tasklist_update 工具 ([67bc69c](https://github.com/freeanima-org/freeanima/commit/67bc69c960726fc40fc1f32c84a4b915a7e1757f))
* **task:** 移动端任务 UI 抽屉导航与触摸拖拽排序 ([ebea7d2](https://github.com/freeanima-org/freeanima/commit/ebea7d26f1c4b839723b3aecffb6eb534a41dcb6))
* **task:** 统一实体底座、任务模块与 daisyUI fieldset 表单项 ([09e5752](https://github.com/freeanima-org/freeanima/commit/09e575261875580abfeba6e30b0a394079b57e5c))
* **tunnel:** 内置 Cloudflare Tunnel + Access 远程访问 ([e097126](https://github.com/freeanima-org/freeanima/commit/e097126ff6efec96b4ff67b7f984ed0fbfe51a50))
* **ui:** 抽象 ListDetailLayout 并修复 drawer 侧栏透明 ([9967857](https://github.com/freeanima-org/freeanima/commit/9967857940cd9c834fb84674ab00287c89a6b2b0))
* **web:** Web 独立进程 stack 部署与壳层生产修复 ([2d3dbae](https://github.com/freeanima-org/freeanima/commit/2d3dbaef75a3eb7844bf320bca412a4664ad274b))


### Bug Fixes

* **admin:** 修复 bundled 管理台 Hub REST 并在控制台输出错误堆栈 ([a37690e](https://github.com/freeanima-org/freeanima/commit/a37690e6dfe5b0cd9d35bc60aeff1fd63c269a57))
* **app-desktop:** DevTools 改为窗口内嵌并移除托盘入口 ([25682c5](https://github.com/freeanima-org/freeanima/commit/25682c51705b5db6a8d32a090c6370407840230a))
* **app-desktop:** 修复 Windows 升级时冷启动旧版导致解压失败 ([5567803](https://github.com/freeanima-org/freeanima/commit/556780365a1a967ff6ed2de44a7cfd18b8f0740c))
* **app-desktop:** 修复 Windows 安装包并优化打包体积 ([5783d9b](https://github.com/freeanima-org/freeanima/commit/5783d9b100923c67212d7fe4013cf2752cb9a816))
* **app-desktop:** 修复桌面 chat 双重挂载与 SAP worker 404 ([af4f77c](https://github.com/freeanima-org/freeanima/commit/af4f77cd4eab14488daac598c2d73a2ac700e5f5))
* **app-desktop:** 缓解 Windows 安装器点击安装后系统卡死 ([d9597d3](https://github.com/freeanima-org/freeanima/commit/d9597d31c9e150d5402fb4d5dcde0439f5a80532))
* **app-mobile:** Android 真机构建改用 Gradle 直装并显示进度 ([e401f7e](https://github.com/freeanima-org/freeanima/commit/e401f7e2575a18febb14f0d8ab28667dafdd6818))
* **app-mobile:** 修复 Android 状态栏与安全区重叠 ([5a58307](https://github.com/freeanima-org/freeanima/commit/5a583078ace024ef68da5413b65720e7ce8f834f))
* **app-mobile:** 修复占位符导致 index.html 丢失脚本 ([68150ef](https://github.com/freeanima-org/freeanima/commit/68150ef7cad48305e56f9a46aa4ad67dc4c053cd))
* **app-mobile:** 修复卧室 WebUI 资源路径双前缀导致样式失效 ([2e288a8](https://github.com/freeanima-org/freeanima/commit/2e288a8611b386d6bd74e70e2d82d043444f77be))
* **app-mobile:** 修复聊天输入与管理台直连 Hub 网络 ([8341ca6](https://github.com/freeanima-org/freeanima/commit/8341ca6fc424249b40e3cb0f290f9c8fd9c0f231))
* **app-mobile:** 修复重新打开白屏并补充启动错误提示 ([83265d0](https://github.com/freeanima-org/freeanima/commit/83265d0efa91a889a94bad63cb77827d6b654f9e))
* **app-mobile:** 移动端设置布局与 Hub 重连能力 ([4e5541d](https://github.com/freeanima-org/freeanima/commit/4e5541df5c0f0a2158ba7eeb7ec824b2617cc0b1))
* **app-web:** 恢复 Web 壳层通用设置面板 ([1e6f731](https://github.com/freeanima-org/freeanima/commit/1e6f73161d9ae76eab3f771bd88a8d5305eeeb8f))
* **ci:** Quality 工作流安装 gettext/po4a 以运行 strict PO 检查 ([fd35431](https://github.com/freeanima-org/freeanima/commit/fd3543188d398cd42fac54b615d1f68b71e2d42f))
* **ci:** 修复 Gitleaks 误报与 CodeQL 告警 ([fa38a0f](https://github.com/freeanima-org/freeanima/commit/fa38a0fdaec47ef464db5e497cd5541c95354e88))
* **ci:** 修正 CLI pack 路径为 src/app/cli/publish ([c7ed789](https://github.com/freeanima-org/freeanima/commit/c7ed7893e408244893397814fc18cb86a7a18d2a))
* **ci:** 清除 PO fuzzy 并恢复 platform llm-openai 依赖 ([326bc43](https://github.com/freeanima-org/freeanima/commit/326bc434d45d27e5d886e891acb5466bc3312f8b))
* **cli:** 恢复 cli/src/cli.ts 兼容入口供 blackbox 与旧脚本使用 ([4a8aacd](https://github.com/freeanima-org/freeanima/commit/4a8aacd0b43d4f4d94549673599f9446bc5a94b6))
* **companion:** companion app 导入时 @/ 别名解析到 companion 源码 ([94bfd4f](https://github.com/freeanima-org/freeanima/commit/94bfd4fe2fb91651847648650ebc0c3c092d3593))
* **companion:** 修复 Windows overlay 失焦后自动出现标题栏 ([6136584](https://github.com/freeanima-org/freeanima/commit/6136584e1c87584e4299307a9397c4df30503f25))
* **companion:** 启动加载改用 spinner，避免窄窗口文字溢出 ([71723e0](https://github.com/freeanima-org/freeanima/commit/71723e0501b0cb5801508221212d704e886544de))
* **companion:** 移除 overlay 窗设置按钮 ([c28ad2e](https://github.com/freeanima-org/freeanima/commit/c28ad2eab06f671eab8c137f58e150210e5f819d))
* **db:** 修复归档列引入后 loadConversationMeta 校验失败 ([3d3d490](https://github.com/freeanima-org/freeanima/commit/3d3d490aa186b79c91626d13c846b13aed539c1a))
* **deps:** 强制 @sinclair/typebox 0.34 以满足 Elysia 启动 ([42420f4](https://github.com/freeanima-org/freeanima/commit/42420f4f470515ae81252b30aab55bfbe8b3af13))
* **dev-web:** 修复 Hub 迁移失败与 dev:web 壳层联调 ([805d3bc](https://github.com/freeanima-org/freeanima/commit/805d3bcd0df557aad07e59790eec693b93efbe49))
* **email:** 修复 IMAP 同步头解析与迁移脚本配置绑定 ([97615c0](https://github.com/freeanima-org/freeanima/commit/97615c0344c57b01870766d81731e3d021aca2f5))
* **goal:** 避免 goal-judge JSON 解析的正则 ReDoS 告警 ([6b893a7](https://github.com/freeanima-org/freeanima/commit/6b893a739fe0f73615b46975f76eec5c7809b86d))
* **i18n:** 统一 site/docs 英文 SSOT 并补齐 PO 中文翻译 ([6d40a75](https://github.com/freeanima-org/freeanima/commit/6d40a758d6b9c167d2127ce8e3402e27ca1a7acf))
* **memory:** 梦境按 created_at 筛选当日情绪记忆 ([234131f](https://github.com/freeanima-org/freeanima/commit/234131f8ba5a3f3f29949c00e64cd05ba1f223e9))
* **mobile:** Android 脚本改用 Vite 构建替代已移除的 build.ts ([1914cca](https://github.com/freeanima-org/freeanima/commit/1914ccad7b2805cb693903fbb20049051a8518c6))
* **mobile:** 修复聊天室键盘遮挡与管理台侧栏 emoji ([1d1f14d](https://github.com/freeanima-org/freeanima/commit/1d1f14d849705ccf7a8a50849a2dc6baa61c6386))
* **parlor:** 修复 SharedWorker 初始化与脚本加载 ([9dd26cc](https://github.com/freeanima-org/freeanima/commit/9dd26cc53efc2d62396311f0edb7127b8bc7d58c))
* **parlor:** 修复 tool call 分段展示并统一 stream-reply reducer ([640a7f8](https://github.com/freeanima-org/freeanima/commit/640a7f80ec419a4218228e55ac59f68dff07de07))
* **parlor:** 迁移 sidecar relay 修复会话列表与 instance 持久化 ([3474277](https://github.com/freeanima-org/freeanima/commit/3474277995c17e66ab2f1912f97263ac0d901282))
* **platform:** slash 命令必有响应，耗时命令先 ack 再出结果 ([8d13231](https://github.com/freeanima-org/freeanima/commit/8d13231d04528ffeb8cc87d6e831ad5eccbee81f))
* **platform:** 移除 Parlor 默认 platform 并迁移至 sap:parlor:{instance} ([aeda08c](https://github.com/freeanima-org/freeanima/commit/aeda08cf1b232432171b243b74394936bea59751))
* **shell-ui:** 修复 bundled 模式导航、样式与聊天室 UX ([2c2ea55](https://github.com/freeanima-org/freeanima/commit/2c2ea55fc4cd37d066755627b46405f0911bbd05))
* **site:** 修复 Paraglide 构建解析与 Mermaid 客户端 i18n ([79fc6b1](https://github.com/freeanima-org/freeanima/commit/79fc6b15782e188214b4e784ba2333654cd0a044))
* **test:** cron-log mock 保留 getCronJob 等导出避免污染 gateway 测试 ([cfaee89](https://github.com/freeanima-org/freeanima/commit/cfaee893542795d8bb7bc26816b8daa5f9813a19))
* **test:** 修复 fridge-bridge  flaky 单测并同步依赖与 CI ([2f6a427](https://github.com/freeanima-org/freeanima/commit/2f6a427afb0e8b6e9b23749491a2a490617115e9))
* **test:** 修复测试套件在 /tmp 下的临时目录泄漏 ([5299240](https://github.com/freeanima-org/freeanima/commit/529924014687415ff443e19f2da0d644c95ad597))
* **tokenizer:** Hub 下载超时并收窄 Ollama 端点探测范围 ([df044b6](https://github.com/freeanima-org/freeanima/commit/df044b64660a1d8dce1a12315bedd00fec09bb82))
* **web:** 修复生产构建深路径刷新白屏 ([eed752c](https://github.com/freeanima-org/freeanima/commit/eed752c48b3ec77c3db2b7f39553403a3e0ab943))


### Performance

* **webui:** 优化 Chamber WebUI 公网访问性能 ([b532efc](https://github.com/freeanima-org/freeanima/commit/b532efc148664ff21bbe78e46c861b3899739658))


### Documentation

* **agents:** 以高层大原则重组 AGENTS.md bootstrap ([dc153dd](https://github.com/freeanima-org/freeanima/commit/dc153dd4ea3dec6a7f5fbaf92dd0e31ea29bec10))
* **guide:** 修正 Admin URL 并同步 agent 规则 ([e79c0df](https://github.com/freeanima-org/freeanima/commit/e79c0dfa065ffcfcc6ebb586b3a01979bf021d2b))
* **rules:** 补全分层依赖矩阵文档 ([4ccd5fc](https://github.com/freeanima-org/freeanima/commit/4ccd5fc87161c875e07d3f8a530b64ec0ad36b20))
* **skill:** 添加多 worktree 开发与 cherry-pick 合入流程 ([e055e01](https://github.com/freeanima-org/freeanima/commit/e055e017ae53047ffd9ecb72adfa3b816d48f503))
* **worktree:** 副 worktree 通过 symlink 复用 node_modules ([0dfc509](https://github.com/freeanima-org/freeanima/commit/0dfc5097d8cf9f4efbd3615f20e37005b11fb572))


### Miscellaneous

* **deps-dev:** bump electron ([630361e](https://github.com/freeanima-org/freeanima/commit/630361eac539c63f6fd214830ef6f1d8261d11a6))
* **deps:** bump the production-dependencies group across 1 directory with 3 updates ([052c733](https://github.com/freeanima-org/freeanima/commit/052c733fca5af99aadfbeed9239cfdb871ddba19))
* **deps:** 升级 drizzle rc.4 并清理遗留依赖与 [@deprecated](https://github.com/deprecated) API ([a978f77](https://github.com/freeanima-org/freeanima/commit/a978f7790f3cd88bb1bf1b13e4a2cf3f4d4f39c7))
* **deps:** 统一 workspace catalog 并同步 lockfile ([86c3d14](https://github.com/freeanima-org/freeanima/commit/86c3d14fe51af84db61d0703f50b9c78cb71d769))
* **security:** 为 tunnel-run 测试占位凭证添加 gitleaks 白名单 ([9620ae4](https://github.com/freeanima-org/freeanima/commit/9620ae4ee18fd9947baa8fb4ed0cae0426a63614))
* 忽略 TS composite 声明产物并移除误提交文件 ([776d79f](https://github.com/freeanima-org/freeanima/commit/776d79ff2887c7a6a1027f7c8de93ad1c109b105))


### Refactoring

* Admin 架构重组与命名统一 ([03407a8](https://github.com/freeanima-org/freeanima/commit/03407a8b39f18d0075f7286033607cc20ed99e6e))
* **build:** 前端构建统一迁移至 Vite ([cfb8fd2](https://github.com/freeanima-org/freeanima/commit/cfb8fd2f7976b8e5a23a7baf4d75ae013632b8ca))
* **core:** Session 领域统一重命名为 Conversation ([5def5c8](https://github.com/freeanima-org/freeanima/commit/5def5c82601c610895c932c18c3e13504b6e5a5d))
* **db:** PG 扁平化，db-pg 迁入 core 并移除 Port 层 ([8c138f1](https://github.com/freeanima-org/freeanima/commit/8c138f1fe572f3adf7726c7de560cddb923ab116))
* **db:** 全栈 snake_case 与 Row/Mapper 类型治理 ([1bf8d54](https://github.com/freeanima-org/freeanima/commit/1bf8d54fa84bd42ea79a25cafaf6d9b415438374))
* **db:** 贯通 Row 类型与 pgTimestamptz 时间语义 ([622406a](https://github.com/freeanima-org/freeanima/commit/622406ad46490d8b624d766a0b0b941adbf5d181))
* **principles:** 对齐 AGENTS 五条原则的首批落地 ([247abab](https://github.com/freeanima-org/freeanima/commit/247abab218df534954963988fe2a7c4165621e74))
* **sap:** 统一三段 platform、Hub instance 分配与三卫星客户端策略 ([0503148](https://github.com/freeanima-org/freeanima/commit/0503148eadc90071171c0f8a2a1906249f99ed1a))
* **satellite:** 将 parlor 重命名为 chat ([819aed7](https://github.com/freeanima-org/freeanima/commit/819aed70926fa6f2f984f5555b45bbc9ef2b04b8))
* **task:** 解绑冰箱贴与任务待办 ([781b401](https://github.com/freeanima-org/freeanima/commit/781b40193ec676b5c5cbad98d92c3dd7f8837e4d))
* **tool:** 拆分任务/邮件 ToolSet 并补齐检索与 remind_at ([037f0b1](https://github.com/freeanima-org/freeanima/commit/037f0b1bef7dd3bc866675ac8486427b146b0154))
* 分层重构与 legacy 清理，合并 task 包并统一壳层基础设施 ([cf6f775](https://github.com/freeanima-org/freeanima/commit/cf6f775cf7d9a525dc11f07c9c27fdecd57fdb67))
* 桌面/移动统一壳层与设置窗 ([83e0b40](https://github.com/freeanima-org/freeanima/commit/83e0b40b2d4b0f56dedd02bcda02b6502b050959))
* 清理废弃 API、迁移脚本与 config shim ([0c9cd8f](https://github.com/freeanima-org/freeanima/commit/0c9cd8f95058f16aeaa02fc83744735d9dbf98e7))
* 清理弃用 API 别名、死代码与兼容层 ([acdff7b](https://github.com/freeanima-org/freeanima/commit/acdff7bbfd470e325fec71b255ef2463ac77de74))
* 设置契约迁入 shell-ui，form/component 分责 ([edd2e87](https://github.com/freeanima-org/freeanima/commit/edd2e8753326bb758b87c494964f0df98853b4bf))


### Tests

* **core:** 补充单元测试提升覆盖率 ([038729a](https://github.com/freeanima-org/freeanima/commit/038729a335e9588421a7665cf7a95a32c00e8163))


### CI

* 修复 Dependabot bun lockfile 并优化 Actions 工作流 ([b3ec44f](https://github.com/freeanima-org/freeanima/commit/b3ec44f3c23d2a3c810dc6644a8b30c5b6e06a1f))

## [0.7.0](https://github.com/freeanima-org/freeanima/compare/v0.6.0...v0.7.0) (2026-06-18)


### ⚠ BREAKING CHANGES

* **tool:** 统一 ToolSet 单数命名与工具面整理
* **session:** ToolSet 粒度缓存与 toolsets 发现流程

### Features

* **cli:** 将 update 改为 upgrade 并按安装方式分派升级逻辑 ([f377b0d](https://github.com/freeanima-org/freeanima/commit/f377b0dd29125d7e35b7d04e7c9860b8a2e35c8d))
* **companion:** 增加多平台 CI 打包并修复浏览器模型加载 ([8c2e3de](https://github.com/freeanima-org/freeanima/commit/8c2e3de38aff6cc67cd6c0e5765d5bbeb27203ba))
* **companion:** 新增桌面伴侣 SAP 卫星与 Windows 打包 ([366f73d](https://github.com/freeanima-org/freeanima/commit/366f73dafca7357bde7a527189534fcc51ea2b67))
* **memory:** deep sleep 增量/全量模式与 WebUI 选择 ([7b49c78](https://github.com/freeanima-org/freeanima/commit/7b49c7868307f82790778f97e9ea3aa3d02126a3))
* **session:** ToolSet 粒度缓存与 toolsets 发现流程 ([caec35e](https://github.com/freeanima-org/freeanima/commit/caec35e16d9ea4e81f335bbee5540c550a88c220))
* **session:** 首条消息 LLM 自动生成标题并优化 Discord 线程命名 ([95586d3](https://github.com/freeanima-org/freeanima/commit/95586d3f512fdcc3cd981a19ac9ae5ffe4ab0dbb))
* **sleep:** sleep-cycle 首步清理过期无效 session ([5e3fa1d](https://github.com/freeanima-org/freeanima/commit/5e3fa1d9e355b8351bd3b7c0386a495fc1af91bc))


### Bug Fixes

* **cli:** 修复 npm 发布包启动与本地安装 ([955a4e2](https://github.com/freeanima-org/freeanima/commit/955a4e2e9a5161ead2ed194b096a5a83640a3146))
* **gateway:** 处理 Discord slash 交互重复确认（40060） ([8c2e3de](https://github.com/freeanima-org/freeanima/commit/8c2e3de38aff6cc67cd6c0e5765d5bbeb27203ba))
* **platform:** 落实 error.log triage 中的稳定性修复 ([53890f7](https://github.com/freeanima-org/freeanima/commit/53890f7c249c378d938ffeb0347647a037b09c40))
* **site:** 修复中文文档加载与文档站 Mermaid/锚点 UX ([cc7da47](https://github.com/freeanima-org/freeanima/commit/cc7da479db3171b0bf72d440769c4345756b983a))
* **webui:** Chamber 工具页展示全量工具集并改为默认工具集 ([40b2c80](https://github.com/freeanima-org/freeanima/commit/40b2c80d201d5cde0ed2f4b8c275dd4ac4536469))


### Miscellaneous

* **deps-dev:** bump the dev-dependencies group across 1 directory with 3 updates ([a7b8f4b](https://github.com/freeanima-org/freeanima/commit/a7b8f4baab2b30d27fb3df0c52f6b76b9940858c))
* **deps:** bump actions/deploy-pages from 4 to 5 ([a559ee6](https://github.com/freeanima-org/freeanima/commit/a559ee65a1719cedc2f58ed01d939bd8779c9c1d))
* **deps:** bump actions/upload-pages-artifact from 3 to 5 ([8947f60](https://github.com/freeanima-org/freeanima/commit/8947f60136dd6d0672fb33f5f7816885ce2aa133))
* **deps:** bump googleapis/release-please-action from 4 to 5 ([b7caa69](https://github.com/freeanima-org/freeanima/commit/b7caa6928c3562786d64ad614fb737ac96280afd))
* **deps:** bump the production-dependencies group across 1 directory with 2 updates ([fdd7c46](https://github.com/freeanima-org/freeanima/commit/fdd7c46221204994376c2bcbb250ecf9d072fb82))


### Refactoring

* **tool:** 统一 ToolSet 单数命名与工具面整理 ([84ce650](https://github.com/freeanima-org/freeanima/commit/84ce65000a8f0a7f98ff75d53fda17a71d19e8c6))


### CI

* Quality 预构建 CLI 并移除测试内联 build ([ca10c3b](https://github.com/freeanima-org/freeanima/commit/ca10c3b41bfe523f6a3c61b9c97298fba2ec35be))
* 新增 install-cli-smoke 作业验证本地 CLI 安装 ([94d28b1](https://github.com/freeanima-org/freeanima/commit/94d28b1bb57c3405cc1772ce792f109abe0acdcf))
* 用 publish 集成测试替代 smoke 并修复 CodeQL ([e5020e2](https://github.com/freeanima-org/freeanima/commit/e5020e2f921ae4b9fc329624c553abfbf4677765))

## [0.6.0](https://github.com/freeanima-org/freeanima/compare/v0.5.0...v0.6.0) (2026-06-15)


### Features

* **i18n:** po4a markdown 管线与 zh_CN PO 全文补译 ([dbf36fa](https://github.com/freeanima-org/freeanima/commit/dbf36faa29741c405bf73f3169ad3baed03bbd79))
* **memory:** 新增做梦机制 ([3bbaa88](https://github.com/freeanima-org/freeanima/commit/3bbaa889015c3016a6aafe7b7cfee0d89e24ccb4))
* **memory:** 统一记忆引用为 [[f-id]] 并扩展语义记忆引用规则 ([ba5db65](https://github.com/freeanima-org/freeanima/commit/ba5db655c359083c9cb24ab0fb6d404445095e65))
* **memory:** 自传概括改为按 significance 分组的提纲式输出 ([526e4cd](https://github.com/freeanima-org/freeanima/commit/526e4cd6af4ae49ea0428839fcda8e2bb36b9a85))
* **sap:** 结对编程 relay 单 Hub WS 与卫星侧 PTY/工具 ([21ea322](https://github.com/freeanima-org/freeanima/commit/21ea322ceb5dc4321e3300988a4b62c36176f7a4))
* **sap:** 落地 SAP/1.0 卫星协议与结对编程卫星骨架 ([a28e66e](https://github.com/freeanima-org/freeanima/commit/a28e66e5f133d042ff6094e5ef1d4577a02a9265))
* **satellite:** 会客厅 Managed 卫星接入 SAP 浏览器直连 ([1b76d33](https://github.com/freeanima-org/freeanima/commit/1b76d3352127f6c2b03c48bfa4ec99a1c4306a81))
* **satellite:** 声明式 satellites 配置与浏览器零 Hub 直连 ([0af2532](https://github.com/freeanima-org/freeanima/commit/0af2532eddb88020c77063a75cb6d5e1b1fa369e))
* **satellite:** 结对编程 API 经 SAP 代理并在 Hub WebUI 自动探测 ([59a8a7c](https://github.com/freeanima-org/freeanima/commit/59a8a7c0412922b2f49bf0439e8e70879ac27395))
* **satellite:** 结对编程 UI 迁出 Hub WebUI 至卫星进程 ([03bc015](https://github.com/freeanima-org/freeanima/commit/03bc0159d98b2c9d4baaf7575507c2563e1d90c2))
* **sleep:** 优化睡眠页、手动运行记日志并修复做梦查询 ([7f9f9d2](https://github.com/freeanima-org/freeanima/commit/7f9f9d236eabbcfc8edf96e07d7b676525f113d0))
* **sleep:** 引入 Pipeline Runner 并将睡眠 cron 合并为 sleep-cycle DAG ([4761ca2](https://github.com/freeanima-org/freeanima/commit/4761ca2eec7150ba40533f81ea2a4351343c68c4))
* **sleep:** 拆分流水线节点历史与 Cron 运行记录 ([2a97561](https://github.com/freeanima-org/freeanima/commit/2a97561a9abeae792c08eef3121c292129ab813e))
* **webui:** 统一 WebUI 与 error.log 的 CST 时间展示格式 ([069c372](https://github.com/freeanima-org/freeanima/commit/069c372a7d6592c0d3f882d11bb2670bf4011f64))


### Bug Fixes

* **acp:** bridge acpSessionUpdatedRef.handler so ACP callbacks fire immediately ([1403926](https://github.com/freeanima-org/freeanima/commit/140392669e66c8fc04d92dcf6b96a9d20e8e5748))
* **cli:** 修复 tiktoken wasm 补丁并补全 CI 构建前置检测 ([887c888](https://github.com/freeanima-org/freeanima/commit/887c8887b48bc35000682de9444ae7ebb9141cc1))
* **db-pg:** 修复 CJK OR 查询非法 tsquery 并增加校验 ([51f3ead](https://github.com/freeanima-org/freeanima/commit/51f3ead40f30b9ca779f03f45c035056b7d74b29))
* **satellite:** Hub ready 后再启托管卫星并统一 SAP transport 重连 ([0b21dc7](https://github.com/freeanima-org/freeanima/commit/0b21dc791633d0b0d71e1c949d83c9d397776122))
* **site:** 修复 Astro 6 文档页正文为空 ([2ea2098](https://github.com/freeanima-org/freeanima/commit/2ea209878b79c9c11e4471c42feb5fb01c41517e))
* **webui:** 修复梦境列表刷新时 Date 字段渲染报错 ([9ada9cd](https://github.com/freeanima-org/freeanima/commit/9ada9cd7f55861260552f85f911fbc5583277700))
* **webui:** 加发送锁防止 Parlor 消息重复发送 ([6b22be5](https://github.com/freeanima-org/freeanima/commit/6b22be5d12aabe2370e0eba24c28baec05d30c14))


### Documentation

* **i18n:** 补全 zh_CN 未翻译条目并同步 po4a 产物 ([2a9f745](https://github.com/freeanima-org/freeanima/commit/2a9f745cf2edc145579fbf7041cbc7aa8dcfe6a6))
* **sap:** 新增 SAP 协议文档目录与中英文翻译 ([000617b](https://github.com/freeanima-org/freeanima/commit/000617b56105dd4a201afdd6640de53c1a48ff95))


### Miscellaneous

* **release:** 将 CHANGELOG 排除出 oxfmt 并统一列表符为 * ([5aa4b21](https://github.com/freeanima-org/freeanima/commit/5aa4b21ac4ddab4fa2a0e62cee03b658563d83bb))


### Refactoring

* **db-pg:** 清零 db.execute 并统一为 Drizzle ORM 查询 ([d6bad7d](https://github.com/freeanima-org/freeanima/commit/d6bad7dc07667ac770e9ce1a3e0967b991c78e8d))
* **platform:** 移除 Hub studio runtime 与 satellites systemd unit ([80fb6df](https://github.com/freeanima-org/freeanima/commit/80fb6df1650a628f332df2ffe59eeb46a5a0f0d4))
* **webui:** 移除 Hub Studio 路由，顶栏改为外链卫星 ([75bd787](https://github.com/freeanima-org/freeanima/commit/75bd787ef68da118ddd4c983c3e292cd890017c5))
* **webui:** 移除睡眠页浅睡/深睡最新卡片 ([9701383](https://github.com/freeanima-org/freeanima/commit/9701383ecf0b67322c8462d8ae89ea699684d6f7))

## [0.5.0](https://github.com/freeanima-org/freeanima/compare/v0.4.0...v0.5.0) (2026-06-12)

### ⚠ BREAKING CHANGES

* **docs:** 重组文档为英文 SSOT 并拆分贡献者规则
* 顶层包结构重构为八层工程模型

### Features

* **acp:** acp_task_status 查询工具 + Discord 5s 就地编辑 tail ([198f89a](https://github.com/freeanima-org/freeanima/commit/198f89ab6ea2fbb3766b03ef07909ddccbcc7d41))
* **acp:** acp_tasks 异步委托 Phase A/B 与多通道 progress 投递 ([b267f03](https://github.com/freeanima-org/freeanima/commit/b267f03eada35fe6c289abd10680160649012975))
* **acp:** 支持同 agent 多任务并行并统一以 acp_session_id 续聊 ([ca2f847](https://github.com/freeanima-org/freeanima/commit/ca2f847c995d28f92ed5e65d1aa4d45a456486b1))
* **cli:** 新增 update 命令并将 memory 回填迁移至 WebUI ([9a29ed5](https://github.com/freeanima-org/freeanima/commit/9a29ed513a997563b0ac9c275fe3b75ca2e437c8))
* **fridge-magnet:** 空内容不注入并统一全称命名 ([9ba42a6](https://github.com/freeanima-org/freeanima/commit/9ba42a605f89c0a4f61f7773dfb967ec2105d4b8))
* **gateway:** 统一消息通道状态层与策略组合出站架构 ([b82a566](https://github.com/freeanima-org/freeanima/commit/b82a5660a3df5e36c91d4a04f1468f946a9ea6da))
* **memory:** 完善语义记忆 pin 生命周期维护 ([e1875f0](https://github.com/freeanima-org/freeanima/commit/e1875f0a67af06b9f4fd453039cd57477e026947))
* **prompt:** Hook 组装系统提示词并常驻 ToolSet 索引 ([37bcc36](https://github.com/freeanima-org/freeanima/commit/37bcc3618eff75c4f9fa8400fb07e628f6dd1260))
* **tasks:** 优化冰箱贴摘要并在启动时同步 ([0047395](https://github.com/freeanima-org/freeanima/commit/0047395cf572cfd90539e45b7ba6a4c4f1b9e443))
* **webui:** Parlor ACP progress dock + SSE 实时推送 ([c53eae3](https://github.com/freeanima-org/freeanima/commit/c53eae3da1cf8db2fe56022ab2c92338c8329245))
* **webui:** 语义记忆页表格化并支持 sort_by 服务端排序 ([4fc8a76](https://github.com/freeanima-org/freeanima/commit/4fc8a767a0186d74a40822fb54ccb1414532e87c))

### Bug Fixes

* **acp:** 修复 ACP 结果未写入 conversation 表 ([3d32e8a](https://github.com/freeanima-org/freeanima/commit/3d32e8ac743931a0be2ff0345efc46da45f2ddf4))
* **ci:** 修复 Quality 检查与 PR 审查意见 ([3d6af39](https://github.com/freeanima-org/freeanima/commit/3d6af39e9b2f0150a91b1d22517790ae9158ca6c))
* **cli:** 修复 npm 包缺少 tiktoken_bg.wasm 导致启动失败 ([4880a59](https://github.com/freeanima-org/freeanima/commit/4880a592477aa48fd7940322fd59cdfd9d4b6c9f))
* **docs:** add missing frontmatter title to docs/guide/service.md ([b8218ee](https://github.com/freeanima-org/freeanima/commit/b8218eef058a801a9467f55104395c43304fdc4e))
* **gateway:** 修复 Discord 助手消息重复发送 ([9265d45](https://github.com/freeanima-org/freeanima/commit/9265d4542bdad85a0a7fa0b26c1c521c9f109ef4))
* **memory:** 修复浅睡 acp_tasks 遗留格式与深睡活跃记忆计数 ([ad67666](https://github.com/freeanima-org/freeanima/commit/ad6766675d990030881eb56f8b697bf691b4708f))
* **service:** 澄清 status 内存指标（RSS 物理内存 vs JSC heap） ([87e33bd](https://github.com/freeanima-org/freeanima/commit/87e33bdecb40214fef4cef69c04f41adf822ae71))
* **webui:** resolveWebuiAppDir 兼容 monorepo 与发布包路径 ([dc203c9](https://github.com/freeanima-org/freeanima/commit/dc203c900d7c53c53090422f10755c0ade27c06a))
* **webui:** 修正 Paraglide 相对路径以适配 platform 层目录 ([f28fdca](https://github.com/freeanima-org/freeanima/commit/f28fdca54895d44f05c369a387d390f796bc14ce))

### Performance

* **service:** 降低启动 RSS 并增强 status 可观测性与 CLI 布局 ([5971544](https://github.com/freeanima-org/freeanima/commit/5971544ec77b8d722050d21606d1ab2c3e707a3a))

### Documentation

* **agents:** 新增原则维护硬约束与分层分流规则 ([f8a726c](https://github.com/freeanima-org/freeanima/commit/f8a726cab89bb302a0b68f0d893ffd7ffd2938bb))
* **guide:** 新增安装文档（npm CLI / Docker / 源码） ([bd22219](https://github.com/freeanima-org/freeanima/commit/bd22219fdaa10f788213ffb55caa8e6d8bfc3a5b))
* 定义五层架构目标与迁移映射 ([833efab](https://github.com/freeanima-org/freeanima/commit/833efabb68bee2b146d4dcc4d28408e3bde19c6d))

### Miscellaneous

* add docs frontmatter title check to pre-commit and CI ([8979cd2](https://github.com/freeanima-org/freeanima/commit/8979cd2df8d50d20d9dbf06b4b8d5b930e908c37))
* 五层架构收尾与文档路径更新 ([611d89a](https://github.com/freeanima-org/freeanima/commit/611d89a0b23ffbc57c430fd8ac6a0e00ca151c5c))
* 清理 deprecated 别名并更新旧路径引用 ([d47c554](https://github.com/freeanima-org/freeanima/commit/d47c554e36d83730b4e12ae87f4bc55853408b61))

### Refactoring

* **capabilities:** 十一包合并为七包 ([68cf1da](https://github.com/freeanima-org/freeanima/commit/68cf1da858d240fae682e2f46bc61b69d58fd480))
* **core:** storage 与 mechanism 十一包合并为 @freeanima/core ([f1840d0](https://github.com/freeanima-org/freeanima/commit/f1840d0afbb1f2327978edbc9ff19cb2306e29b6))
* **db-pg:** 语义记忆 ORM 化并新增 Drizzle 查询规范 ([d63da67](https://github.com/freeanima-org/freeanima/commit/d63da6767af8263d0d55da38528698f80b8ad296))
* **docs:** 重组文档为英文 SSOT 并拆分贡献者规则 ([47de79d](https://github.com/freeanima-org/freeanima/commit/47de79de0a42d54014ae84fa8b2d985d1985fcc5))
* **i18n:** 删除 merge-webui-messages 并统一管线文档 ([18e4e3e](https://github.com/freeanima-org/freeanima/commit/18e4e3eb3ba8300f1abe165248636914eb45893d))
* **kernel:** 合并五子包为单层单包 @freeanima/kernel ([762bb7c](https://github.com/freeanima-org/freeanima/commit/762bb7c3bca228da3b01a8b937086184b8008c5a))
* **platform:** service 与 connectors 合并为 @freeanima/platform ([a5dbc4a](https://github.com/freeanima-org/freeanima/commit/a5dbc4a9b0591abb51e6f8c03915f9376408f389))
* **runtime:** orchestration 五包合并为 @freeanima/runtime ([231f9cb](https://github.com/freeanima-org/freeanima/commit/231f9cb2655db6719af534b5afafe35c8f18e262))
* **service-api:** 合并 RuntimeService 到 AnimaService 统一接口 ([8408199](https://github.com/freeanima-org/freeanima/commit/84081993fdc9e5d9ae3853a045565a110e60ff39))
* **service:** 以 AppRuntime 替代 AnimaService 宽 Facade ([0800485](https://github.com/freeanima-org/freeanima/commit/0800485b1e73f9d48f5332807bc22bc3eed3aca0))
* **service:** 拆分 boot 阶段并统一 RuntimeContext ([affee06](https://github.com/freeanima-org/freeanima/commit/affee06a2d6b63ba2fb933bf5c975fe3d1ba4561))
* 架构瘦身——ConversationService、PgStore、runtime barrel 等 ([281205b](https://github.com/freeanima-org/freeanima/commit/281205b1901f4d0ca74dff04518ef158348855a1))
* 顶层包结构重构为八层工程模型 ([661d767](https://github.com/freeanima-org/freeanima/commit/661d76763ce69ad52640caa235ddf9f03c653b4b))

## [0.4.0](https://github.com/freeanima-org/freeanima/compare/v0.3.11...v0.4.0) (2026-06-11)

### ⚠ BREAKING CHANGES

* **config:** 引入 Config/FileConfig 并移除 loadConfig 全局读
* **agent:** 拆分 AGENTS.md 至 .agent/rules/ 并精简运行时入口
* **eventbus:** 移除 SqliteEventQueue 并统一使用 Redis 后端
* **engine:** 下沉 engine-config 并注入 config/logger，解除 engine 对 service 层依赖
* **kernel:** 将 util/retry 上迁至 engine 层并拆分域 hook

### Features

* **tokenizer:** 增强 Hub 自动 resolve 与可观测性 ([72d260c](https://github.com/freeanima-org/freeanima/commit/72d260ce334f5ff63970c174ba17fa4a2bfd4fb7))
* **tokenizer:** 统一 @huggingface/tokenizers 并收紧 embedding 分块 ([21ca800](https://github.com/freeanima-org/freeanima/commit/21ca8005192722db3e8dbd4026ff9c310f7adde1))
* **webui:** 优化记忆台召回调试页并移除 memory_recall session 过滤 ([458b0b1](https://github.com/freeanima-org/freeanima/commit/458b0b1a7f75a753f28574fc5a2d9d113f4ba3de))

### Bug Fixes

* **ci:** 修复 context stats 集成测并提前触发黑盒 dispatch ([a7e6115](https://github.com/freeanima-org/freeanima/commit/a7e6115957ed676e59ef181a835128f68bfa2629))
* **ci:** 修复 Quality、Gitleaks 与 CodeQL 三项 CI 失败 ([d0a226a](https://github.com/freeanima-org/freeanima/commit/d0a226a9eb7f3a303c99702a99182f3593e4d816))
* **ci:** 修正 storage/db 路径并补全 email 测试 config 绑定 ([43ea509](https://github.com/freeanima-org/freeanima/commit/43ea5095fbe711c092699a8400054169888ec841))
* **embedding:** 修复补向量 rebuild 分页与入库匹配失败 ([6ae9147](https://github.com/freeanima-org/freeanima/commit/6ae91479dd9147bad4cfd02ea7c82ce8db9bc952))
* **test:** session-handoff 改用 spyOn 避免 mock.module 污染 ([c39e4d9](https://github.com/freeanima-org/freeanima/commit/c39e4d96e9837fc55751e20c45e02a8ce6c41a93))
* **tokenizer:** 量化变体名回落 seed 并过滤 Ollama blob hint ([15ca2ad](https://github.com/freeanima-org/freeanima/commit/15ca2ad85652a671efa13415a9d692bf42e7d0e4))

### Documentation

* **agent:** 拆分 AGENTS.md 至 .agent/rules/ 并精简运行时入口 ([d83b5ab](https://github.com/freeanima-org/freeanima/commit/d83b5aba13f6ac0bc69450f582ef22fb3aa56465))

### Refactoring

* **config:** 引入 Config/FileConfig 并移除 loadConfig 全局读 ([97fcb24](https://github.com/freeanima-org/freeanima/commit/97fcb24395dd467fdcde8c78a28c3ef181fca90f))
* **embedding:** 向量 rebuild 逐条读取并算完即入库 ([ca78c5e](https://github.com/freeanima-org/freeanima/commit/ca78c5efe1124f4f3398c4a7a4b39c4781e53875))
* **embedding:** 简化向量写入路径，仅保留长文本切块 ([6875f17](https://github.com/freeanima-org/freeanima/commit/6875f17aa0ae1d1afde0e469472784554c4d2016))
* **engine:** 下沉 engine-config 并注入 config/logger，解除 engine 对 service 层依赖 ([e010788](https://github.com/freeanima-org/freeanima/commit/e01078836f5c50ce4e0b8e3f62bf6449b8ffc57b))
* **eventbus:** 移除 SqliteEventQueue 并统一使用 Redis 后端 ([00bea00](https://github.com/freeanima-org/freeanima/commit/00bea0022be5f58d3f7d7a8ed67c2f754a645db9))
* **kernel:** 将 util/retry 上迁至 engine 层并拆分域 hook ([0c1863f](https://github.com/freeanima-org/freeanima/commit/0c1863f9e9d6906b937775b1ef5912509dbb6d45))

### Tests

* **integration:** wire service ports in test context ([8769501](https://github.com/freeanima-org/freeanima/commit/8769501c4e3a38a93688d82f1798a57e62b0dafc))
* **kernel:** 修复 eventbus 与 hooks 的 func 覆盖率缺口 ([42f9b55](https://github.com/freeanima-org/freeanima/commit/42f9b55ce1ec46de889c257a344643b018f860cf))

### CI

* 优化 GitHub Actions 提速 ([b07a68d](https://github.com/freeanima-org/freeanima/commit/b07a68d4874196381a662e652548748ba0cb9d31))

## [0.3.11](https://github.com/freeanima-org/freeanima/compare/v0.3.10...v0.3.11) (2026-06-10)

### Features

* **embedding:** 按 6K token 动态拼批并支持超长文本分块 ([ef36080](https://github.com/freeanima-org/freeanima/commit/ef360802e6e9df224658ed47f381525f9aff2d4d))
* **i18n:** 接入 Paraglide 与 po4a 统一双语管线 ([938da42](https://github.com/freeanima-org/freeanima/commit/938da4241b18f8a0579fe8b2318a737d841b5c52))
* **site:** 文档站接入 Mermaid 图表渲染 ([5be636d](https://github.com/freeanima-org/freeanima/commit/5be636d26535e263d573a7c5effd9ae092ad2851))
* **site:** 移植多区块落地页并接入 Starlight 暖灰主题 ([7ecfe5f](https://github.com/freeanima-org/freeanima/commit/7ecfe5f6e711754f8bb25ebf450c130f91c78635))
* **tool:** 工具返回 Zod 契约与保真示例 ([937ad84](https://github.com/freeanima-org/freeanima/commit/937ad84485c970c457772f711002c5cf792209eb))
* **webui:** AOT 静态构建与 --dev watch，修复创作室 tab 切换崩溃 ([4f9ae04](https://github.com/freeanima-org/freeanima/commit/4f9ae048a362a8818a8fc0aa4c3d1943d3e5c327))
* **webui:** 卧室新增只读待办任务管理页 ([bddaf4b](https://github.com/freeanima-org/freeanima/commit/bddaf4b89cfbb638d0f5031812e1f0ab84fefc3a))
* **webui:** 新增冰箱贴只读查看页与会客厅紧凑预览 ([4b8d60a](https://github.com/freeanima-org/freeanima/commit/4b8d60aacaa83abc2eb4934bbfe812dbcbb614b2))

### Bug Fixes

* **ci:** 修复 CodeQL 告警与 blackbox dispatch PAT 说明 ([a09fe9f](https://github.com/freeanima-org/freeanima/commit/a09fe9feca0914a8ec570acfffdc52bed9895514))
* **dep-check:** 按包名首段校验 import 并同步 AGENTS ([a8caf2f](https://github.com/freeanima-org/freeanima/commit/a8caf2fe54062f13379208c816bf1566f2a915f5))
* **i18n:** lower po4a opt_keep threshold to 0 to unblock site deploy ([32b2b24](https://github.com/freeanima-org/freeanima/commit/32b2b240b05ab155774320c89b7fde658e2ddb5c))
* **i18n:** use valid po4a keep option syntax ([8e4e424](https://github.com/freeanima-org/freeanima/commit/8e4e424df1b9cb329197dab63082a71067b3eb36))
* **webui:** 修复会客厅 SSE 流式消息丢失 ([27c5866](https://github.com/freeanima-org/freeanima/commit/27c586619d1e30948790cd93efbf3e6fad042502))
* **webui:** 修复睡眠记录页 Date 渲染崩溃与 runs 列表加载失败 ([1f6993a](https://github.com/freeanima-org/freeanima/commit/1f6993a85ab055f05aa645bd8441fd9c1d43031b))
* **webui:** 修复记忆台搜索 observed_at 渲染崩溃 ([87db654](https://github.com/freeanima-org/freeanima/commit/87db65412afd472b28cd04169fdd9c2298c691d3))

### Miscellaneous

* **ci:** 统一使用组织 secret FREEANIMA_CI ([d48215f](https://github.com/freeanima-org/freeanima/commit/d48215f3b8c030553130d905ed0a81aa1e984a69))
* **deps:** 升级 nodemailer 与 astro ([503b1f4](https://github.com/freeanima-org/freeanima/commit/503b1f46afda8688e85288efb1371ef81f5a1aee))
* **release:** 对齐 changelog 列表符与 oxfmt 并约束 Agent 勿改 CHANGELOG ([b10e9f8](https://github.com/freeanima-org/freeanima/commit/b10e9f8a065089641777d8adf9de20c9de5f8b32))
* 删除未使用的 connectors-sqlite 包 ([c57c578](https://github.com/freeanima-org/freeanima/commit/c57c5789fba224f46afb426c85d386731433a28b))

### Refactoring

* **docs:** 重组文档目录并同步站点与 i18n ([691330d](https://github.com/freeanima-org/freeanima/commit/691330d05490683b608b07fcf72f05a8fc26f5e5))
* **engine-db:** runMigrations 支持注入 migrationsFolder ([30239f3](https://github.com/freeanima-org/freeanima/commit/30239f3eebf8f34c0af208593f79bb0df4cfb102))
* **engine-repos:** 下沉 memory-reference 标记解析 ([1ce2b9b](https://github.com/freeanima-org/freeanima/commit/1ce2b9b41d2f6d967b5592b44948e6a1046022b5))
* **i18n:** 代码侧全面英文化 ([d618ea0](https://github.com/freeanima-org/freeanima/commit/d618ea049713a8329fbdb7d852ba711cdbe0ff6c))
* **service-api:** ServiceContext 端口化并移除 capabilities/engine 依赖 ([28acf49](https://github.com/freeanima-org/freeanima/commit/28acf49f50f20d0f34ab9151c1f45cf1f21fa0e8))
* **service-api:** 迁入 display/snapshot/restart 契约 ([c4c3a68](https://github.com/freeanima-org/freeanima/commit/c4c3a687b3ed0c4a2596db92f64c7a37aace17fe))
* **service:** 拆分 register 为 tools/integrations/memory 模块 ([54afa0f](https://github.com/freeanima-org/freeanima/commit/54afa0f90894ec187e8ee867d9eb86680fa6c30a))
* **test:** 黑盒 E2E 迁至 freeanima-testing ([4755120](https://github.com/freeanima-org/freeanima/commit/4755120f4deb8bd407746ea26eca04bf6d189d4e))
* **webui:** handler runtime 绑定与 memory/self 工厂模式 ([727fb69](https://github.com/freeanima-org/freeanima/commit/727fb691b208e23ec29a97c4e215e50de5654da7))
* 移除 [@deprecated](https://github.com/deprecated) API 并完成调用方迁移 ([30781d9](https://github.com/freeanima-org/freeanima/commit/30781d9e9bd5d4e81407d45ae1a9ac77ca51cac1))
* 组合根 store 一次性注入与 FridgeStorePort 反转 ([be3d82f](https://github.com/freeanima-org/freeanima/commit/be3d82f720fd98cf8242409a872f834c66c1838f))

### CI

* **release:** 改用 Release Please 替代 semantic-release ([1510a68](https://github.com/freeanima-org/freeanima/commit/1510a688d5ec47e92b45d484b5efbafb17856d98))

## [0.3.10](https://github.com/freeanima-org/freeanima/compare/v0.3.9...v0.3.10) (2026-06-10)

### Features

* 语义记忆引用计数、浅睡重构与工具命名统一 ([#84](https://github.com/freeanima-org/freeanima/issues/84)) ([4502d02](https://github.com/freeanima-org/freeanima/commit/4502d02a2f6d739e309dde3ff32a672a7d958aaf)), closes [#xxx](https://github.com/freeanima-org/freeanima/issues/xxx)

## [0.3.9](https://github.com/freeanima-org/freeanima/compare/v0.3.8...v0.3.9) (2026-06-09)

### Features

* **commands:** 新增 /restart Slash 命令，异步优雅重启 ([0832883](https://github.com/freeanima-org/freeanima/commit/083288399f65cfe3da0b823083636a825861be5f)), closes [#31](https://github.com/freeanima-org/freeanima/issues/31)
* **embedding:** 写入路径 debounce 批量，重建复用 batch API ([1e0ea33](https://github.com/freeanima-org/freeanima/commit/1e0ea33ce92dea17890cde784970e78bbb9be76c))
* **eventbus:** 新增 Redis 队列 adapter 与 config 后端切换 ([7c94250](https://github.com/freeanima-org/freeanima/commit/7c94250f4651f9dd07eeaee2569e82e4faa1587e))
* **fts:** pg_trgm 模糊检索兜底与 RRF 合并 ([f989681](https://github.com/freeanima-org/freeanima/commit/f9896819378f53808fcec03d58ce7e2f82744025))
* **fts:** pgvector 语义检索与后台索引重建 ([5b15ef8](https://github.com/freeanima-org/freeanima/commit/5b15ef84a9c6ed04e88c9898bfc730337c475374))
* **fts:** 全局 cjk 开关与 jieba 分词索引 ([10c2971](https://github.com/freeanima-org/freeanima/commit/10c29717c901b63a59f5f056a892079958e7b073))
* **tools:** 按需工具加载，注册与 session 挂载解耦 ([21290b6](https://github.com/freeanima-org/freeanima/commit/21290b68aa1459507e661b14dd9f39989b6435e2))
* **webui:** 卧室新增记忆浏览页与自我层展示 ([6c7c9bd](https://github.com/freeanima-org/freeanima/commit/6c7c9bdfe683ae52bdf51bc126c7045c09c5e976))
* **webui:** 新增系统提示词调试页并修复配置块展示 ([03d653c](https://github.com/freeanima-org/freeanima/commit/03d653c0d9bab22b9638a77f7949d20f4e8d3803))
* **webui:** 紧凑化卧室仪表盘布局 ([accced2](https://github.com/freeanima-org/freeanima/commit/accced29b06f06bdb8887e34aeea03005dd6021e))
* **webui:** 邮箱分栏阅读与凭证明文弹窗 ([8d15754](https://github.com/freeanima-org/freeanima/commit/8d157542e76f32e37f4588fb2e2e448397049fdf))

### Bug Fixes

* **ci:** 修复 PG 扩展、loaded_tools lite 读取与 tool 门禁集成测 ([2143b7e](https://github.com/freeanima-org/freeanima/commit/2143b7e883c08ec6a6218704af9fb71aa9d9d09f))
* **ci:** 测试 PG 预装 vector 扩展并消除 CodeQL ReDoS 告警 ([576c8fa](https://github.com/freeanima-org/freeanima/commit/576c8fa4eabaa86366b8947e90f1814116cea6ee))
* **db:** patch drizzle bun-sql 修复 RQB select ([6384f0d](https://github.com/freeanima-org/freeanima/commit/6384f0d15ba35e777d77f9df664535bc4c149d81))
* **fts:** 收紧 CJK tsquery 精度并改用 ts_rank_cd ([038904f](https://github.com/freeanima-org/freeanima/commit/038904fe6abaef14495032a95dae24090e6a0369))
* include tools in session meta lite reads ([ce5266f](https://github.com/freeanima-org/freeanima/commit/ce5266fda9746314f417b834c59a4861eaacecda))
* keep session meta tools for runtime allowlist ([55c1b3f](https://github.com/freeanima-org/freeanima/commit/55c1b3f17b86ad8271a9e106b07bcc6a1cf237fe))
* use --outdir instead of --outfile in build-cli script ([f0ff52f](https://github.com/freeanima-org/freeanima/commit/f0ff52fce94213f98f2c18a8c52a8188fe942cde))

### Miscellaneous

* **engine-db:** 补全历史 migration snapshot 链 ([1454924](https://github.com/freeanima-org/freeanima/commit/14549240748c39a6c973ebbdfc2608c3dad33565))

### Refactoring

* **db-pg:** 收回 CRUD 读路径至 Drizzle RQB ([9f0fba4](https://github.com/freeanima-org/freeanima/commit/9f0fba4123a571e1401bc2061cf323e3f770433c))
* **engine-tool:** 实装单一 ToolSetRegistry 并移除 cron enabled_toolsets ([2cea333](https://github.com/freeanima-org/freeanima/commit/2cea333aa6ce9356c440d4b10e4b08bc2cc7f8a6))
* **service:** 将 Runtime Catalog 收入 Engine 与 ServiceContext ([50d7ef3](https://github.com/freeanima-org/freeanima/commit/50d7ef3c5fbad665b95f790cb9c0cbf4830a8282))
* **test:** 拆分单元/集成/E2E 入口并并行全量 ([bc043ad](https://github.com/freeanima-org/freeanima/commit/bc043adb5212018b59a10d1874cb4a232e690b58))
* **test:** 旁置单元测并统一 Bun.sql PG 驱动 ([af87695](https://github.com/freeanima-org/freeanima/commit/af8769555f5f5896dc01e5d39608f0e6d7171ecd))
* 将 feng-nest 遗留的 nestXXX 命名统一为 animaXXX ([d92bbc2](https://github.com/freeanima-org/freeanima/commit/d92bbc2e084acbf8365ab7adf50f99927e07f0dd))
* 清理迁移兼容层与技术债务 ([1d5d628](https://github.com/freeanima-org/freeanima/commit/1d5d6282c85e7ffb50479bef8ab3792fe3b5862a))
* 移除 JSONL 遗留代码与术语 ([22f823a](https://github.com/freeanima-org/freeanima/commit/22f823a3c120c667636606a1e03b03cb6c3d8a70))

## [0.3.8](https://github.com/freeanima-org/freeanima/compare/v0.3.7...v0.3.8) (2026-06-09)

### Features

* **webui:** add credentials page in chamber ([ad63339](https://github.com/freeanima-org/freeanima/commit/ad63339f9d784cb5977af035681477709eeac79c))

## [0.3.7](https://github.com/freeanima-org/freeanima/compare/v0.3.6...v0.3.7) (2026-06-08)

### Bug Fixes

* **site:** 统一 Header/侧边栏/颜色 ([2fb34b0](https://github.com/freeanima-org/freeanima/commit/2fb34b0780625f0fcef426fb28623242fcba45ac))

## [0.3.6](https://github.com/freeanima-org/freeanima/compare/v0.3.5...v0.3.6) (2026-06-08)

### Bug Fixes

* site CI + Dockerfile 简化 ([957f45d](https://github.com/freeanima-org/freeanima/commit/957f45d0fdb33c6e9a6a6f37bae39a90b22d63fd))

## [0.3.5](https://github.com/freeanima-org/freeanima/compare/v0.3.4...v0.3.5) (2026-06-08)

### Features

* **site:** P0 — Astro + Starlight 脚手架 + 营销首页 ([19fce0d](https://github.com/freeanima-org/freeanima/commit/19fce0db204e34c976e2993827e7b23cb84535fd))
* **site:** P1 — 统一 Header/Footer + 设计 token + Tailwind ([4b51d8b](https://github.com/freeanima-org/freeanima/commit/4b51d8b569016d62aae148fcc72406bac66421ad))
* **site:** P2 + P3 — CI 部署 + docs 接入 Starlight ([673f41c](https://github.com/freeanima-org/freeanima/commit/673f41c8de253b14fbfbf0d8e82a8f4f46e0c6b4))

## [0.3.4](https://github.com/freeanima-org/freeanima/compare/v0.3.3...v0.3.4) (2026-06-08)

### Features

* **estate:** email 模块 — 账户注册表、收发信、WebUI 只读界面 ([bb2f02a](https://github.com/freeanima-org/freeanima/commit/bb2f02a53623849baeb24fa4adea2c4ef826d241))

### Refactoring

* **config:** 统一值展开引擎 — credential/env/明文三种语法 ([c526aa0](https://github.com/freeanima-org/freeanima/commit/c526aa021eefd0aae854cb25f0afec3829ad7dbb))

## [0.3.3](https://github.com/freeanima-org/freeanima/compare/v0.3.2...v0.3.3) (2026-06-08)

### Bug Fixes

* **release:** 使用 RELEASE_PAT 触发下游 Docker workflow ([b4362eb](https://github.com/freeanima-org/freeanima/commit/b4362eb1f14ae512f0794db765a036971cfb8eb9))

## [0.3.2](https://github.com/freeanima-org/freeanima/compare/v0.3.1...v0.3.2) (2026-06-08)

### Bug Fixes

* **release:** 用 bunx npm@11 发布并移除 setup-node ([#70](https://github.com/freeanima-org/freeanima/issues/70)) ([41f76ad](https://github.com/freeanima-org/freeanima/commit/41f76ad21299f417bf090a9e46b8f14a8c276dd9))

### Miscellaneous

* **deps:** bump docker/login-action from 3 to 4 ([#68](https://github.com/freeanima-org/freeanima/issues/68)) ([dcfdd39](https://github.com/freeanima-org/freeanima/commit/dcfdd39fcaa4cb2180f13857f25f00ed8e2b28ef))

## [0.3.1](https://github.com/freeanima-org/freeanima/compare/v0.3.0...v0.3.1) (2026-06-08)

### Bug Fixes

* **release:** 改用 publish-cli.sh 原生 OIDC 发布 CLI ([#69](https://github.com/freeanima-org/freeanima/issues/69)) ([bcdad6a](https://github.com/freeanima-org/freeanima/commit/bcdad6a526355ff85b05b9f4b94805965495d04a))

## [0.3.0](https://github.com/freeanima-org/freeanima/compare/v0.2.1...v0.3.0) (2026-06-08)

### ⚠ BREAKING CHANGES

* **credential:** 严格 YAML 凭证并新增 set 合并更新

### Features

* **ci:** 接入 GitHub Code Coverage 上传 ([612fd35](https://github.com/freeanima-org/freeanima/commit/612fd35dbe9877b5767e211a807d36fea931b654))
* **credential:** 严格 YAML 凭证并新增 set 合并更新 ([8c0a976](https://github.com/freeanima-org/freeanima/commit/8c0a9768c097485041e33d5680fe554ee8933dfb))
* **webui:** 仪表盘展示 PG/Redis 状态并迁移至 Bun 原生 Redis ([a0a0aec](https://github.com/freeanima-org/freeanima/commit/a0a0aecc2d4089eef4679ed0fe3b2390d3333b08))

### Bug Fixes

* **deps:** 修复 openai v6 升级后的 typecheck 与 lint ([67fce0e](https://github.com/freeanima-org/freeanima/commit/67fce0eb48213cd6f8631b20ce7df5d66b0f50dd))
* **release:** 修正 publishConfig.registry 尾斜杠以启用 OIDC ([73bc79d](https://github.com/freeanima-org/freeanima/commit/73bc79d6af9f3e101d575a2317912031c19e2345))
* **security:** 消除 CodeQL 告警的 shell 注入、ReDoS 与随机数偏差 ([ba0c931](https://github.com/freeanima-org/freeanima/commit/ba0c9318d8a9f24848b64d20b4ef5bb2bd1b2bb6))
* **test:** 修复 redis scan mock 的 glob 匹配以消除 CodeQL 告警 ([49c0a00](https://github.com/freeanima-org/freeanima/commit/49c0a00eda642b40448fc135c0081152c622d9cb))

### Miscellaneous

* **ci:** 覆盖率阈值置 0 并移除 bunfig.coverage.toml ([6351281](https://github.com/freeanima-org/freeanima/commit/635128102011fca0dfce7bd35e0d6e60fd3662f5))
* **deps:** bump actions/checkout from 4 to 6 ([04e000e](https://github.com/freeanima-org/freeanima/commit/04e000e7a7db1e81b586104efd59067b7299aa39))
* **deps:** bump actions/setup-node from 4 to 6 ([292e4dc](https://github.com/freeanima-org/freeanima/commit/292e4dc21fd12e0ecd02eac66ac42dcdde4c58ff))
* **deps:** bump docker/build-push-action from 6 to 7 ([302f98e](https://github.com/freeanima-org/freeanima/commit/302f98ef3d295fa50239fbc5c6296ccd43eceaa3))
* **deps:** bump docker/setup-buildx-action from 3 to 4 ([57ddd24](https://github.com/freeanima-org/freeanima/commit/57ddd24db500f374c0e02b956be797167fe2499b))
* **deps:** bump github/codeql-action from 3 to 4 ([12fa0e4](https://github.com/freeanima-org/freeanima/commit/12fa0e4f753d09e8bdb55c97461731b2b572352a))
* **deps:** bump the production-dependencies group with 2 updates ([4ab7c08](https://github.com/freeanima-org/freeanima/commit/4ab7c08ccde050a3adf7df51fce4cf9d56c99745))

### CI

* **release:** 支持 npm Trusted Publishing OIDC 发布 CLI ([94bb7f0](https://github.com/freeanima-org/freeanima/commit/94bb7f00e86aa43b65eac09b1c761103d3fcb7d4))
* **release:** 用 semantic-release/npm 发布 CLI 并精简 workflow ([5fd66cb](https://github.com/freeanima-org/freeanima/commit/5fd66cb20851e478c688c31df5b4c1b96ea62233))
* **release:** 移除 setup-node registry-url 修复 OIDC 鉴权冲突 ([0bea7f3](https://github.com/freeanima-org/freeanima/commit/0bea7f34189e8f8433b25616027ec55959501d8f))
* 重组 workflows 并启用 Dependabot 与安全扫描 ([bc96687](https://github.com/freeanima-org/freeanima/commit/bc96687caec5b25d6a9166bfc76553c144e18e72))

## [0.2.1](https://github.com/freeanima-org/freeanima/compare/v0.2.0...v0.2.1) (2026-06-08)

### Bug Fixes

* **release:** NPM_TOKEN 未配置时跳过 npm 发布 ([4a3c128](https://github.com/freeanima-org/freeanima/commit/4a3c12851a58ea64850320e8b504e132a7c79da3))

## [0.2.0](https://github.com/freeanima-org/freeanima/compare/v0.1.6...v0.2.0) (2026-06-08)

### ⚠ BREAKING CHANGES

* **memory:** 废除记忆层 L 编号，统一语义/情景术语
* **webui:** WebUI HTTP 路径改为 /api/_；终端 WS 为 /api/studio/terminal/ws；
  聊天流式为 POST /api/messages/stream（SSE）。移除 @trpc/_ 与 /api/trpc。
  SPA 仍由 Bun.serve routes 提供，index.html 改为启动时动态加载并在 close 时释放。

Co-authored-by: Cursor <cursoragent@cursor.com>

### Features

* **cron,tools,config:** Phase 0 Bun 原生接入收尾 ([d95d6dc](https://github.com/freeanima-org/freeanima/commit/d95d6dc623fb6688f9c500db50503bac5f796e22)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **db:** Bun.sql 驱动 PoC 与 JSONB 回归 ([0e6864a](https://github.com/freeanima-org/freeanima/commit/0e6864a5289aa7805cb09996bd8febe6975ee438)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **prompt:** 优化 system prompt 两层结构与段落顺序 ([d975e52](https://github.com/freeanima-org/freeanima/commit/d975e524ff7fa92b1536a720badcd3ab55913654)), closes [#6](https://github.com/freeanima-org/freeanima/issues/6)
* **release:** Docker Compose、Bun CLI 打包与 config 环境变量插值 ([00a61db](https://github.com/freeanima-org/freeanima/commit/00a61db67071ad9b8f74ed1157409a5d7e4b7e23)), closes [#3](https://github.com/freeanima-org/freeanima/issues/3)
* **tools:** read_file 与 glob 搜索改用 Bun 原生 API ([90c9dd7](https://github.com/freeanima-org/freeanima/commit/90c9dd77e0383174e5675ed4a92e163668993df7)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **webui:** dev 模式启用 Bun.serve console 回流 ([79166a1](https://github.com/freeanima-org/freeanima/commit/79166a1336b7232f88e9b319fe203b9549578128)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **webui:** 卧室会话列表分页与会话详情页 ([2a971ef](https://github.com/freeanima-org/freeanima/commit/2a971ef260eabd6709e2d7853124ce7854344a79))
* 冰箱贴（fridge-magnet）——跨轮对话临时状态共享黑板 ([4c9f321](https://github.com/freeanima-org/freeanima/commit/4c9f3218518fe1a2bd18e0fbcf7a2ab5edf73526))
* 冰箱贴重构 + 待办清单（tasks）系统 ([1c139c6](https://github.com/freeanima-org/freeanima/commit/1c139c682f0c08a6ca90ef15995fd559449685c6))

### Bug Fixes

* **ci:** 拆分 e2e/gitleaks job 并修复 WebView Chromium 崩溃 ([2cc570c](https://github.com/freeanima-org/freeanima/commit/2cc570c71dcb2d3b7be8bc0906f79af2d292bd14))
* **e2e:** 放宽 WebView smoke 测试超时并指定 CI Chromium 路径 ([559f7af](https://github.com/freeanima-org/freeanima/commit/559f7afd5793a3270e97f096fc85fe92b7caf31c))
* **webui:** 补全 service-config 依赖以修复 CI typecheck ([595b4a7](https://github.com/freeanima-org/freeanima/commit/595b4a71b3461ecb15f7dfb19c57286922c3e252))

### Performance

* **ci:** E2E 用 Playwright Chromium 缓存替代 apt 安装 ([f5723dc](https://github.com/freeanima-org/freeanima/commit/f5723dca16fee6126a01db05644c073faa2700a3))

### Refactoring

* **db-pg:** 移除未使用的 pg-profile 诊断层 ([21c815b](https://github.com/freeanima-org/freeanima/commit/21c815babac5d44918dc1c469348e711e1706537))
* **memory:** 废除记忆层 L 编号，统一语义/情景术语 ([390ab0d](https://github.com/freeanima-org/freeanima/commit/390ab0dc579a3eeaa5c99d78011646e00e9376f8))
* **self:** 彻底清除 SOUL.md 与自我层 seed ([09b22c4](https://github.com/freeanima-org/freeanima/commit/09b22c4e2461ff24c174b85699e6f883d8c1adb9))
* **webui:** 单 Bun.serve 统一 HTTP 与 WebSocket ([c2b5596](https://github.com/freeanima-org/freeanima/commit/c2b5596559c87f90af3a14d98694acf230e14854)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)
* **webui:** 将 API 从 tRPC 迁移至 Elysia REST + Eden Treaty ([0512d9b](https://github.com/freeanima-org/freeanima/commit/0512d9bc64b0e10fad80c1b0e9f6f7039603d086))
* **webui:** 移除卧室记忆文件页面 ([f998c38](https://github.com/freeanima-org/freeanima/commit/f998c38b4eefc953c948319b9305f0c49ea1cd4d))

### Tests

* **e2e:** WebView 卧室 dashboard smoke ([e17b82f](https://github.com/freeanima-org/freeanima/commit/e17b82fd8b05777cc5f9b6fdec886b06ec330d8c)), closes [#9](https://github.com/freeanima-org/freeanima/issues/9)

## [0.1.6](https://github.com/freeanima-org/freeanima/compare/v0.1.5...v0.1.6) (2026-06-07)

### Features

* limbic_memory 建表 + fact_id→semantic_memory_id 术语统一 ([1bd2110](https://github.com/freeanima-org/freeanima/commit/1bd211066af9a53f5c3f026e04cc304730393bd7))
* self_blocks + autobiographical_memory — 自我层独立建表 ([b199157](https://github.com/freeanima-org/freeanima/commit/b19915750dce25f14757fca27e891f5c09120406))
* ToolSet 注册机制（能力面罩基础设施） ([2b7d057](https://github.com/freeanima-org/freeanima/commit/2b7d05748e6fd8b3eda8e7986b989a0403090942))
* 能力面罩（Mask）系统 ([1d036d5](https://github.com/freeanima-org/freeanima/commit/1d036d57a3b3b66507c01676c4f1f117bc407b27))

## [0.1.5](https://github.com/freeanima-org/freeanima/compare/v0.1.4...v0.1.5) (2026-06-07)

### Features

* **acp:** 支持 acp_cursor 异步执行与进度推送 ([99d75c3](https://github.com/freeanima-org/freeanima/commit/99d75c370a023bb8454c355c7d5db5db02cb4539))
* **cron:** migrate storage from file JSON to PostgreSQL + Bun.cron scheduling ([17288e6](https://github.com/freeanima-org/freeanima/commit/17288e60dd945c106643f0fe3915e8479750dde4))
* **memory:** L3 语义记忆从文件系统迁移到 PG ([291a80b](https://github.com/freeanima-org/freeanima/commit/291a80b0e7bee91c452ba260ca0f9210f77448fb))
* **memory:** PG FTS 替代 L2 蒸馏 + L4 SQLite 索引 ([40f7908](https://github.com/freeanima-org/freeanima/commit/40f7908801fe2891e50af62874a476ddcdf1a69c))
* **service:** 启动时自动运行数据库迁移 ([c396491](https://github.com/freeanima-org/freeanima/commit/c3964914b8d9e7a4872b97b104f9e2625d377d40))
* 实现深睡机制 (deep sleep) ([0a82262](https://github.com/freeanima-org/freeanima/commit/0a8226266ed3a339b08ba8d0daebb41d69897642))
* 浅睡替代反思，作为语义记忆唯一增量提取通道 ([7cbd3de](https://github.com/freeanima-org/freeanima/commit/7cbd3ded361e57942511918d5139a84774a6a8b4))

### Bug Fixes

* **acp:** Cursor ACP 新建 session 默认使用 Auto 模型 ([1e4ec78](https://github.com/freeanima-org/freeanima/commit/1e4ec78074b1fb02713567689ab4e92f1f986bb4))
* **cron:** listJobs/getJob gracefully return empty when module not initialized ([e4a60e5](https://github.com/freeanima-org/freeanima/commit/e4a60e50346997cffe72bf1da0fd47795ef88703))
* **cron:** persistJob/runJobById/getJobSync handle uninit gracefully ([bf836ef](https://github.com/freeanima-org/freeanima/commit/bf836ef4d86d64ed2d4602e4afaf7231bc8ba397))
* **engine:** 修复空 assistant 消息导致 DeepSeek 400 错误 ([dace94d](https://github.com/freeanima-org/freeanima/commit/dace94d18f1d32e72f5c7d84f7d17568c8dd0f9d))
* **gateway:** Discord 单条消息超长时自动拆分 ([9a7317f](https://github.com/freeanima-org/freeanima/commit/9a7317fde5c447dce352b8fc7e2af92d610f12f2))
* **life-memory:** add missing engine-loop devDependency ([62e5080](https://github.com/freeanima-org/freeanima/commit/62e50804708f76624ff8d5ab24cca875398ced1c))
* **logging:** error.log 序列化时保留 err.cause 链 ([02a4ae4](https://github.com/freeanima-org/freeanima/commit/02a4ae4e5083a9781c29fadaae7c9ba6e706c189))

### Performance

* **conversation:** 已压缩会话 beginTurn 按 pos 窗口加载 ([b3e61cd](https://github.com/freeanima-org/freeanima/commit/b3e61cdd1f81489f74bd2e7b026f7e53a5d0c05d))
* **service:** 次级路径避免全量消息加载 ([c2049eb](https://github.com/freeanima-org/freeanima/commit/c2049eb94d078513a23f1bd9a68169c5cb642716))

## [0.1.4](https://github.com/freeanima-org/freeanima/compare/v0.1.3...v0.1.4) (2026-06-06)

### Features

* **acp:** 增强 ACP Cursor 长生命周期与多模式支持 ([b6000d5](https://github.com/freeanima-org/freeanima/commit/b6000d5f80ad0d046df00a6c8faef2119fad5575))

## [0.1.3](https://github.com/freeanima-org/freeanima/compare/v0.1.2...v0.1.3) (2026-06-06)

### Bug Fixes

* **ci:** 补全 workspace 直接依赖以修复 typecheck ([5a09702](https://github.com/freeanima-org/freeanima/commit/5a09702a4012ae6d77475e4af400e5b730dadb75))

## [0.1.2](https://github.com/freeanima-org/freeanima/compare/v0.1.1...v0.1.2) (2026-06-05)

### Features

* **discord:** 优化discord遇到网络抖动也会重试，直到最终编辑 ([5463a48](https://github.com/freeanima-org/freeanima/commit/5463a48989693b97aa92c72c21d9fe2cb8231351))
* **engine:** 拆分 engine-tool 与 Engine 聚合包（RFC Step 3） ([cc764f6](https://github.com/freeanima-org/freeanima/commit/cc764f6cb2241e5c1bd10b58d3bd6dd265a9ee92))
* **event-bus:** 新增 EventBus 框架与 Sqlite 适配器并接入 legacy 栈 ([f243347](https://github.com/freeanima-org/freeanima/commit/f24334725d44f4977f10e17198cdb41d60cf9adf))
* **kernel:** Kernel 与 HookRegistry 接入 Logger，统一服务端日志 ([8b737fd](https://github.com/freeanima-org/freeanima/commit/8b737fd9b67f9ed0a1a475ce0f2ce1e7bd7fbca6))
* **kernel:** 新增 hooks 包与 Kernel，legacy 栈迁移至 token Hook API ([17a5bac](https://github.com/freeanima-org/freeanima/commit/17a5bacd4d4dffb5c74c1b801bc10f7f4f264870))
* **life:** 新增 life-self 与 life-estate 空壳包 ([927fe59](https://github.com/freeanima-org/freeanima/commit/927fe59dd4c1fda4d451b451fe613d271496b0e2))
* **llm:** 切换到新的llm provider ([16fcd59](https://github.com/freeanima-org/freeanima/commit/16fcd598d7e1ec08da0c60e94d9a2658c74d23f0))
* **llm:** 增加llm接口层和openai的实现 ([205724c](https://github.com/freeanima-org/freeanima/commit/205724c1c03b60be2339b8d9f57b9692ef6c38f1))
* **logging:** 新增 @freeanima/logging 内核日志契约与内置 sink ([3e95c98](https://github.com/freeanima-org/freeanima/commit/3e95c98c7c8534f7bec437a7396d88b93327df5c))
* **logging:** 新增 file sink 并抽取共用格式化逻辑 ([106eaaa](https://github.com/freeanima-org/freeanima/commit/106eaaa53b53669f2ba4480403e2d996ceedb9b5))
* **service:** K1 新建 @freeanima/platform 注册 hub ([a35d965](https://github.com/freeanima-org/freeanima/commit/a35d96587b52831bad3f3cf22e50068dac80b094))
* **webui:** Bun fullstack + tRPC 全链路，移除 Vite/TanStack Start ([dda1b2e](https://github.com/freeanima-org/freeanima/commit/dda1b2e549d350f1681de04499cbc13cbf01a150))
* 阶梯重试与日志治理，合并 Agent 文档 ([6f4719d](https://github.com/freeanima-org/freeanima/commit/6f4719d2b4c571789aa754c51e6b3f72196d9241))

### Bug Fixes

* **ci:** 修复 release workflow 因缺少 config 导致测试超时 ([1dbd8e6](https://github.com/freeanima-org/freeanima/commit/1dbd8e64855f6edd2353c71005d3c3fc78b1f621)), closes [freeanima-org/freeanima#18](https://github.com/freeanima-org/freeanima/issues/18)
* **discord:** 修复消息卡在思考中与 👀 反应不更新 ([b2a7af7](https://github.com/freeanima-org/freeanima/commit/b2a7af7d32bf44e1c7678a6dd7012b93d3ea15ab)), closes [#7](https://github.com/freeanima-org/freeanima/issues/7)
* **gateway:** 修复 Discord 单回合内 tool 与答案消息顺序混乱 ([2af0861](https://github.com/freeanima-org/freeanima/commit/2af0861fb49d156ed69f6f3444e2f0efccbf72f0)), closes [#17](https://github.com/freeanima-org/freeanima/issues/17)
* **gateway:** 修复微信出站并重构工具消息分片展示 ([a4c9bf2](https://github.com/freeanima-org/freeanima/commit/a4c9bf2d9173ce38ab8159f1e946571d82ed5797))
* **test:** 修复 CI 无 config.yaml 时测试失败 ([10f9de2](https://github.com/freeanima-org/freeanima/commit/10f9de2e61182b1e69d029024cbde47d71d5f2bf))
* **test:** 隔离单测 error.log 并增强 Gateway 诊断 ([e292e36](https://github.com/freeanima-org/freeanima/commit/e292e366abaa319f3ea6d176fa053dc8511a0bd1))
* **webui:** systemd 启动时 chdir 到仓库根以加载 Tailwind 插件 ([81b736a](https://github.com/freeanima-org/freeanima/commit/81b736a0bd560d56fad73c312f6259dfe8ff13ed))

## [0.1.1](https://github.com/freeanima-org/freeanima/compare/v0.1.0...v0.1.1) (2026-06-01)

### Features

* 增加discord的自动重连机制 ([a5c5dd5](https://github.com/freeanima-org/freeanima/commit/a5c5dd59150c696d169d0e87fee47f9acb5a9895))

## 0.1.0 (2026-06-01)

### Features

* **Agent 运行时**：`anima service`（systemd）、Hono HTTP / SSE、WebUI（会客厅 / 卧室 / 创作室）
* **Gateway**：Discord、微信 iLink；按 platform / thread / peer 路由会话
* **记忆 L1–L4**：PostgreSQL Session、L2 蒸馏、L3 事实库（`recall` / `remember`）、L4 检索
* **工具**：本地 / MCP / ACP 注册；`execute_code`、浏览器、Cron、推送等
* **凭证**：pass GPG；CLI `credential list|get|add`（YAML 多字段）；LLM 仅见路径元数据
* **工程**：pnpm + turbo monorepo；Vitest；GitHub Actions + semantic-release 发版

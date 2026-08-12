/** Starlight 侧栏：中文 label + link（无 i18n） */
export const starlightSidebar = [
  { label: "首页", link: "/" },
  {
    label: "文档",
    items: [
      { label: "概述", link: "/docs/" },
      {
        label: "产品",
        collapsed: true,
        items: [
          { label: "架构", link: "/docs/product/architecture/" },
          { label: "身份定位", link: "/docs/product/identity/" },
          { label: "实体模型", link: "/docs/product/entity-model/" },
          { label: "Anima URI", link: "/docs/product/anima-uri/" },
        ],
      },
      {
        label: "认知",
        collapsed: true,
        items: [
          { label: "记忆体系", link: "/docs/cognition/memory/" },
          { label: "压缩", link: "/docs/cognition/compression/" },
          { label: "睡眠机制", link: "/docs/cognition/sleep/" },
          { label: "梦境", link: "/docs/cognition/dream/" },
          { label: "自我层", link: "/docs/cognition/self-layer/" },
          { label: "时间感知", link: "/docs/cognition/time-perception/" },
          { label: "Temporal summary", link: "/docs/cognition/temporal-summary/" },
          { label: "回忆流程", link: "/docs/cognition/recall-flow/" },
          { label: "环境感知", link: "/docs/cognition/environment-awareness/" },
          { label: "通知", link: "/docs/cognition/notifications/" },
        ],
      },
      {
        label: "切面",
        collapsed: true,
        items: [
          { label: "Portal 数据面", link: "/docs/aspects/portal-data-plane/" },
          { label: "离线平台", link: "/docs/aspects/offline-platform/" },
          { label: "页面刷新", link: "/docs/aspects/page-refresh/" },
        ],
      },
      {
        label: "模块",
        collapsed: true,
        items: [
          { label: "聊天室", link: "/docs/modules/chat/" },
          { label: "桌面伴侣", link: "/docs/modules/companion/" },
          { label: "日记", link: "/docs/modules/diary/" },
          { label: "会话目标", link: "/docs/modules/goal/" },
          { label: "项目", link: "/docs/modules/project/" },
          { label: "移动端 APP（Android）", link: "/docs/modules/mobile-app/" },
        ],
      },
      {
        label: "工具",
        collapsed: true,
        items: [
          { label: "freeanima_docs", link: "/docs/tools/freeanima-docs/" },
          { label: "代码运行时", link: "/docs/tools/execute-code/" },
          { label: "Camofox 浏览器", link: "/docs/tools/browser/" },
        ],
      },
      {
        label: "运维",
        collapsed: true,
        items: [
          { label: "安装", link: "/docs/ops/install/" },
          { label: "Windows 开发", link: "/docs/ops/windows-dev/" },
          { label: "服务", link: "/docs/ops/service/" },
          { label: "安全", link: "/docs/ops/security/" },
          { label: "数据库", link: "/docs/ops/database/" },
          { label: "远程访问", link: "/docs/ops/remote-access/" },
          { label: "Habitat RPC", link: "/docs/ops/habitat-rpc/" },
          { label: "消息网关", link: "/docs/ops/message-gateway/" },
        ],
      },
    ],
  },
];

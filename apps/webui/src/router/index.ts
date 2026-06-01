import { createRouter, createWebHistory } from "vue-router";

const chamberChildren = [
  { path: "dashboard", name: "chamber-dashboard", component: () => import("../views/chamber/DashboardView.vue") },
  { path: "memory-files", name: "chamber-memory-files", component: () => import("../views/chamber/MemoryFilesView.vue") },
  { path: "sessions", name: "chamber-sessions", component: () => import("../views/chamber/SessionsListView.vue") },
  { path: "memory", name: "chamber-memory", component: () => import("../views/chamber/MemoryView.vue") },
  { path: "config", name: "chamber-config", component: () => import("../views/chamber/ConfigView.vue") },
  { path: "tools", name: "chamber-tools", component: () => import("../views/chamber/ToolsView.vue") },
  { path: "commands", name: "chamber-commands", component: () => import("../views/chamber/CommandsView.vue") },
  { path: "mcp", name: "chamber-mcp", component: () => import("../views/chamber/McpView.vue") },
  { path: "acp", name: "chamber-acp", component: () => import("../views/chamber/AcpView.vue") },
  { path: "cron", name: "chamber-cron", component: () => import("../views/chamber/CronView.vue") },
  { path: "", redirect: { name: "chamber-dashboard" } },
];

/** 旧路径 /workshop → /chamber，保留书签兼容 */
const workshopLegacyRedirects = [
  { path: "/workshop", redirect: "/chamber/dashboard" },
  ...chamberChildren
    .filter((c) => c.path)
    .map((c) => ({
      path: `/workshop/${c.path}`,
      redirect: `/chamber/${c.path}`,
    })),
];

const routes: import('vue-router').RouteRecordRaw[] = [
  { path: "/", redirect: "/parlor/chat" },
  {
    path: "/parlor",
    component: () => import("../views/parlor/ParlorLayout.vue"),
    children: [
      { path: "chat", name: "parlor-chat", component: () => import("../views/parlor/ChatView.vue") },
      { path: "sessions", name: "parlor-sessions", component: () => import("../views/parlor/SessionsView.vue") },
      { path: "", redirect: { name: "parlor-chat" } },
    ],
  },
  {
    path: "/chamber",
    component: () => import("../views/chamber/ChamberLayout.vue"),
    children: chamberChildren,
  },
  {
    path: "/studio",
    component: () => import("../views/studio/StudioLayout.vue"),
    children: [
      {
        path: "pair-programming",
        name: "studio-pair-programming",
        component: () => import("../views/studio/PairProgrammingView.vue"),
      },
      {
        path: "novel",
        name: "studio-novel",
        component: () => import("../views/studio/ComingSoonView.vue"),
        props: {
          title: "📖 长篇小说创作",
          description: "与 Agent 协同构思、分章、改稿的长篇工作台——规划中。",
        },
      },
      {
        path: "short-video",
        name: "studio-short-video",
        component: () => import("../views/studio/ComingSoonView.vue"),
        props: {
          title: "🎬 短视频创作",
          description: "脚本、分镜与素材协同的短视频工作台——规划中。",
        },
      },
      { path: "", redirect: { name: "studio-pair-programming" } },
    ],
  },
  ...workshopLegacyRedirects,
];

export default createRouter({
  history: createWebHistory("/webui/"),
  routes,
});

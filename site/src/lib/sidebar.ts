import { m } from "../../../messages/paraglide/messages.js";

type SidebarMessageFn = (typeof m)["sidebar_home"];

/** Starlight sidebar 需要 en label + zh-CN translation，用 Paraglide 按 locale 取文案 */
function t(fn: SidebarMessageFn): { label: string; translations: { "zh-CN": string } } {
  return {
    label: fn({}, { locale: "en" }),
    translations: { "zh-CN": fn({}, { locale: "zh-cn" }) },
  };
}

export const starlightSidebar = [
  { ...t(m.sidebar_home), link: "/" },
  {
    ...t(m.sidebar_docs),
    items: [
      { ...t(m.sidebar_overview), link: "/docs/" },
      {
        ...t(m.sidebar_product),
        collapsed: true,
        items: [
          { ...t(m.sidebar_architecture), link: "/docs/product/architecture/" },
          { ...t(m.sidebar_identity), link: "/docs/product/identity/" },
          { ...t(m.sidebar_entity_model), link: "/docs/product/entity-model/" },
          { ...t(m.sidebar_anima_uri), link: "/docs/product/anima-uri/" },
        ],
      },
      {
        ...t(m.sidebar_cognition),
        collapsed: true,
        items: [
          { ...t(m.sidebar_memory), link: "/docs/cognition/memory/" },
          { ...t(m.sidebar_compression), link: "/docs/cognition/compression/" },
          { ...t(m.sidebar_sleep), link: "/docs/cognition/sleep/" },
          { ...t(m.sidebar_dream), link: "/docs/cognition/dream/" },
          { ...t(m.sidebar_self_layer), link: "/docs/cognition/self-layer/" },
          { ...t(m.sidebar_time_perception), link: "/docs/cognition/time-perception/" },
          { ...t(m.sidebar_temporal_summary), link: "/docs/cognition/temporal-summary/" },
          { ...t(m.sidebar_recall_flow), link: "/docs/cognition/recall-flow/" },
          { ...t(m.sidebar_environment_awareness), link: "/docs/cognition/environment-awareness/" },
          { ...t(m.sidebar_notifications), link: "/docs/cognition/notifications/" },
        ],
      },
      {
        ...t(m.sidebar_aspects),
        collapsed: true,
        items: [
          { ...t(m.sidebar_portal_data_plane), link: "/docs/aspects/portal-data-plane/" },
          { ...t(m.sidebar_offline_platform), link: "/docs/aspects/offline-platform/" },
          { ...t(m.sidebar_page_refresh), link: "/docs/aspects/page-refresh/" },
        ],
      },
      {
        ...t(m.sidebar_modules),
        collapsed: true,
        items: [
          { ...t(m.sidebar_chat), link: "/docs/modules/chat/" },
          { ...t(m.sidebar_companion), link: "/docs/modules/companion/" },
          { ...t(m.sidebar_diary), link: "/docs/modules/diary/" },
          { ...t(m.sidebar_goal), link: "/docs/modules/goal/" },
          { ...t(m.sidebar_project), link: "/docs/modules/project/" },
          { ...t(m.sidebar_mobile_app), link: "/docs/modules/mobile-app/" },
        ],
      },
      {
        ...t(m.sidebar_tools),
        collapsed: true,
        items: [
          { ...t(m.sidebar_freeanima_docs), link: "/docs/tools/freeanima-docs/" },
          { ...t(m.sidebar_runtimes), link: "/docs/tools/execute-code/" },
          { ...t(m.sidebar_browser), link: "/docs/tools/browser/" },
        ],
      },
      {
        ...t(m.sidebar_ops),
        collapsed: true,
        items: [
          { ...t(m.sidebar_install), link: "/docs/ops/install/" },
          { ...t(m.sidebar_windows_dev), link: "/docs/ops/windows-dev/" },
          { ...t(m.sidebar_service), link: "/docs/ops/service/" },
          { ...t(m.sidebar_security), link: "/docs/ops/security/" },
          { ...t(m.sidebar_database), link: "/docs/ops/database/" },
          { ...t(m.sidebar_remote_access), link: "/docs/ops/remote-access/" },
          { ...t(m.sidebar_habitat_rpc), link: "/docs/ops/habitat-rpc/" },
          { ...t(m.sidebar_message_gateway), link: "/docs/ops/message-gateway/" },
        ],
      },
    ],
  },
];

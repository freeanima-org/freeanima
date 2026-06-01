<template>
  <ResponsiveSidebarLayout title="卧室" subtitle="Chamber">
    <template #sidebar>
      <nav class="flex-1 px-2 pb-3 space-y-1 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          active-class="sidebar-nav-active"
        >
          {{ item.label }}
        </router-link>
      </nav>
    </template>

    <router-view />
  </ResponsiveSidebarLayout>
</template>

<script setup lang="ts">
import ResponsiveSidebarLayout from '../../components/ResponsiveSidebarLayout.vue'

const navItems = [
  { path: '/chamber/dashboard', label: '📊 仪表盘' },
  { path: '/chamber/memory-files', label: '📁 记忆文件' },
  { path: '/chamber/sessions', label: '💬 会话列表' },
  { path: '/chamber/memory', label: '🧠 记忆台' },
  { path: '/chamber/config', label: '⚙️ 配置' },
  { path: '/chamber/tools', label: '🔧 工具' },
  { path: '/chamber/commands', label: '⌨️ 命令' },
  { path: '/chamber/mcp', label: '🔌 MCP' },
  { path: '/chamber/acp', label: '🤝 ACP' },
  { path: '/chamber/cron', label: '⏰ 定时任务' },
]
</script>

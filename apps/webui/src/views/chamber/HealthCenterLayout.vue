<template>
  <ResponsiveSidebarLayout title="维护模式">
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
  { path: '/dashboard', label: '📊 仪表盘' },
  { path: '/memory', label: '🧠 记忆' },
  { path: '/config', label: '⚙️ 配置' },
  { path: '/tools', label: '🔧 工具' },
]
</script>

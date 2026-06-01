<template>
  <div class="h-full flex flex-col min-h-0 overflow-hidden">
    <!-- 结对编程：紧凑顶栏 -->
    <header
      v-if="isPairProgramming"
      class="shrink-0 flex items-center gap-2 px-2 py-1 border-b border-base-300 bg-base-200/80 text-sm"
    >
      <div class="dropdown">
        <button tabindex="0" class="btn btn-ghost btn-xs gap-1">
          🤝 结对编程
          <span class="opacity-50">▾</span>
        </button>
        <ul tabindex="0" class="dropdown-content menu z-50 mt-1 p-1 shadow-lg bg-base-200 rounded-lg w-48 border border-base-300">
          <li v-for="item in navItems" :key="item.path">
            <router-link :to="item.path" class="text-sm" active-class="active">
              {{ item.label }}
              <span v-if="item.comingSoon" class="badge badge-xs badge-ghost ml-1">即将推出</span>
            </router-link>
          </li>
        </ul>
      </div>
      <span class="flex-1" />
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :title="chromeless ? '显示顶栏' : '专注模式'"
        @click="toggleChromeless"
      >
        {{ chromeless ? '⊞' : '⛶' }}
      </button>
    </header>

    <ResponsiveSidebarLayout
      v-if="!isPairProgramming"
      title="创作室"
      subtitle="Studio"
      class="flex-1 min-h-0"
    >
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
            <span v-if="item.comingSoon" class="ml-1 badge badge-xs badge-ghost">即将推出</span>
          </router-link>
        </nav>
      </template>

      <router-view />
    </ResponsiveSidebarLayout>

    <div v-else class="flex-1 min-h-0 overflow-hidden">
      <router-view />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import ResponsiveSidebarLayout from '../../components/ResponsiveSidebarLayout.vue'

const CHROMELESS_KEY = 'studio-chromeless'

const route = useRoute()
const isPairProgramming = computed(() => route.name === 'studio-pair-programming')
const chromeless = ref(false)

function applyChromeless() {
  document.documentElement.classList.toggle(
    'studio-chromeless',
    isPairProgramming.value && chromeless.value,
  )
}

function toggleChromeless() {
  chromeless.value = !chromeless.value
  try {
    localStorage.setItem(CHROMELESS_KEY, chromeless.value ? '1' : '0')
  } catch {
    /* ignore */
  }
  applyChromeless()
}

onMounted(() => {
  try {
    chromeless.value = localStorage.getItem(CHROMELESS_KEY) === '1'
  } catch {
    chromeless.value = false
  }
  applyChromeless()
})

watch(isPairProgramming, applyChromeless)

const navItems = [
  { path: '/studio/pair-programming', label: '🤝 结对编程' },
  { path: '/studio/novel', label: '📖 长篇小说创作', comingSoon: true },
  { path: '/studio/short-video', label: '🎬 短视频创作', comingSoon: true },
]
</script>

<template>
  <div
    class="h-full flex flex-col lg:flex-row min-h-0 relative"
    v-bind="$attrs"
  >
    <!-- 移动端顶栏：展开侧栏 -->
    <div
      class="lg:hidden shrink-0 flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-200"
    >
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-square"
        :aria-expanded="sidebarOpen"
        aria-label="切换导航"
        @click="sidebarOpen = !sidebarOpen"
      >
        ☰
      </button>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-medium truncate">{{ title }}</div>
        <div v-if="subtitle" class="text-xs text-base-content/50 truncate">{{ subtitle }}</div>
      </div>
      <slot name="mobile-actions" />
    </div>

    <!-- 遮罩 -->
    <div
      v-if="sidebarOpen"
      class="lg:hidden fixed inset-0 z-30 bg-black/50"
      @click="sidebarOpen = false"
    />

    <!-- 侧栏 -->
    <aside
      :class="[
        'bg-base-200 flex flex-col shrink-0 border-base-300 z-40',
        'lg:relative lg:w-56 lg:border-r lg:translate-x-0',
        sidebarOpen
          ? 'fixed inset-y-0 left-0 w-[min(85vw,16rem)] border-r shadow-xl'
          : 'max-lg:hidden',
      ]"
    >
      <div
        v-if="showSidebarHeader"
        class="p-3 font-semibold text-sm text-base-content/60 uppercase tracking-wide"
      >
        {{ title }}
        <span
          v-if="subtitle"
          class="block text-xs font-normal normal-case tracking-normal mt-0.5"
        >{{ subtitle }}</span>
      </div>
      <slot name="sidebar" :close="closeSidebar" />
    </aside>

    <!-- 主内容 -->
    <div class="flex-1 min-w-0 min-h-0 overflow-y-auto app-main-padding">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

defineOptions({ inheritAttrs: false })

defineProps<{
  title: string
  subtitle?: string
  /** 侧栏内是否显示标题（会客厅等自定义顶栏时可关） */
  showSidebarHeader?: boolean
}>()

const sidebarOpen = ref(false)
const route = useRoute()

function closeSidebar() {
  sidebarOpen.value = false
}

watch(
  () => route.fullPath,
  () => {
    sidebarOpen.value = false
  },
)

defineExpose({ closeSidebar })
</script>

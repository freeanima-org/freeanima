<template>
  <div class="h-screen flex flex-col" data-theme="dark">
    <header class="app-header shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2 sm:px-4 sm:py-0 sm:h-10 sm:flex-nowrap border-b border-base-300 bg-base-200">
      <span class="text-sm font-medium text-base-content/70 shrink-0">逸灵风</span>
      <div class="flex gap-1 sm:gap-2 w-full sm:w-auto">
        <button
          class="btn btn-xs flex-1 sm:flex-none min-w-0"
          :class="mode === 'parlor' ? 'btn-primary' : 'btn-ghost'"
          title="Parlor"
          @click="switchMode('parlor')"
        >会客厅</button>
        <button
          class="btn btn-xs flex-1 sm:flex-none min-w-0"
          :class="mode === 'chamber' ? 'btn-primary' : 'btn-ghost'"
          title="Chamber"
          @click="switchMode('chamber')"
        >卧室</button>
        <button
          class="btn btn-xs flex-1 sm:flex-none min-w-0"
          :class="mode === 'studio' ? 'btn-primary' : 'btn-ghost'"
          title="Studio"
          @click="switchMode('studio')"
        >创作室</button>
      </div>
    </header>
    <main class="flex-1 min-h-0">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const mode = computed(() => {
  const p = route.path
  if (p.startsWith('/chamber') || p.startsWith('/workshop')) return 'chamber'
  if (p.startsWith('/studio')) return 'studio'
  return 'parlor'
})

function switchMode(target) {
  if (target === 'parlor') {
    if (!route.path.startsWith('/parlor')) {
      router.push('/parlor/chat')
    }
  } else if (target === 'chamber') {
    if (!route.path.startsWith('/chamber') && !route.path.startsWith('/workshop')) {
      router.push('/chamber/dashboard')
    }
  } else if (!route.path.startsWith('/studio')) {
    router.push('/studio/pair-programming')
  }
}
</script>

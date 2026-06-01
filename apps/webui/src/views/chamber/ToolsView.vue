<template>
  <div>
    <h2 class="text-lg font-bold mb-4">🔧 工具</h2>
    <p class="text-sm text-base-content/60 mb-4">已注册的工具列表。</p>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="space-y-3">
      <div v-for="tool in tools" :key="String((tool as Record<string, unknown>).name)" class="card bg-base-200">
        <div class="card-body py-3 px-4">
          <div class="flex items-center justify-between">
            <h3 class="font-mono text-sm font-bold">{{ tool.name }}</h3>
            <span v-if="tool.requires_env" class="badge badge-warning badge-xs">需密钥</span>
          </div>
          <p v-if="tool.description" class="text-xs text-base-content/60">{{ tool.description }}</p>
          <div v-if="tool.parameters" class="mt-1">
            <details>
              <summary class="text-xs cursor-pointer text-base-content/50">参数</summary>
              <pre class="text-xs mt-1 bg-base-300 p-2 rounded overflow-x-auto">{{ JSON.stringify(tool.parameters, null, 2) }}</pre>
            </details>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getTools } from '../../api/client'

const loading = ref(true)
const error = ref('')
const tools = ref<Record<string, unknown>[]>([])

onMounted(async () => {
  try {
    tools.value = (await getTools()) as Record<string, unknown>[]
  } catch (e) {
    error.value = `加载失败: ${e instanceof Error ? e.message : String(e)}`
    tools.value = []
  } finally {
    loading.value = false
  }
})
</script>

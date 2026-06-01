<template>
  <div>
    <h2 class="text-lg font-bold mb-4">记忆文件</h2>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="card bg-base-200">
      <div class="card-body">
        <div v-if="memoryFiles.length === 0" class="text-sm text-base-content/50">无记忆文件</div>
        <div v-else class="space-y-2">
          <div
            v-for="f in memoryFiles"
            :key="f.name"
            class="flex items-center justify-between text-sm"
          >
            <span class="font-mono">{{ f.name }}</span>
            <span class="text-xs text-base-content/50">{{ (f.size / 1024).toFixed(1) }} KB</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { listMemoryFiles } from '../../api/client'

const loading = ref(true)
const error = ref('')
const memoryFiles = ref<{ name: string; size: number }[]>([])

onMounted(async () => {
  const mem = await listMemoryFiles()
  if (mem === null) {
    error.value = '加载记忆文件失败'
  } else {
    memoryFiles.value = mem?.files || []
  }
  loading.value = false
})
</script>

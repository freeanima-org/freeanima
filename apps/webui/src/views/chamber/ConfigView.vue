<template>
  <div>
    <h2 class="text-lg font-bold mb-4">⚙️ 配置</h2>
    <p class="text-sm text-base-content/60 mb-4">逸灵风运行时配置。密钥值已隐藏。</p>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <div v-else class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>键</th>
            <th>值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(v, k) in config" :key="k">
            <td class="font-mono text-xs">{{ k }}</td>
            <td class="font-mono text-xs">{{ maskSecret(k, v) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getConfig } from '../../api/client'

const loading = ref(true)
const error = ref('')
const config = ref<Record<string, unknown>>({})

function maskSecret(key: string, value: unknown) {
  const s = value == null ? '' : String(value)
  if (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret')) {
    return s ? s.slice(0, 8) + '…' : '(空)'
  }
  return s || '(空)'
}

onMounted(async () => {
  try {
    config.value = await getConfig()
  } catch (e) {
    error.value = `加载失败: ${e instanceof Error ? e.message : String(e)}`
    config.value = { app: 'anima', version: '(未知)', _note: '服务端 /config 端点尚未实现' }
  } finally {
    loading.value = false
  }
})
</script>

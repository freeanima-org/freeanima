<template>
  <div>
    <h2 class="text-lg font-bold mb-1">⌨️ Slash 命令</h2>
    <p class="text-sm text-base-content/60 mb-4">
      在对话输入框以 <code class="text-xs">/</code> 开头即可触发。命令按作用域分为两类。
    </p>

    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-dots loading-md"></span>
    </div>

    <template v-else>
      <section v-if="sessionCommands.length" class="mb-6">
        <h3 class="text-sm font-semibold mb-2">当前 session</h3>
        <p class="text-xs text-base-content/50 mb-2">所有平台默认可用（共 {{ sessionCommands.length }} 个）。</p>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th class="w-48">命令</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cmd in sessionCommands" :key="cmd.name">
                <td class="font-mono text-sm">/{{ cmd.name }}</td>
                <td class="text-sm text-base-content/80">{{ cmd.description }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="globalCommands.length">
        <h3 class="text-sm font-semibold mb-2">其它</h3>
        <p class="text-xs text-base-content/50 mb-2">跨 session 或平台级操作（共 {{ globalCommands.length }} 个）。</p>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead>
              <tr>
                <th class="w-48">命令</th>
                <th>说明</th>
                <th class="w-40">平台</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="cmd in globalCommands" :key="cmd.name">
                <td class="font-mono text-sm">/{{ cmd.name }}</td>
                <td class="text-sm text-base-content/80">{{ cmd.description }}</td>
                <td class="text-xs text-base-content/60">{{ formatPlatforms(cmd.platforms) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div v-if="!sessionCommands.length && !globalCommands.length" class="alert alert-info text-sm">
        暂无已注册的 slash 命令。
      </div>
    </template>

    <div v-if="error" class="alert alert-error text-sm mt-4">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { listCommands } from '../../api/client'

const loading = ref(true)
const error = ref('')
const commands = ref([])

const sessionCommands = computed(() =>
  commands.value.filter((c) => c.scope === 'session'),
)
const globalCommands = computed(() =>
  commands.value.filter((c) => c.scope === 'global'),
)

function formatPlatforms(platforms) {
  if (!platforms?.length) return '全部'
  return platforms.join(', ')
}

onMounted(async () => {
  try {
    commands.value = await listCommands({ all: true })
  } catch (e) {
    error.value = `加载失败: ${e instanceof Error ? e.message : String(e)}`
    commands.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="p-4">
    <h2 class="text-lg font-bold mb-4">会话管理</h2>

    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>标题</th>
            <th>会话 ID</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in sessionsStore.sessions" :key="s.id">
            <td class="font-medium">{{ s.title || '（无标题）' }}</td>
            <td class="font-mono text-xs">{{ s.id }}</td>
            <td>{{ formatTime(s.id) }}</td>
            <td>
              <button class="btn btn-ghost btn-xs" @click="selectSession(s.id)">打开</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSessionsStore } from '../../stores/parlor/sessions'

const sessionsStore = useSessionsStore()
const router = useRouter()

function formatTime(id) {
  const p = id.split('_')
  if (p.length >= 2) {
    return `${p[0].slice(0,4)}-${p[0].slice(4,6)}-${p[0].slice(6)} ${p[1].slice(0,2)}:${p[1].slice(2,4)}:${p[1].slice(4,6)}`
  }
  return id
}

function selectSession(id) {
  router.push({ name: 'parlor-chat', query: { session: id } })
}
</script>

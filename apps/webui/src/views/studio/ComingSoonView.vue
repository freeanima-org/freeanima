<template>
  <div class="max-w-xl">
    <h2 class="text-lg font-bold">{{ title }}</h2>
    <p class="text-sm text-base-content/60 mt-2">{{ description }}</p>
    <div class="badge badge-outline mt-6">即将推出</div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '该协同工作台尚在规划中。' },
})
</script>

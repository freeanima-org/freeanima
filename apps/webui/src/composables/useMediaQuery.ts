import { onMounted, onUnmounted, ref, type Ref } from 'vue'

/** 响应式 media query，用于简单移动端分支 */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  onMounted(() => {
    const mq = window.matchMedia(query)
    const update = () => {
      matches.value = mq.matches
    }
    update()
    mq.addEventListener('change', update)
    onUnmounted(() => mq.removeEventListener('change', update))
  })

  return matches
}

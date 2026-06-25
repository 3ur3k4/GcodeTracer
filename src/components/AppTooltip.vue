<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{
  text: string
  sub?: string
}>()

const wrapperRef = ref<HTMLElement | null>(null)
const tooltipRef = ref<HTMLDivElement | null>(null)
const visible = ref(false)
const pos = ref({ top: 0, left: 0 })
let showTimer: ReturnType<typeof setTimeout> | null = null
let triggerEl: HTMLElement | null = null

async function show(): Promise<void> {
  if (showTimer) return
  showTimer = setTimeout(async () => {
    showTimer = null
    visible.value = true
    await nextTick()
    calcPosition()
  }, 500)
}

function hide(): void {
  if (showTimer) { clearTimeout(showTimer); showTimer = null }
  visible.value = false
}

function calcPosition(): void {
  if (!triggerEl || !tooltipRef.value) return
  const rect = triggerEl.getBoundingClientRect()
  const tipW = tooltipRef.value.offsetWidth
  let left = rect.left + rect.width / 2 - tipW / 2
  left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8))
  pos.value = { top: rect.bottom + 6, left }
}

onMounted(() => {
  triggerEl = wrapperRef.value?.firstElementChild as HTMLElement | null
  if (!triggerEl) return
  triggerEl.addEventListener('mouseenter', show)
  triggerEl.addEventListener('mouseleave', hide)
  triggerEl.addEventListener('focus', show)
  triggerEl.addEventListener('blur', hide)
})

onBeforeUnmount(() => {
  hide()
  if (triggerEl) {
    triggerEl.removeEventListener('mouseenter', show)
    triggerEl.removeEventListener('mouseleave', hide)
    triggerEl.removeEventListener('focus', show)
    triggerEl.removeEventListener('blur', hide)
  }
})
</script>

<template>
  <div ref="wrapperRef" class="tooltipWrapper">
    <slot />
    <Teleport to="body">
      <div
        v-if="visible && props.text"
        ref="tooltipRef"
        class="tooltip"
        :style="{ top: `${pos.top}px`, left: `${pos.left}px` }"
      >
        <span class="tooltipText">{{ props.text }}</span>
        <span v-if="props.sub" class="tooltipSub">{{ props.sub }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.tooltipWrapper {
  display: contents;
}
.tooltip {
  position: fixed;
  z-index: 9999;
  padding: 5px 8px;
  background-color: var(--tp);
  color: var(--surface);
  border-radius: 5px;
  font-family: var(--font-sans);
  font-size: 11px;
  white-space: nowrap;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tooltipText {
  font-weight: 500;
}
.tooltipSub {
  font-family: var(--font-mono);
  font-size: 10px;
  opacity: 0.7;
}
</style>

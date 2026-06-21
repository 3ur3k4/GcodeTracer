<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/appStore'
import type { MachineState } from '@shared/ipcContract'

const store = useAppStore()

const STATE_LABEL: Record<MachineState, string> = {
  Idle: 'Idle',
  Run: 'Run',
  Hold: 'Hold',
  Alarm: 'Alarm',
  Door: 'Door',
  Home: 'Home',
  Check: 'Check',
  Unknown: '---',
}

const stateColorVar = computed(() => {
  switch (store.grbl.machineState) {
    case 'Run':
      return 'var(--state-run)'
    case 'Hold':
      return 'var(--state-hold)'
    case 'Alarm':
      return 'var(--state-alarm)'
    default:
      return 'var(--state-idle)'
  }
})

function fmt(n: number): string {
  return n.toFixed(3)
}
</script>

<template>
  <section class="panel">
    <h2 class="title">ステータス</h2>
    <div class="badge" :style="{ color: stateColorVar, borderColor: stateColorVar }">
      {{ STATE_LABEL[store.grbl.machineState] }}
    </div>
    <div class="grid">
      <span class="label">MPos</span>
      <span class="value">X{{ fmt(store.grbl.mpos.x) }} Y{{ fmt(store.grbl.mpos.y) }} Z{{ fmt(store.grbl.mpos.z) }}</span>
      <span class="label">WPos</span>
      <span class="value">X{{ fmt(store.grbl.wpos.x) }} Y{{ fmt(store.grbl.wpos.y) }} Z{{ fmt(store.grbl.wpos.z) }}</span>
    </div>
  </section>
</template>

<style scoped>
.panel {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.badge {
  align-self: flex-start;
  border: 1px solid currentColor;
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  font-weight: 600;
  font-family: var(--font-mono);
}
.grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  font-family: var(--font-mono);
}
.label {
  color: var(--color-text-secondary);
}
.value {
  color: var(--color-text-primary);
}
</style>

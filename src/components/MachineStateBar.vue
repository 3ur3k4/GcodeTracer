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
</script>

<template>
  <div class="bar">
    <span class="dot" :style="{ backgroundColor: stateColorVar }" />
    <span class="label" :style="{ color: stateColorVar }">{{ STATE_LABEL[store.grbl.machineState] }}</span>
  </div>
</template>

<style scoped>
.bar {
  height: 36px;
  flex: none;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.label {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
}
</style>

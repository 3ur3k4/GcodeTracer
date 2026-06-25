<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'

const store = useAppStore()
const ipc = useIpc()

function fmt(n: number): string {
  return n.toFixed(3)
}

function zeroAll(): void {
  ipc.zero('X')
  ipc.zero('Y')
  ipc.zero('Z')
}
</script>

<template>
  <div class="section">
    <div class="grid">
      <span class="colLabel" />
      <span class="colLabel">MPos</span>
      <span class="colLabel">WPos</span>

      <span class="axis">X</span>
      <span class="value">{{ fmt(store.grbl.mpos.x) }}</span>
      <span class="value">{{ fmt(store.grbl.wpos.x) }}</span>

      <span class="axis">Y</span>
      <span class="value">{{ fmt(store.grbl.mpos.y) }}</span>
      <span class="value">{{ fmt(store.grbl.wpos.y) }}</span>

      <span class="axis">Z</span>
      <span class="value">{{ fmt(store.grbl.mpos.z) }}</span>
      <span class="value">{{ fmt(store.grbl.wpos.z) }}</span>
    </div>

    <div class="zeroRow">
      <button class="zeroButton" :disabled="!store.connection.connected" @click="ipc.zero('X')">X=0</button>
      <button class="zeroButton" :disabled="!store.connection.connected" @click="ipc.zero('Y')">Y=0</button>
      <button class="zeroButton" :disabled="!store.connection.connected" @click="ipc.zero('Z')">Z=0</button>
      <button class="zeroButton" :disabled="!store.connection.connected" @click="zeroAll">All</button>
    </div>
  </div>
</template>

<style scoped>
.section {
  padding: 8px 10px 6px;
  border-bottom: 1px solid var(--border);
}
.grid {
  display: grid;
  grid-template-columns: 14px calc((100% - 12px) / 2 - 14px) 1fr;
  gap: 4px;
  align-items: baseline;
}
.colLabel {
  font-size: 10px;
  color: var(--ts);
  text-align: right;
}
.axis {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
  padding-left: 4px;
}
.value {
  font-family: var(--font-mono);
  font-size: 15px;
  color: var(--tp);
  text-align: right;
  letter-spacing: -0.01em;
}
.zeroRow {
  display: flex;
  gap: 4px;
  margin-top: var(--space-2);
}
.zeroButton {
  flex: 1;
  height: 26px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background-color: transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
}
.zeroButton:hover:not(:disabled) {
  background-color: var(--surface2);
  color: var(--tp);
  border-color: var(--ts);
}
.zeroButton:disabled {
  opacity: 0.3;
  pointer-events: none;
}
</style>

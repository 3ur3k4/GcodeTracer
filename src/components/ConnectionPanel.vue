<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'
import type { PortInfo } from '@shared/ipcContract'

const store = useAppStore()
const ipc = useIpc()

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400]

const ports = ref<PortInfo[]>([])
const selectedPath = ref('')
const baudRate = ref(115200)
const isRefreshing = ref(false)

async function refreshPorts(): Promise<void> {
  isRefreshing.value = true
  try {
    ports.value = await ipc.listPorts()
    if (!selectedPath.value && ports.value.length > 0) {
      selectedPath.value = ports.value[0].path
    }
  } finally {
    isRefreshing.value = false
  }
}

function toggleConnection(): void {
  if (store.connection.connected) {
    ipc.disconnect()
  } else if (selectedPath.value) {
    ipc.connect(selectedPath.value, baudRate.value)
  }
}

onMounted(refreshPorts)
</script>

<template>
  <section class="panel">
    <h2 class="title">接続</h2>
    <div class="row">
      <select v-model="selectedPath" class="select" :disabled="store.connection.connected">
        <option v-for="port in ports" :key="port.path" :value="port.path">
          {{ port.path }}{{ port.manufacturer ? ` (${port.manufacturer})` : '' }}
        </option>
      </select>
      <button class="iconButton" :disabled="store.connection.connected || isRefreshing" @click="refreshPorts">
        更新
      </button>
    </div>
    <div class="row">
      <select v-model.number="baudRate" class="select" :disabled="store.connection.connected">
        <option v-for="rate in BAUD_RATES" :key="rate" :value="rate">{{ rate }}</option>
      </select>
      <button class="primaryButton" :disabled="!selectedPath && !store.connection.connected" @click="toggleConnection">
        {{ store.connection.connected ? '切断' : '接続' }}
      </button>
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
.row {
  display: flex;
  gap: var(--space-2);
}
.select {
  flex: 1;
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
}
.iconButton,
.primaryButton {
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
.primaryButton {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-black);
  font-weight: 600;
}
.iconButton:disabled,
.primaryButton:disabled {
  opacity: 0.5;
}
</style>

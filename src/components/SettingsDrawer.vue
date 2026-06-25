<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'
import { X } from '@lucide/vue'
import type { PortInfo } from '@shared/ipcContract'

defineEmits<{ close: [] }>()

const store = useAppStore()
const ipc = useIpc()

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400]

const POLL_INTERVALS = [100, 200, 250, 500, 1000]

const ports = ref<PortInfo[]>([])
const selectedPath = ref('')
const baudRate = ref(115200)
const pollIntervalMs = ref(250)

const oscForm = reactive({ ip: store.osc.ip, port: store.osc.port })

async function refreshPorts(): Promise<void> {
  ports.value = await ipc.listPorts()
  if (!selectedPath.value && ports.value.length > 0) {
    selectedPath.value = ports.value[0].path
  }
}

function applyPollInterval(): void {
  ipc.setPollInterval(pollIntervalMs.value)
}

function toggleConnection(): void {
  if (store.connection.connected) {
    ipc.disconnect()
  } else if (selectedPath.value) {
    ipc.connect(selectedPath.value, baudRate.value)
  }
}

function applyOsc(): void {
  ipc.updateOscSettings(oscForm.ip, oscForm.port, store.osc.enabled)
}

function toggleOscEnabled(): void {
  ipc.updateOscSettings(oscForm.ip, oscForm.port, !store.osc.enabled)
}

onMounted(refreshPorts)
</script>

<template>
  <div class="drawer">
    <button class="closeButton" aria-label="閉じる" @click="$emit('close')">
      <X :size="16" :stroke-width="1.75" />
    </button>
    <div class="columns">
      <section class="column">
        <h3 class="columnTitle">Serial</h3>
        <label class="field">
          <span class="fieldLabel">Port</span>
          <select v-model="selectedPath" class="select" :disabled="store.connection.connected">
            <option v-for="port in ports" :key="port.path" :value="port.path">
              {{ port.path }}{{ port.manufacturer ? ` (${port.manufacturer})` : '' }}
            </option>
          </select>
        </label>
        <label class="field">
          <span class="fieldLabel">Baud rate</span>
          <select v-model.number="baudRate" class="select" :disabled="store.connection.connected">
            <option v-for="rate in BAUD_RATES" :key="rate" :value="rate">{{ rate }}</option>
          </select>
        </label>
        <button class="connectButton" :disabled="!selectedPath && !store.connection.connected" @click="toggleConnection">
          {{ store.connection.connected ? 'Disconnect' : 'Connect' }}
        </button>
        <label class="field">
          <span class="fieldLabel">Poll interval</span>
          <select v-model.number="pollIntervalMs" class="select" :disabled="!store.connection.connected" @change="applyPollInterval">
            <option v-for="ms in POLL_INTERVALS" :key="ms" :value="ms">{{ ms }} ms</option>
          </select>
        </label>
      </section>

      <section class="column">
        <h3 class="columnTitle">OSC</h3>
        <label class="field">
          <span class="fieldLabel">IP address</span>
          <input v-model="oscForm.ip" class="input" type="text" placeholder="127.0.0.1" @change="applyOsc" />
        </label>
        <label class="field">
          <span class="fieldLabel">Port</span>
          <input v-model.number="oscForm.port" class="input" type="text" inputmode="numeric" @change="applyOsc" />
        </label>
        <label class="toggleRow">
          <span class="fieldLabel">Enable</span>
          <button class="toggle" :class="{ on: store.osc.enabled }" @click="toggleOscEnabled">
            <span class="toggleKnob" />
          </button>
        </label>
      </section>
    </div>
  </div>
</template>

<style scoped>
.drawer {
  position: relative;
  background-color: var(--surface);
  border-bottom: 1px solid var(--border);
  border-left: 1px solid var(--border);
  padding: 10px 14px 12px;
}
.closeButton {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  border: none;
  background-color: transparent;
  color: var(--ts);
}
.closeButton:hover {
  color: var(--tp);
}
.columns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.columnTitle {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ts);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.fieldLabel {
  font-size: 11px;
  color: var(--ts);
}
.select,
.input {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--tp);
  background-color: var(--surface2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 7px 8px;
}
.select:disabled,
.input:disabled {
  opacity: 0.5;
}
.connectButton {
  width: 100%;
  margin-top: var(--space-1);
  padding: 8px 0;
  font-size: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--accent);
  color: #111111;
  font-weight: 600;
}
.connectButton:disabled {
  opacity: 0.5;
}
.toggleRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.toggle {
  width: 36px;
  height: 20px;
  border-radius: 10px;
  border: none;
  background-color: var(--border);
  padding: 2px;
  display: flex;
  justify-content: flex-start;
}
.toggle.on {
  background-color: var(--accent);
  justify-content: flex-end;
}
.toggleKnob {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background-color: var(--surface);
}
</style>

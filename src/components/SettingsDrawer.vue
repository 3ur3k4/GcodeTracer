<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'
import { BASE_PX_PER_MM, useDisplayCalibration } from '@/composables/useDisplayCalibration'
import { RefreshCw, X } from '@lucide/vue'
import type { PortInfo } from '@shared/ipcContract'
import AppSelect from '@/components/AppSelect.vue'

defineEmits<{ close: [] }>()

const store = useAppStore()
const ipc = useIpc()

const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400]
const POLL_INTERVALS = [10, 20, 50, 100, 200, 500, 1000]

const ports = ref<PortInfo[]>([])
const isRefreshing = ref(false)

// serialForm はストアで管理 — Drawer を閉じても値が保持される
const selectedPath = computed({
  get: () => store.serialForm.path,
  set: (v) => { store.serialForm.path = v },
})
const baudRate = computed({
  get: () => store.serialForm.baudRate,
  set: (v) => { store.serialForm.baudRate = v },
})
const pollIntervalMs = computed({
  get: () => store.serialForm.pollIntervalMs,
  set: (v) => { store.serialForm.pollIntervalMs = v },
})

const oscForm = reactive({ ip: store.osc.ip, port: store.osc.port })

function isArduinoPort(port: PortInfo): boolean {
  return !!(port.manufacturer?.toLowerCase().includes('arduino') || port.manufacturer?.toLowerCase().includes('wch'))
}

const sortedPorts = computed(() => {
  return [...ports.value].sort((a, b) => {
    const aIsArduino = isArduinoPort(a) ? 0 : 1
    const bIsArduino = isArduinoPort(b) ? 0 : 1
    return aIsArduino - bIsArduino
  })
})

const portOptions = computed(() =>
  sortedPorts.value.map((p) => ({
    value: p.path,
    label: `${p.path}${p.manufacturer ? ` (${p.manufacturer})` : ''}`,
    badge: isArduinoPort(p) ? '★' : undefined,
  })),
)

const baudOptions = BAUD_RATES.map((r) => ({ value: r, label: String(r) }))
const pollOptions = POLL_INTERVALS.map((ms) => ({ value: ms, label: `${ms} ms` }))

async function refreshPorts(): Promise<void> {
  isRefreshing.value = true
  try {
    ports.value = await ipc.listPorts()
    if (!selectedPath.value && sortedPorts.value.length > 0) {
      selectedPath.value = sortedPorts.value[0].path
    }
  } finally {
    isRefreshing.value = false
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

// --- Display calibration ---
const CAL_REF_MM = 50
const { calibrationFactor, lastMeasuredMm: measuredMm, save: saveCalibration, reset: resetCalibration } = useDisplayCalibration()
// Bar is always the CSS-standard width — user measures this fixed reference with a ruler
const refBarPx = CAL_REF_MM * BASE_PX_PER_MM

function applyCalibration(): void {
  if (measuredMm.value <= 0) return
  saveCalibration(CAL_REF_MM / measuredMm.value, measuredMm.value)
}

function handleResetCalibration(): void {
  resetCalibration(CAL_REF_MM)
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
        <div class="field">
          <div class="fieldLabelRow">
            <span class="fieldLabel">Port</span>
            <button class="reloadButton" :class="{ spinning: isRefreshing }" :disabled="store.connection.connected || isRefreshing" title="ポート一覧を更新" @click="refreshPorts">
              <RefreshCw :size="12" :stroke-width="1.75" />
            </button>
          </div>
          <AppSelect v-model="selectedPath" :options="portOptions" :disabled="store.connection.connected" />
        </div>
        <div class="field">
          <span class="fieldLabel">Baud rate</span>
          <AppSelect v-model="baudRate" :options="baudOptions" :disabled="store.connection.connected" />
        </div>
        <button
          class="connectButton"
          :class="{ disconnect: store.connection.connected }"
          :disabled="!selectedPath && !store.connection.connected"
          @click="toggleConnection"
        >
          {{ store.connection.connected ? 'Disconnect' : 'Connect' }}
        </button>
        <div class="field">
          <span class="fieldLabel">Poll interval</span>
          <AppSelect v-model="pollIntervalMs" :options="pollOptions" :disabled="!store.connection.connected" @update:model-value="applyPollInterval" />
        </div>
      </section>

      <section class="column">
        <h3 class="columnTitle">Display</h3>
        <div class="field">
          <span class="fieldLabel">実寸キャリブレーション</span>
          <div class="calRefTrack">
            <div class="calRefBar" :style="{ width: refBarPx + 'px' }" />
          </div>
          <span class="calRefLabel">↑ {{ CAL_REF_MM }} mm 基準線</span>
        </div>
        <label class="field">
          <span class="fieldLabel">定規での実測値 (mm)</span>
          <input
            v-model.number="measuredMm"
            class="input"
            type="number"
            min="1"
            step="0.5"
            @keydown.enter="applyCalibration"
          />
        </label>
        <div class="calActions">
          <button class="applyButton" @click="applyCalibration">適用</button>
          <button class="resetButton" @click="handleResetCalibration">リセット</button>
        </div>
        <span class="calStatus">補正係数：×{{ calibrationFactor.toFixed(3) }}</span>
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
  width: 240px;
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
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.column + .column {
  padding-top: 10px;
  border-top: 1px solid var(--border);
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
.fieldLabelRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.reloadButton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  border: none;
  background: transparent;
  color: var(--ts);
  padding: 0;
}
.reloadButton:hover:not(:disabled) {
  color: var(--tp);
  background-color: var(--surface2);
}
.reloadButton:disabled {
  opacity: 0.3;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.reloadButton.spinning svg {
  animation: spin 0.6s linear infinite;
}
.connectButton {
  width: 100%;
  margin-top: var(--space-1);
  padding: 8px 0;
  font-size: 12px;
  border: none;
  border-radius: var(--radius-sm);
  background-color: var(--accent);
  color: var(--surface);
  font-weight: 600;
}
.connectButton.disconnect {
  background-color: var(--danger);
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
.calRefTrack {
  height: 20px;
  overflow: hidden;
  display: flex;
  align-items: center;
}
.calRefBar {
  height: 8px;
  min-width: 4px;
  max-width: 100%;
  background-color: var(--accent);
  border-radius: 2px;
  flex-shrink: 0;
}
.calRefLabel {
  font-size: 10px;
  color: var(--ts);
}
.calActions {
  display: flex;
  gap: var(--space-1);
}
.applyButton,
.resetButton {
  flex: 1;
  padding: 6px 0;
  font-size: 11px;
  border: none;
  border-radius: var(--radius-sm);
  font-weight: 600;
}
.applyButton {
  background-color: var(--accent);
  color: var(--surface);
}
.resetButton {
  background-color: var(--surface2);
  color: var(--ts);
  border: 1px solid var(--border);
}
.calStatus {
  font-size: 10px;
  color: var(--ts);
  font-family: var(--font-mono);
}
</style>

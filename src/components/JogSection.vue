<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  Crosshair,
} from '@lucide/vue'
import AppTooltip from '@/components/AppTooltip.vue'

const store = useAppStore()
const ipc = useIpc()

const STEP_SIZES = [0.1, 1, 10, 100]
const stepSize = ref(1)
const customStepInput = ref('')
const isCustom = ref(false)

function selectPreset(size: number): void {
  stepSize.value = size
  isCustom.value = false
  customStepInput.value = ''
}

function applyCustomStep(): void {
  const val = parseFloat(customStepInput.value)
  if (val > 0) {
    stepSize.value = val
    isCustom.value = true
  }
}

const jogDisabled = computed(() => !store.connection.connected || store.grbl.machineState === 'Alarm')

function jog(x: number, y: number, z: number): void {
  if (jogDisabled.value) return
  ipc.jog(x, y, z, stepSize.value)
}
</script>

<template>
  <div class="section">
    <div class="pads">
      <div class="xyPad" :class="{ disabled: jogDisabled }">
        <AppTooltip :text="`X-${stepSize} Y+${stepSize}`"><button class="padButton" aria-label="左上" @click="jog(-1, 1, 0)"><ArrowUpLeft :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`Y+${stepSize}`"><button class="padButton" aria-label="上" @click="jog(0, 1, 0)"><ArrowUp :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`X+${stepSize} Y+${stepSize}`"><button class="padButton" aria-label="右上" @click="jog(1, 1, 0)"><ArrowUpRight :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`X-${stepSize}`"><button class="padButton" aria-label="左" @click="jog(-1, 0, 0)"><ArrowLeft :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <span class="padCenter" aria-hidden="true"><span class="centerDot" /></span>
        <AppTooltip :text="`X+${stepSize}`"><button class="padButton" aria-label="右" @click="jog(1, 0, 0)"><ArrowRight :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`X-${stepSize} Y-${stepSize}`"><button class="padButton" aria-label="左下" @click="jog(-1, -1, 0)"><ArrowDownLeft :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`Y-${stepSize}`"><button class="padButton" aria-label="下" @click="jog(0, -1, 0)"><ArrowDown :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`X+${stepSize} Y-${stepSize}`"><button class="padButton" aria-label="右下" @click="jog(1, -1, 0)"><ArrowDownRight :size="20" :stroke-width="1.5" /></button></AppTooltip>
      </div>
      <div class="zPad" :class="{ disabled: jogDisabled }">
        <AppTooltip :text="`Z+${stepSize}`"><button class="padButton" aria-label="Z+" @click="jog(0, 0, 1)"><ChevronUp :size="20" :stroke-width="1.5" /></button></AppTooltip>
        <AppTooltip :text="`Z-${stepSize}`"><button class="padButton" aria-label="Z-" @click="jog(0, 0, -1)"><ChevronDown :size="20" :stroke-width="1.5" /></button></AppTooltip>
      </div>
    </div>

    <div class="stepRow">
      <span class="stepUnit">mm</span>
      <button
        v-for="size in STEP_SIZES"
        :key="size"
        class="stepButton"
        :class="{ active: !isCustom && stepSize === size }"
        @click="selectPreset(size)"
      >
        {{ size }}
      </button>
      <input
        v-model="customStepInput"
        class="stepInput"
        :class="{ active: isCustom }"
        type="number"
        min="0.001"
        step="any"
        placeholder="…"
        @change="applyCustomStep"
        @keydown.enter="applyCustomStep"
      />
    </div>

    <div class="actionRow">
      <AppTooltip text="ワークゼロへ移動" sub="G0 X0 Y0">
        <button class="actionButton" :disabled="!store.connection.connected" aria-label="ワークゼロへ移動" @click="ipc.gotoWorkZero()">
          <Crosshair :size="20" :stroke-width="1.5" />
          <span class="actionLabel">Work Zero</span>
        </button>
      </AppTooltip>
    </div>
  </div>
</template>

<style scoped>
.section {
  padding: 8px 10px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.pads {
  display: grid;
  grid-template-columns: 3fr 1fr;
  gap: 3px;
  align-items: center;
}
.xyPad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
}
.xyPad.disabled,
.zPad.disabled {
  pointer-events: none;
  opacity: 0.4;
}
.padCenter {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
}
.centerDot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: var(--ts);
}
.zPad {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-self: stretch;
}
.padButton {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--border);
  background-color: var(--surface2);
  color: var(--tp);
}
.padButton:hover {
  background-color: var(--surface);
}
.padButton:active {
  transform: scale(0.94);
}
.stepRow {
  display: flex;
  align-items: center;
  gap: 4px;
}
.stepUnit {
  font-size: 10px;
  color: var(--ts);
  margin-right: 2px;
}
.stepButton {
  flex: 1;
  height: 26px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background-color: transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
}
.stepButton.active {
  background-color: var(--surface2);
  border-color: var(--ts);
  color: var(--tp);
}
.stepInput {
  width: 44px;
  height: 26px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background-color: transparent;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
  padding: 0 4px;
  text-align: center;
}
.stepInput.active {
  border-color: var(--ts);
  color: var(--tp);
  background-color: var(--surface2);
}
.stepInput::-webkit-inner-spin-button,
.stepInput::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
.actionRow {
  display: flex;
  gap: 4px;
}
.actionButton {
  flex: 1;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background-color: transparent;
  color: var(--ts);
}
.actionButton:hover:not(:disabled) {
  background-color: var(--surface2);
}
.actionButton:disabled {
  opacity: 0.3;
  pointer-events: none;
}
.actionLabel {
  font-size: 11px;
}
</style>

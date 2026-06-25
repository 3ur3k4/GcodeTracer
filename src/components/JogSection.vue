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
  Home,
  LockOpen,
} from '@lucide/vue'

const store = useAppStore()
const ipc = useIpc()

const STEP_SIZES = [0.1, 1, 10, 100]
const stepSize = ref(1)

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
        <button class="padButton" aria-label="左上" @click="jog(-1, 1, 0)"><ArrowUpLeft :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="上" @click="jog(0, 1, 0)"><ArrowUp :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="右上" @click="jog(1, 1, 0)"><ArrowUpRight :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="左" @click="jog(-1, 0, 0)"><ArrowLeft :size="16" :stroke-width="1.75" /></button>
        <span class="padCenter" aria-hidden="true"><span class="centerDot" /></span>
        <button class="padButton" aria-label="右" @click="jog(1, 0, 0)"><ArrowRight :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="左下" @click="jog(-1, -1, 0)"><ArrowDownLeft :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="下" @click="jog(0, -1, 0)"><ArrowDown :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="右下" @click="jog(1, -1, 0)"><ArrowDownRight :size="16" :stroke-width="1.75" /></button>
      </div>
      <div class="zPad" :class="{ disabled: jogDisabled }">
        <button class="padButton" aria-label="Z+" @click="jog(0, 0, 1)"><ChevronUp :size="16" :stroke-width="1.75" /></button>
        <button class="padButton" aria-label="Z-" @click="jog(0, 0, -1)"><ChevronDown :size="16" :stroke-width="1.75" /></button>
      </div>
    </div>

    <div class="stepRow">
      <span class="stepUnit">mm</span>
      <button
        v-for="size in STEP_SIZES"
        :key="size"
        class="stepButton"
        :class="{ active: stepSize === size }"
        @click="stepSize = size"
      >
        {{ size }}
      </button>
    </div>

    <div class="actionRow">
      <button class="actionButton warningButton" :disabled="!store.connection.connected" aria-label="アンロック" @click="ipc.unlock()">
        <LockOpen :size="16" :stroke-width="1.75" />
      </button>
      <button class="actionButton" :disabled="!store.connection.connected" aria-label="ホーミング" @click="ipc.home()">
        <Home :size="16" :stroke-width="1.75" />
      </button>
      <button class="actionButton" :disabled="!store.connection.connected" aria-label="ワークゼロへ移動" @click="ipc.gotoWorkZero()">
        <Crosshair :size="16" :stroke-width="1.75" />
      </button>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}
.xyPad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  flex: 1;
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
  gap: 3px;
}
.padButton {
  width: 100%;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
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
.warningButton {
  border-color: var(--warning);
  color: var(--warning);
}
</style>

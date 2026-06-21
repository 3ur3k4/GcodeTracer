<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'

const store = useAppStore()
const ipc = useIpc()

const STEP_SIZES = [0.1, 1, 5, 10, 50]
const stepSize = ref(1)

function jog(x: number, y: number, z: number): void {
  if (!store.connection.connected) return
  ipc.jog(x, y, z, stepSize.value)
}
</script>

<template>
  <section class="panel">
    <h2 class="title">ジョグ</h2>

    <div class="stepRow">
      <span class="label">ステップ(mm)</span>
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

    <div class="padArea">
      <div class="xyPad">
        <button class="padButton yPlus" :disabled="!store.connection.connected" @click="jog(0, 1, 0)">Y+</button>
        <button class="padButton xMinus" :disabled="!store.connection.connected" @click="jog(-1, 0, 0)">X-</button>
        <button class="padButton center" :disabled="!store.connection.connected" @click="ipc.home()" title="ホーミング">
          ⌂
        </button>
        <button class="padButton xPlus" :disabled="!store.connection.connected" @click="jog(1, 0, 0)">X+</button>
        <button class="padButton yMinus" :disabled="!store.connection.connected" @click="jog(0, -1, 0)">Y-</button>
      </div>
      <div class="zPad">
        <button class="padButton" :disabled="!store.connection.connected" @click="jog(0, 0, 1)">Z+</button>
        <button class="padButton" :disabled="!store.connection.connected" @click="jog(0, 0, -1)">Z-</button>
      </div>
    </div>

    <div class="row">
      <button class="iconButton" :disabled="!store.connection.connected" @click="ipc.zero('X')">X零点</button>
      <button class="iconButton" :disabled="!store.connection.connected" @click="ipc.zero('Y')">Y零点</button>
      <button class="iconButton" :disabled="!store.connection.connected" @click="ipc.zero('Z')">Z零点</button>
    </div>

    <div class="row">
      <button class="iconButton" :disabled="!store.connection.connected" @click="ipc.unlock()">アンロック</button>
      <button class="dangerButton" :disabled="!store.connection.connected" @click="ipc.softReset()">
        ソフトリセット
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
.stepRow {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
}
.label {
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-right: var(--space-1);
}
.stepButton {
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: 12px;
}
.stepButton.active {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-black);
  font-weight: 600;
}
.padArea {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: var(--space-2) 0;
}
.xyPad {
  display: grid;
  grid-template-areas:
    '.       yPlus   .'
    'xMinus  center  xPlus'
    '.       yMinus  .';
  grid-template-columns: 44px 44px 44px;
  grid-template-rows: 44px 44px 44px;
  gap: var(--space-1);
}
.zPad {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.padButton {
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-weight: 600;
}
.padButton.yPlus { grid-area: yPlus; }
.padButton.yMinus { grid-area: yMinus; }
.padButton.xMinus { grid-area: xMinus; }
.padButton.xPlus { grid-area: xPlus; }
.padButton.center {
  grid-area: center;
  color: var(--color-text-secondary);
}
.row {
  display: flex;
  gap: var(--space-2);
}
.iconButton,
.dangerButton {
  flex: 1;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
.dangerButton {
  border-color: var(--color-danger);
  color: var(--color-danger);
}
.iconButton:disabled,
.dangerButton:disabled,
.padButton:disabled {
  opacity: 0.5;
}
</style>

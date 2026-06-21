<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'

const store = useAppStore()
const ipc = useIpc()

const form = reactive({ ip: store.osc.ip, port: store.osc.port })

watch(
  () => `${store.osc.ip}:${store.osc.port}`,
  () => {
    form.ip = store.osc.ip
    form.port = store.osc.port
  },
)

function apply(): void {
  ipc.updateOscSettings(form.ip, form.port, store.osc.enabled)
}

function toggleEnabled(): void {
  ipc.updateOscSettings(store.osc.ip, store.osc.port, !store.osc.enabled)
}
</script>

<template>
  <section class="panel">
    <h2 class="title">OSC送信</h2>
    <div class="row">
      <label class="label" for="osc-ip">IP</label>
      <input id="osc-ip" v-model="form.ip" class="input" type="text" placeholder="127.0.0.1" />
    </div>
    <div class="row">
      <label class="label" for="osc-port">Port</label>
      <input id="osc-port" v-model.number="form.port" class="input" type="number" min="1" max="65535" />
    </div>
    <div class="row">
      <button class="iconButton" @click="apply">適用</button>
      <button class="iconButton" :class="{ active: store.osc.enabled }" @click="toggleEnabled">
        {{ store.osc.enabled ? '送信中' : '送信停止中' }}
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
  align-items: center;
  gap: var(--space-2);
}
.label {
  width: 48px;
  color: var(--color-text-secondary);
  font-size: 12px;
}
.input {
  flex: 1;
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  font-family: var(--font-mono);
}
.iconButton {
  flex: 1;
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
.iconButton.active {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-black);
  font-weight: 600;
}
</style>

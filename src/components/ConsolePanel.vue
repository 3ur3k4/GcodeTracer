<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'

const store = useAppStore()
const ipc = useIpc()

const command = ref('')
const logEl = ref<HTMLDivElement | null>(null)

function send(): void {
  const trimmed = command.value.trim()
  if (!trimmed || !store.connection.connected) return
  ipc.sendCommand(trimmed)
  command.value = ''
}

watch(
  () => store.console.lines.length,
  async () => {
    await nextTick()
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  },
)
</script>

<template>
  <section class="panel">
    <h2 class="title">コンソール</h2>
    <div ref="logEl" class="log">
      <div v-for="line in store.console.lines" :key="line.id" class="logLine" :class="line.direction">
        <span v-if="line.direction === 'tx'">&gt; </span>
        {{ line.text }}
      </div>
    </div>
    <form class="row" @submit.prevent="send">
      <input
        v-model="command"
        class="input"
        type="text"
        placeholder="Gコード / $コマンドを入力"
        :disabled="!store.connection.connected"
      />
      <button class="sendButton" type="submit" :disabled="!store.connection.connected">送信</button>
    </form>
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
  grid-column: span 2;
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.log {
  height: 200px;
  overflow-y: auto;
  background-color: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2);
  font-family: var(--font-mono);
  font-size: 12px;
}
.logLine {
  white-space: pre-wrap;
  word-break: break-all;
}
.logLine.tx {
  color: var(--color-text-primary);
}
.logLine.rx {
  color: var(--color-text-secondary);
}
.logLine.info {
  color: var(--color-warning);
}
.row {
  display: flex;
  gap: var(--space-2);
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
.sendButton {
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
.sendButton:disabled,
.input:disabled {
  opacity: 0.5;
}
</style>

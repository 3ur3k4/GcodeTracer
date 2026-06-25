<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'
import { ChevronDown, Send } from '@lucide/vue'
import type { ConsoleLine } from '@shared/ipcContract'

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const store = useAppStore()
const ipc = useIpc()

const isOpen = ref(true)
watch(isOpen, (val) => emit('update:open', val))
const command = ref('')
const logEl = ref<HTMLDivElement | null>(null)

function isError(line: ConsoleLine): boolean {
  return line.direction === 'rx' && (line.text.startsWith('error:') || line.text.startsWith('ALARM:'))
}

const hasError = computed(() => store.console.lines.some(isError))

function isOkOnly(line: ConsoleLine): boolean {
  return line.direction === 'rx' && line.text.trim() === 'ok'
}

function prefix(line: ConsoleLine): string {
  if (line.direction === 'tx') return '> '
  if (isError(line)) return '! '
  if (line.direction === 'rx') return '< '
  return ''
}

// txコマンドに対応するokは表示しない。tx直後のokのみ折りたたむ。
const filteredLines = computed(() => {
  const lines = store.console.lines
  const result: ConsoleLine[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isOkOnly(line)) {
      // 直前のtxが存在する場合はokを非表示（送信確認okは冗長）
      const prev = result[result.length - 1]
      if (prev && prev.direction === 'tx') continue
    }
    result.push(line)
  }
  return result
})

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
  <div class="drawer" :class="{ open: isOpen }">
    <button class="header" @click="isOpen = !isOpen">
      <span class="dot" :class="{ errorDot: hasError }" />
      <span class="label">Console</span>
      <ChevronDown class="chevron" :class="{ rotated: !isOpen }" :size="15" :stroke-width="1.75" />
    </button>

    <template v-if="isOpen">
      <div ref="logEl" class="log">
        <div
          v-for="line in filteredLines"
          :key="line.id"
          class="logLine"
          :class="{ tx: line.direction === 'tx', rx: line.direction === 'rx' && !isError(line), error: isError(line), info: line.direction === 'info' }"
        >
          {{ prefix(line) }}{{ line.text }}
        </div>
      </div>
      <form class="inputRow" @submit.prevent="send">
        <span class="prompt">&gt;</span>
        <input
          v-model="command"
          class="input"
          type="text"
          placeholder="Gコード / $コマンドを入力"
          :disabled="!store.connection.connected"
        />
        <button class="sendButton" type="submit" :disabled="!store.connection.connected" aria-label="送信">
          <Send :size="18" :stroke-width="1.75" />
        </button>
      </form>
    </template>
  </div>
</template>

<style scoped>
.drawer {
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border-top: 1px solid var(--border);
  overflow: hidden;
}
.header {
  flex: none;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  background-color: transparent;
  border: none;
  width: 100%;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--accent);
  flex: none;
}
.dot.errorDot {
  background-color: var(--danger);
}
.label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ts);
  text-transform: uppercase;
}
.chevron {
  margin-left: auto;
  color: var(--ts);
  transition: transform 0.15s ease;
}
.chevron.rotated {
  transform: rotate(180deg);
}
.log {
  flex: 1;
  overflow-y: auto;
  padding: 4px 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.65;
  user-select: text;
  cursor: text;
}
.logLine {
  white-space: pre-wrap;
  word-break: break-all;
}
.logLine.tx {
  color: var(--ts);
}
.logLine.rx {
  color: var(--accent);
}
.logLine.error {
  color: var(--danger);
}
.logLine.info {
  color: var(--warning);
}
.inputRow {
  flex: none;
  height: 34px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-top: 1px solid var(--border);
}
.prompt {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ts);
}
.input {
  flex: 1;
  height: 100%;
  border: none;
  background-color: transparent;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--tp);
}
.input:disabled {
  opacity: 0.5;
}
.sendButton {
  width: 26px;
  height: 26px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  border: none;
  background-color: transparent;
  color: var(--ts);
}
.sendButton:hover:not(:disabled) {
  background-color: var(--surface2);
  color: var(--accent);
}
.sendButton:disabled {
  opacity: 0.5;
}
</style>

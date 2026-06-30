<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useIpc } from '@/composables/useIpc'
import { ChevronDown, Send } from '@lucide/vue'
import type { ConsoleLine } from '@shared/ipcContract'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const store = useAppStore()
const ipc = useIpc()

const isOpen = ref(props.modelValue)
// 親（リサイザー操作）からの変更を反映
watch(() => props.modelValue, (val) => { isOpen.value = val })
// ヘッダークリックによる変更を親に通知
watch(isOpen, (val) => { emit('update:modelValue', val) })
const command = ref('')
const logEl = ref<HTMLDivElement | null>(null)

const history: string[] = []
let historyIdx = -1
let savedInput = ''

function isError(line: ConsoleLine): boolean {
  return line.direction === 'rx' && (line.text.startsWith('error:') || line.text.startsWith('ALARM:'))
}

const hasError = computed(() => store.console.hasError)

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
  if (history[0] !== trimmed) {
    history.unshift(trimmed)
    if (history.length > 100) history.length = 100
  }
  historyIdx = -1
  savedInput = ''
  command.value = ''
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (history.length === 0) return
    if (historyIdx === -1) savedInput = command.value
    historyIdx = Math.min(historyIdx + 1, history.length - 1)
    command.value = history[historyIdx]
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (historyIdx === -1) return
    historyIdx -= 1
    command.value = historyIdx === -1 ? savedInput : history[historyIdx]
  }
}

async function scrollToBottom() {
  await nextTick()
  if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
}

// logElがマウントされたとき(ドロワーを開いたとき)にスクロールし、
// DOMへの行追加(MutationObserver)とコンテナリサイズ(ResizeObserver)でも最下部を維持する
watch(logEl, (el, _old, onCleanup) => {
  if (!el) return
  scrollToBottom()
  const resizeObserver = new ResizeObserver(() => { el.scrollTop = el.scrollHeight })
  resizeObserver.observe(el)
  // watch(lines.length)ではrender前に呼ばれてDOMと同期しない場合があるため、
  // DOM更新後に確実に発火するMutationObserverで代替する
  const mutationObserver = new MutationObserver(() => { el.scrollTop = el.scrollHeight })
  mutationObserver.observe(el, { childList: true })
  onCleanup(() => {
    resizeObserver.disconnect()
    mutationObserver.disconnect()
  })
})
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
          @keydown="onKeyDown"
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

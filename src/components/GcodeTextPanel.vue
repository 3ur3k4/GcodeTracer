<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { X } from '@lucide/vue'

defineEmits<{ close: [] }>()

const store = useAppStore()
const gcodeFile = useGcodeFileStore()

// ────────────────────────────────────────────
// パネル幅のリサイズ（左端ドラッグ）
// ────────────────────────────────────────────
const panelWidth = ref(280)
const MIN_WIDTH = 180
const MAX_WIDTH = 600

let rszStartX = 0
let rszStartW = 0

function onResizerDown(e: PointerEvent): void {
  rszStartX = e.clientX
  rszStartW = panelWidth.value
  e.preventDefault()
  window.addEventListener('pointermove', onResizerMove)
  window.addEventListener('pointerup', onResizerUp)
}

function onResizerMove(e: PointerEvent): void {
  // 左端ドラッグ: 左に引くほど幅が広がる
  panelWidth.value = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, rszStartW + (rszStartX - e.clientX)))
}

function onResizerUp(): void {
  window.removeEventListener('pointermove', onResizerMove)
  window.removeEventListener('pointerup', onResizerUp)
}

// ────────────────────────────────────────────
// シンタックスハイライト
// ────────────────────────────────────────────
type TType = 'g' | 'm' | 'coord' | 'comment' | 'plain'
interface Token { text: string; type: TType }

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = []
  // G/Mコード、軸ワード(XYZIJKFSR)、括弧コメント、セミコロンコメントの順にマッチ
  const re = /([Gg]\s*\d+(?:\.\d+)?)|([Mm]\s*\d+(?:\.\d+)?)|([XYZIJKFSRxyzijkfsr]\s*-?\d+(?:\.\d+)?)|(\([^)]*\))|(;.*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
    }
    const [, g, m, coord, paren, semi] = match
    if (g) tokens.push({ text: g, type: 'g' })
    else if (m) tokens.push({ text: m, type: 'm' })
    else if (coord) tokens.push({ text: coord, type: 'coord' })
    else tokens.push({ text: (paren ?? semi)!, type: 'comment' })
    lastIndex = re.lastIndex
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), type: 'plain' })
  }

  return tokens
}

// ファイルが変わった時だけ再トークナイズ
const tokenizedLines = computed(() => gcodeFile.lines.map(tokenizeLine))

// ────────────────────────────────────────────
// 行の状態 (ハイライト種別)
// ────────────────────────────────────────────
function lineState(index: number): 'head' | 'current' | 'done' | 'future' | '' {
  if (gcodeFile.previewActive) {
    const pl = gcodeFile.previewLine
    if (pl > 0 && index === pl - 1) return 'head'
    if (index < pl) return 'done'
    return 'future'
  }
  if (store.job.running || store.job.paused) {
    if (index === store.job.currentLine) return 'current'
    if (index < store.job.currentLine) return 'done'
    return 'future'
  }
  return ''
}

// ────────────────────────────────────────────
// 自動スクロール
// ────────────────────────────────────────────
const listRef = ref<HTMLDivElement | null>(null)

function scrollToLine(index: number): void {
  if (index < 0) return
  nextTick(() => {
    const el = listRef.value?.children[index] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

watch(() => gcodeFile.previewLine, (pl) => {
  if (gcodeFile.previewActive) scrollToLine(pl - 1)
})

watch(() => store.job.currentLine, (line) => {
  if (!gcodeFile.previewActive && (store.job.running || store.job.paused)) {
    scrollToLine(line)
  }
})

// ────────────────────────────────────────────
// 行クリック → プレビュー位置を変更
// ────────────────────────────────────────────
function onLineClick(index: number): void {
  gcodeFile.setPreviewLine(index + 1)
}
</script>

<template>
  <div class="panel" :style="{ width: `${panelWidth}px` }">
    <div class="resizer" @pointerdown="onResizerDown" />
    <div class="header">
      <span class="title">G-CODE</span>
      <span v-if="gcodeFile.fileName" class="fileName" :title="gcodeFile.fileName">
        {{ gcodeFile.fileName }}
      </span>
      <button class="closeBtn" title="閉じる" @click="$emit('close')">
        <X :size="13" :stroke-width="2" />
      </button>
    </div>

    <div v-if="gcodeFile.lines.length === 0" class="empty">
      <span>ファイル未読み込み</span>
    </div>

    <div v-else ref="listRef" class="lines">
      <div
        v-for="(tokens, i) in tokenizedLines"
        :key="i"
        class="line"
        :class="lineState(i)"
        @click="onLineClick(i)"
      >
        <span class="lineNum">{{ i + 1 }}</span>
        <span class="lineContent">
          <span
            v-for="(tok, j) in tokens"
            :key="j"
            :class="`tok-${tok.type}`"
          >{{ tok.text }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  flex: none;
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border-left: 1px solid var(--border);
  overflow: hidden;
  position: relative;
}
.resizer {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: ew-resize;
  z-index: 1;
}
.resizer:hover,
.resizer:active {
  background-color: var(--accent);
  opacity: 0.4;
}
.header {
  flex: none;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--border);
}
.title {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--ts);
  flex: none;
}
.fileName {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ts);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.6;
}
.closeBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--surface2);
  color: var(--ts);
  flex: none;
}
.closeBtn:hover {
  color: var(--tp);
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
  opacity: 0.5;
}
.lines {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;
  padding: 4px 0;
}
.line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 12px 1px 10px;
  cursor: pointer;
  border-left: 3px solid transparent;
  min-height: 20px;
  line-height: 1.65;
}
.line:hover {
  background-color: var(--surface2);
}
.line.done {
  /* 完了済み: 通常表示 */
}
.line.future {
  opacity: 0.35;
}
.line.current {
  background-color: color-mix(in srgb, var(--accent) 14%, transparent);
  border-left-color: var(--accent);
}
.line.head {
  border-left-color: var(--accent);
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
}
.lineNum {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ts);
  min-width: 34px;
  text-align: right;
  flex: none;
  user-select: none;
  opacity: 0.5;
}
.lineContent {
  font-family: var(--font-mono);
  font-size: 12px;
  white-space: pre;
  color: var(--tp);
}
.tok-g { color: var(--accent); }
.tok-m { color: var(--warning); }
.tok-coord { color: var(--tp); }
.tok-comment { color: var(--ts); font-style: italic; }
.tok-plain { color: var(--tp); opacity: 0.75; }
</style>

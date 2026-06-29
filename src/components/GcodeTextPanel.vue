<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { ChevronDown, ChevronUp, CornerDownLeft, Search, X } from '@lucide/vue'

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
  const re = /([Gg]\s*\d+(?:\.\d+)?)|([Mm]\s*\d+(?:\.\d+)?)|([XYZIJKFSRxyzijkfsr]\s*-?\d+(?:\.\d+)?)|(\([^)]*\))|(;.*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(line)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: line.slice(lastIndex, match.index), type: 'plain' })
    const [, g, m, coord, paren, semi] = match
    if (g) tokens.push({ text: g, type: 'g' })
    else if (m) tokens.push({ text: m, type: 'm' })
    else if (coord) tokens.push({ text: coord, type: 'coord' })
    else tokens.push({ text: (paren ?? semi)!, type: 'comment' })
    lastIndex = re.lastIndex
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex), type: 'plain' })
  return tokens
}

const tokenizedLines = computed(() => gcodeFile.lines.map(tokenizeLine))

// ────────────────────────────────────────────
// 行範囲フィルター
// ────────────────────────────────────────────
const rangeFrom = ref<number | null>(null)
const rangeTo = ref<number | null>(null)

interface LineItem { index: number; tokens: Token[] }

const visibleLineItems = computed<LineItem[]>(() => {
  const hasRange = rangeFrom.value !== null || rangeTo.value !== null
  if (!hasRange) return tokenizedLines.value.map((tokens, index) => ({ index, tokens }))
  const from = Math.max(0, (rangeFrom.value ?? 1) - 1)
  const to = Math.min(gcodeFile.lines.length - 1, (rangeTo.value ?? gcodeFile.lines.length) - 1)
  return tokenizedLines.value
    .map((tokens, index) => ({ index, tokens }))
    .filter(({ index }) => index >= from && index <= to)
})

function clearRange(): void {
  rangeFrom.value = null
  rangeTo.value = null
}

// ────────────────────────────────────────────
// テキスト検索
// ────────────────────────────────────────────
const searchBarOpen = ref(false)
const searchQuery = ref('')
const currentMatchIdx = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)

// 表示範囲内でマッチする行インデックス（元ファイルの行番号）
const matchIndices = computed<number[]>(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return visibleLineItems.value
    .filter(({ index }) => gcodeFile.lines[index].toLowerCase().includes(q))
    .map(({ index }) => index)
})

const matchSet = computed(() => new Set(matchIndices.value))

watch(matchIndices, () => {
  currentMatchIdx.value = 0
  if (matchIndices.value.length) scrollToLine(matchIndices.value[0])
})

// 検索マッチ箇所をハイライト用に分割
interface TextPart { text: string; highlight: boolean }

function splitByMatch(text: string, query: string): TextPart[] {
  const parts: TextPart[] = []
  const lower = text.toLowerCase()
  const q = query.toLowerCase()
  let lastIdx = 0
  let idx: number
  while ((idx = lower.indexOf(q, lastIdx)) !== -1) {
    if (idx > lastIdx) parts.push({ text: text.slice(lastIdx, idx), highlight: false })
    parts.push({ text: text.slice(idx, idx + q.length), highlight: true })
    lastIdx = idx + q.length
  }
  if (lastIdx < text.length) parts.push({ text: text.slice(lastIdx), highlight: false })
  return parts
}

function nextMatch(): void {
  if (!matchIndices.value.length) return
  currentMatchIdx.value = (currentMatchIdx.value + 1) % matchIndices.value.length
  scrollToLine(matchIndices.value[currentMatchIdx.value])
}

function prevMatch(): void {
  if (!matchIndices.value.length) return
  currentMatchIdx.value = (currentMatchIdx.value - 1 + matchIndices.value.length) % matchIndices.value.length
  scrollToLine(matchIndices.value[currentMatchIdx.value])
}

function openSearchBar(): void {
  searchBarOpen.value = true
  nextTick(() => searchInputRef.value?.focus())
}

function closeSearchBar(): void {
  searchBarOpen.value = false
  searchQuery.value = ''
}

function onGlobalKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    e.preventDefault()
    openSearchBar()
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onGlobalKeydown))

// ────────────────────────────────────────────
// 行番号ジャンプ
// ────────────────────────────────────────────
const jumpValue = ref<number | null>(null)

function onJumpEnter(): void {
  const n = jumpValue.value
  if (n === null || n < 1 || n > gcodeFile.lines.length) return
  scrollToLine(n - 1)
}

// ────────────────────────────────────────────
// 行の状態（ハイライト種別・複数クラス対応）
// ────────────────────────────────────────────
function lineState(index: number): Record<string, boolean> {
  const isMatch = matchSet.value.has(index)
  const isCurrentMatch = !!searchQuery.value.trim() && matchIndices.value[currentMatchIdx.value] === index

  if (gcodeFile.previewActive) {
    const pl = gcodeFile.previewLine
    return {
      head: pl > 0 && index === pl - 1,
      done: index < pl && !(pl > 0 && index === pl - 1),
      future: index >= pl,
      match: isMatch,
      'current-match': isCurrentMatch,
    }
  }
  if (store.job.running || store.job.paused) {
    return {
      current: index === store.job.currentLine,
      done: index < store.job.currentLine,
      future: index > store.job.currentLine,
      match: isMatch,
      'current-match': isCurrentMatch,
    }
  }
  return { match: isMatch, 'current-match': isCurrentMatch }
}

// ────────────────────────────────────────────
// 自動スクロール（visibleLineItems の DOM 順で検索）
// ────────────────────────────────────────────
const listRef = ref<HTMLDivElement | null>(null)

function scrollToLine(lineIndex: number): void {
  nextTick(() => {
    const pos = visibleLineItems.value.findIndex((item) => item.index === lineIndex)
    if (pos < 0) return
    const el = listRef.value?.children[pos] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  })
}

watch(() => gcodeFile.previewLine, (pl) => {
  if (gcodeFile.previewActive) scrollToLine(pl - 1)
})

watch(() => store.job.currentLine, (line) => {
  if (!gcodeFile.previewActive && (store.job.running || store.job.paused)) scrollToLine(line)
})

// ────────────────────────────────────────────
// 行クリック → プレビュー位置を変更
// ────────────────────────────────────────────
function onLineClick(index: number): void {
  if (window.getSelection()?.toString()) return
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
      <button class="headerBtn" :class="{ active: searchBarOpen }" title="検索 (⌘F)" @click="openSearchBar">
        <Search :size="12" :stroke-width="2" />
      </button>
      <button class="headerBtn" title="閉じる" @click="$emit('close')">
        <X :size="13" :stroke-width="2" />
      </button>
    </div>

    <div v-if="searchBarOpen" class="searchBar">
      <!-- テキスト検索 -->
      <div class="searchRow">
        <Search :size="11" class="searchIcon" />
        <input
          ref="searchInputRef"
          v-model="searchQuery"
          class="searchInput"
          placeholder="検索..."
          @keydown.enter.exact="nextMatch"
          @keydown.shift.enter.exact.prevent="prevMatch"
          @keydown.escape="closeSearchBar"
        />
        <span v-if="searchQuery.trim()" class="matchCount">
          {{ matchIndices.length ? `${currentMatchIdx + 1}/${matchIndices.length}` : '0件' }}
        </span>
        <button class="searchBtn" :disabled="!matchIndices.length" title="前へ (⇧Enter)" @click="prevMatch">
          <ChevronUp :size="12" :stroke-width="2" />
        </button>
        <button class="searchBtn" :disabled="!matchIndices.length" title="次へ (Enter)" @click="nextMatch">
          <ChevronDown :size="12" :stroke-width="2" />
        </button>
        <button class="searchBtn closeBar" title="閉じる (Esc)" @click="closeSearchBar">
          <X :size="11" :stroke-width="2" />
        </button>
      </div>

      <!-- 行番号ジャンプ + 行範囲 -->
      <div class="searchRow subRow">
        <span class="subLabel">L</span>
        <input
          v-model.number="jumpValue"
          class="jumpInput"
          type="number"
          min="1"
          :max="gcodeFile.lines.length"
          placeholder="行番号"
          @keydown.enter="onJumpEnter"
        />
        <button class="searchBtn" title="この行へジャンプ" @click="onJumpEnter">
          <CornerDownLeft :size="11" :stroke-width="2" />
        </button>
        <div class="subDivider" />
        <input
          v-model.number="rangeFrom"
          class="rangeInput"
          type="number"
          min="1"
          :max="gcodeFile.lines.length"
          placeholder="開始"
        />
        <span class="rangeSep">〜</span>
        <input
          v-model.number="rangeTo"
          class="rangeInput"
          type="number"
          min="1"
          :max="gcodeFile.lines.length"
          placeholder="終了"
        />
        <button
          v-if="rangeFrom !== null || rangeTo !== null"
          class="searchBtn"
          title="範囲をクリア"
          @click="clearRange"
        >
          <X :size="11" :stroke-width="2" />
        </button>
      </div>
    </div>

    <div v-if="gcodeFile.lines.length === 0" class="empty">
      <span>ファイル未読み込み</span>
    </div>

    <div v-else ref="listRef" class="lines">
      <div
        v-for="item in visibleLineItems"
        :key="item.index"
        class="line"
        :class="lineState(item.index)"
        @click="onLineClick(item.index)"
      >
        <span class="lineNum">{{ item.index + 1 }}</span>
        <span class="lineContent">
          <span v-for="(tok, j) in item.tokens" :key="j" :class="`tok-${tok.type}`">
            <template v-if="searchQuery.trim() && gcodeFile.lines[item.index].toLowerCase().includes(searchQuery.trim().toLowerCase())">
              <template v-for="(part, k) in splitByMatch(tok.text, searchQuery.trim())" :key="k">
                <mark v-if="part.highlight" class="searchHighlight">{{ part.text }}</mark>
                <template v-else>{{ part.text }}</template>
              </template>
            </template>
            <template v-else>{{ tok.text }}</template>
          </span>
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
  gap: 4px;
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
.headerBtn {
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
.headerBtn:hover { color: var(--tp); }
.headerBtn.active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
}

/* ── 検索バー ── */
.searchBar {
  flex: none;
  border-bottom: 1px solid var(--border);
  background-color: var(--surface2);
}
.searchRow {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 8px 0 10px;
}
.searchRow + .searchRow {
  border-top: 1px solid var(--border);
  height: 28px;
}
.searchIcon {
  color: var(--ts);
  flex: none;
  opacity: 0.6;
}
.searchInput {
  flex: 1;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background-color: var(--surface);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tp);
  padding: 0 6px;
  min-width: 0;
}
.searchInput:focus { outline: none; border-color: var(--accent); }
.matchCount {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ts);
  white-space: nowrap;
  flex: none;
  min-width: 32px;
  text-align: right;
}
.searchBtn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: transparent;
  color: var(--ts);
  flex: none;
}
.searchBtn:hover:not(:disabled) { color: var(--tp); background: var(--surface); }
.searchBtn:disabled { opacity: 0.3; cursor: default; }
.searchBtn.closeBar { margin-left: 2px; }

.subRow { gap: 3px; }
.subLabel {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--ts);
  flex: none;
}
.subDivider {
  width: 1px;
  height: 14px;
  background-color: var(--border);
  flex: none;
  margin: 0 3px;
}
.jumpInput {
  width: 52px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background-color: var(--surface);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tp);
  padding: 0 4px;
  text-align: right;
}
.jumpInput:focus { outline: none; border-color: var(--accent); }
.rangeInput {
  width: 44px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background-color: var(--surface);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tp);
  padding: 0 4px;
  text-align: right;
}
.rangeInput:focus { outline: none; border-color: var(--accent); }
.rangeSep { font-size: 10px; color: var(--ts); }
.jumpInput::-webkit-inner-spin-button,
.jumpInput::-webkit-outer-spin-button,
.rangeInput::-webkit-inner-spin-button,
.rangeInput::-webkit-outer-spin-button { -webkit-appearance: none; }

/* ── 検索ハイライト ── */
.searchHighlight {
  background-color: color-mix(in srgb, #e8a020 45%, transparent);
  color: var(--tp);
  border-radius: 2px;
  font-style: normal;
}
.line.match { background-color: color-mix(in srgb, #e8a020 6%, transparent); }
.line.current-match { background-color: color-mix(in srgb, #e8a020 14%, transparent); }

/* ── 行リスト ── */
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
.line:hover { background-color: var(--surface2); }
.line.future { opacity: 0.35; }
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
  user-select: text;
}
.tok-g { color: var(--accent); }
.tok-m { color: var(--warning); }
.tok-coord { color: var(--tp); }
.tok-comment { color: var(--ts); font-style: italic; }
.tok-plain { color: var(--tp); opacity: 0.75; }
</style>

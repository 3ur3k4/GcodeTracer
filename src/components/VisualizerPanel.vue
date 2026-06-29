<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { ChevronLeft, ChevronRight, Frame, Group, SlidersHorizontal, SquareEqual } from '@lucide/vue'
import AppSelect from '@/components/AppSelect.vue'

const store = useAppStore()
const gcodeFile = useGcodeFileStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const view = ref({ scale: 1, offsetX: 0, offsetY: 0 })
const zoomPercent = computed(() => Math.round(view.value.scale * 100))

// スライダーの v-model 用: ストアの previewLine を直接書き換える
const previewLineModel = computed({
  get: () => gcodeFile.previewLine,
  set: (v: number) => { gcodeFile.previewLine = v },
})

// プレビューヘッドの座標 (最後に完了したセグメントの終点)
const previewHeadPos = computed(() => {
  const segs = gcodeFile.toolPath.segments
  for (let i = segs.length - 1; i >= 0; i--) {
    if (segs[i].sourceLine < gcodeFile.previewLine) {
      return { x: segs[i].x2, y: segs[i].y2 }
    }
  }
  return { x: 0, y: 0 }
})

const progressPercent = computed(() => {
  if (store.job.totalLines === 0) return 0
  return Math.round((store.job.currentLine / store.job.totalLines) * 100)
})

// 用紙ガイド線
interface PaperSize { label: string; w: number; h: number }
const PAPER_SIZES: PaperSize[] = [
  { label: 'なし', w: 0, h: 0 },
  { label: 'A3 (横)', w: 420, h: 297 },
  { label: 'A3 (縦)', w: 297, h: 420 },
  { label: 'A4 (横)', w: 297, h: 210 },
  { label: 'A4 (縦)', w: 210, h: 297 },
  { label: 'A5 (横)', w: 210, h: 148 },
  { label: 'A5 (縦)', w: 148, h: 210 },
  { label: 'カスタム', w: -1, h: -1 },
]
const paperOptions = PAPER_SIZES.map((p, i) => ({ value: i, label: p.label }))
const selectedPaperIdx = ref(0)
const customW = ref(200)
const customH = ref(150)

const activePaper = computed<PaperSize | null>(() => {
  const p = PAPER_SIZES[selectedPaperIdx.value]
  if (!p || p.w === 0) return null
  if (p.w === -1) return { label: 'カスタム', w: customW.value, h: customH.value }
  return p
})
const isCustomPaper = computed(() => PAPER_SIZES[selectedPaperIdx.value]?.w === -1)

const MIN_GRID_PX = 40
const PADDING_PX = 24
let dragging = false
let lastPointer = { x: 0, y: 0 }
let resizeObserver: ResizeObserver | null = null
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)')

function token(name: string): string {
  const canvas = canvasRef.value
  if (!canvas) return '#000000'
  return getComputedStyle(canvas).getPropertyValue(name).trim()
}

function toCanvas(x: number, y: number): [number, number] {
  return [x * view.value.scale + view.value.offsetX, -y * view.value.scale + view.value.offsetY]
}

function fitToView(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  if (gcodeFile.toolPath.segments.length === 0) {
    // toolpath なし: GRBL座標系の原点(0,0)を左下に配置する
    view.value = { scale: 1, offsetX: PADDING_PX, offsetY: canvas.clientHeight - PADDING_PX }
    draw()
    return
  }
  const { bounds } = gcodeFile.toolPath
  const width = bounds.maxX - bounds.minX || 1
  const height = bounds.maxY - bounds.minY || 1
  const scale = Math.min((canvas.clientWidth - PADDING_PX * 2) / width, (canvas.clientHeight - PADDING_PX * 2) / height)
  view.value = {
    scale,
    offsetX: canvas.clientWidth / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    offsetY: canvas.clientHeight / 2 + ((bounds.minY + bounds.maxY) / 2) * scale,
  }
  draw()
}

function zoomToActual(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  view.value = {
    scale: 1,
    offsetX: canvas.clientWidth / 2,
    offsetY: canvas.clientHeight / 2,
  }
  draw()
}

function niceStep(rawStep: number): number {
  const exponent = Math.floor(Math.log10(rawStep))
  const base = rawStep / 10 ** exponent
  let niceBase: number
  if (base < 1.5) niceBase = 1
  else if (base < 3.5) niceBase = 2
  else if (base < 7.5) niceBase = 5
  else niceBase = 10
  return niceBase * 10 ** exponent
}

const MAJOR_MULTIPLE = 5

function drawGridLine(
  ctx: CanvasRenderingContext2D,
  kind: 'origin' | 'major' | 'minor',
  colors: { axis: string; minor: string },
  draw: () => void,
): void {
  if (kind === 'origin') {
    ctx.globalAlpha = 1
    ctx.strokeStyle = colors.axis
    ctx.lineWidth = 1.25
  } else if (kind === 'major') {
    ctx.globalAlpha = 0.5
    ctx.strokeStyle = colors.axis
    ctx.lineWidth = 0.75
  } else {
    ctx.globalAlpha = 1
    ctx.strokeStyle = colors.minor
    ctx.lineWidth = 0.5
  }
  draw()
  ctx.globalAlpha = 1
}

function drawGrid(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const { scale, offsetX, offsetY } = view.value
  if (scale <= 0) return

  const step = niceStep(MIN_GRID_PX / scale)
  const colors = { axis: token('--border'), minor: token('--grid-line') }
  const labelColor = token('--ts')

  const leftWorld = -offsetX / scale
  const rightWorld = (canvas.clientWidth - offsetX) / scale
  const bottomWorld = (offsetY - canvas.clientHeight) / scale
  const topWorld = offsetY / scale

  const firstXIdx = Math.floor(leftWorld / step)
  const lastXIdx = Math.ceil(rightWorld / step)
  const firstYIdx = Math.floor(bottomWorld / step)
  const lastYIdx = Math.ceil(topWorld / step)

  ctx.font = `10px ${token('--font-mono')}`
  ctx.fillStyle = labelColor

  ctx.textBaseline = 'top'
  for (let idx = firstXIdx; idx <= lastXIdx; idx++) {
    const x = idx * step
    const kind = idx === 0 ? 'origin' : idx % MAJOR_MULTIPLE === 0 ? 'major' : 'minor'
    const [screenX] = toCanvas(x, 0)
    drawGridLine(ctx, kind, colors, () => {
      ctx.beginPath()
      ctx.moveTo(screenX, 0)
      ctx.lineTo(screenX, canvas.clientHeight)
      ctx.stroke()
    })
    if (kind !== 'minor') {
      ctx.fillText(x.toFixed(step < 1 ? 1 : 0), screenX + 3, canvas.clientHeight - 14)
    }
  }

  ctx.textBaseline = 'bottom'
  for (let idx = firstYIdx; idx <= lastYIdx; idx++) {
    const y = idx * step
    const kind = idx === 0 ? 'origin' : idx % MAJOR_MULTIPLE === 0 ? 'major' : 'minor'
    const [, screenY] = toCanvas(0, y)
    drawGridLine(ctx, kind, colors, () => {
      ctx.beginPath()
      ctx.moveTo(0, screenY)
      ctx.lineTo(canvas.clientWidth, screenY)
      ctx.stroke()
    })
    if (kind !== 'minor') {
      ctx.fillText(y.toFixed(step < 1 ? 1 : 0), 3, screenY - 2)
    }
  }
}

function drawPaperGuide(ctx: CanvasRenderingContext2D): void {
  const paper = activePaper.value
  if (!paper) return
  const [x0, y0] = toCanvas(0, 0)
  const [x1, y1] = toCanvas(paper.w, paper.h)
  ctx.save()
  ctx.strokeStyle = token('--warning')
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.globalAlpha = 0.7
  ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
  ctx.globalAlpha = 0.08
  ctx.fillStyle = token('--warning')
  ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
  ctx.setLineDash([])
  ctx.globalAlpha = 1
  ctx.restore()
}

function draw(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight)
  drawGrid()
  drawPaperGuide(ctx)

  const drawColor = token('--accent')
  const rapidColor = token('--rapid-path')
  const markerColor = token('--danger')
  const isPreview = gcodeFile.previewActive
  const currentLine = isPreview ? gcodeFile.previewLine : store.job.currentLine

  for (const seg of gcodeFile.toolPath.segments) {
    const done = seg.sourceLine < currentLine
    const [x1, y1] = toCanvas(seg.x1, seg.y1)
    const [x2, y2] = toCanvas(seg.x2, seg.y2)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    if (seg.rapid) {
      ctx.globalAlpha = done ? (isPreview ? 0.8 : 0.7) : (isPreview ? 0.08 : 0.25)
      ctx.strokeStyle = rapidColor
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
    } else {
      ctx.globalAlpha = done ? (isPreview ? 1.0 : 0.9) : (isPreview ? 0.12 : 0.4)
      ctx.strokeStyle = drawColor
      ctx.lineWidth = isPreview && done ? 2 : 1.5
      ctx.setLineDash([])
    }
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.globalAlpha = 1

  const [px, py] = toCanvas(store.grbl.wpos.x, store.grbl.wpos.y)
  const markerRadius = 4
  const crosshairLength = 9
  ctx.strokeStyle = markerColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(px - crosshairLength, py)
  ctx.lineTo(px + crosshairLength, py)
  ctx.moveTo(px, py - crosshairLength)
  ctx.lineTo(px, py + crosshairLength)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(px, py, markerRadius, 0, Math.PI * 2)
  ctx.fillStyle = markerColor
  ctx.fill()

  if (gcodeFile.previewActive) {
    const segs = gcodeFile.toolPath.segments
    let headX = 0
    let headY = 0
    let found = false
    for (let i = segs.length - 1; i >= 0; i--) {
      if (segs[i].sourceLine < gcodeFile.previewLine) {
        headX = segs[i].x2
        headY = segs[i].y2
        found = true
        break
      }
    }
    if (found) {
      const [hx, hy] = toCanvas(headX, headY)
      const halfSize = 5
      ctx.strokeStyle = drawColor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(hx, hy - halfSize)
      ctx.lineTo(hx + halfSize, hy)
      ctx.lineTo(hx, hy + halfSize)
      ctx.lineTo(hx - halfSize, hy)
      ctx.closePath()
      ctx.stroke()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = drawColor
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
}

function resizeCanvas(): void {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return
  const dpr = window.devicePixelRatio || 1
  const cssW = container.clientWidth
  const cssH = container.clientHeight
  canvas.width = cssW * dpr
  canvas.height = cssH * dpr
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  const ctx = canvas.getContext('2d')
  ctx?.scale(dpr, dpr)
  draw()
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const zoomFactor = event.deltaY < 0 ? 1.06 : 1 / 1.06
  const worldX = (mouseX - view.value.offsetX) / view.value.scale
  const worldY = -(mouseY - view.value.offsetY) / view.value.scale
  const newScale = view.value.scale * zoomFactor
  view.value = {
    scale: newScale,
    offsetX: mouseX - worldX * newScale,
    offsetY: mouseY + worldY * newScale,
  }
  draw()
}

function onPointerDown(event: PointerEvent): void {
  dragging = true
  lastPointer = { x: event.clientX, y: event.clientY }
}

function onPointerMove(event: PointerEvent): void {
  if (!dragging) return
  const dx = event.clientX - lastPointer.x
  const dy = event.clientY - lastPointer.y
  lastPointer = { x: event.clientX, y: event.clientY }
  view.value = { ...view.value, offsetX: view.value.offsetX + dx, offsetY: view.value.offsetY + dy }
  draw()
}

function onPointerUp(): void {
  dragging = false
}

function onDoubleClick(): void {
  fitToView()
}

watch(() => gcodeFile.toolPath, () => {
  // previewActive/previewLine はストアの load() でリセット済み
  fitToView()
})

watch(() => gcodeFile.previewActive, () => draw())

watch(() => gcodeFile.previewLine, () => {
  if (gcodeFile.previewActive) draw()
})

// wpos参照の差し替えではなく実際の値変化・進捗変化のみで再描画する
watch(
  () => `${store.grbl.wpos.x},${store.grbl.wpos.y},${store.job.currentLine}`,
  () => draw(),
)

watch(activePaper, () => draw())

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeCanvas)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
  darkModeQuery.addEventListener('change', draw)
  resizeCanvas()
  fitToView()
  draw()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  darkModeQuery.removeEventListener('change', draw)
})
</script>

<template>
  <div ref="containerRef" class="canvasContainer">
    <canvas
      ref="canvasRef"
      @wheel="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
      @dblclick="onDoubleClick"
    />
    <div class="overlay">
      <span class="overlayLabel">X</span>
      <span class="overlayValue">
        {{ (gcodeFile.previewActive ? previewHeadPos.x : store.grbl.wpos.x).toFixed(3) }}
      </span>
      <span class="overlayLabel">Y</span>
      <span class="overlayValue">
        {{ (gcodeFile.previewActive ? previewHeadPos.y : store.grbl.wpos.y).toFixed(3) }}
      </span>
      <span class="overlayLabel">Zoom</span>
      <span class="overlayValue">{{ zoomPercent }}%</span>
    </div>
    <div class="viewControls">
      <button class="viewButton iconOnly" title="ズームを100%にリセット" @click="zoomToActual">
        <SquareEqual :size="15" :stroke-width="1.75" />
      </button>
      <button class="viewButton iconOnly" title="ファイルの描画範囲にフィット (ダブルクリックでも可)" @click="fitToView">
        <Group :size="15" :stroke-width="1.75" />
      </button>
      <button
        v-if="gcodeFile.lines.length > 0"
        class="viewButton iconOnly"
        :class="{ active: gcodeFile.previewActive }"
        title="軌跡プレビュー (もう一度押すと解除)"
        @click="gcodeFile.togglePreview"
      >
        <SlidersHorizontal :size="15" :stroke-width="1.75" />
      </button>
      <div class="paperControl">
        <Frame :size="14" :stroke-width="1.75" class="paperIcon" />
        <AppSelect v-model="selectedPaperIdx" :options="paperOptions" class="paperSelect" />
        <template v-if="isCustomPaper">
          <input v-model.number="customW" class="customSizeInput" type="number" min="1" step="1" @change="draw" />
          <span class="customSizeX">×</span>
          <input v-model.number="customH" class="customSizeInput" type="number" min="1" step="1" @change="draw" />
          <span class="customSizeUnit">mm</span>
        </template>
      </div>
    </div>
    <div v-if="gcodeFile.previewActive && gcodeFile.lines.length > 0" class="previewBar">
      <button
        class="previewStep"
        title="一コマンド戻る"
        :disabled="gcodeFile.previewLine === 0"
        @click="gcodeFile.stepPrev"
      >
        <ChevronLeft :size="14" :stroke-width="2" />
      </button>
      <input
        v-model.number="previewLineModel"
        type="range"
        min="0"
        :max="gcodeFile.lines.length"
        class="previewSlider"
      />
      <button
        class="previewStep"
        title="一コマンド進める"
        :disabled="gcodeFile.previewLine >= gcodeFile.lines.length"
        @click="gcodeFile.stepNext"
      >
        <ChevronRight :size="14" :stroke-width="2" />
      </button>
      <span class="previewCount">{{ gcodeFile.previewLine }} / {{ gcodeFile.lines.length }}</span>
    </div>
    <div v-if="store.job.running" class="progressOverlay">
      <div class="progressTrack">
        <div class="progressFill" :style="{ width: `${progressPercent}%` }" />
      </div>
      <span class="progressText">{{ progressPercent }}%</span>
    </div>
  </div>
</template>

<style scoped>
.canvasContainer {
  flex: 1;
  position: relative;
  background-color: var(--bg);
  overflow: hidden;
  min-width: 0;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: move;
}
.overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  background-color: var(--surface);
  opacity: 0.88;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 0 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  pointer-events: none;
}
.overlayLabel {
  color: var(--ts);
}
.overlayValue {
  color: var(--tp);
}
.viewControls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.viewButton {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--ts);
  font-size: 11px;
  font-family: var(--font-mono);
  opacity: 0.88;
}
.viewButton:hover {
  background-color: var(--surface2);
  color: var(--tp);
  opacity: 1;
}
.viewButton.iconOnly {
  width: 28px;
  padding: 0;
  justify-content: center;
}
.paperControl {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
  padding: 0 8px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  opacity: 0.88;
}
.paperControl:hover {
  opacity: 1;
}
.paperControl :deep(.trigger) {
  height: 22px;
  padding-top: 0;
  padding-bottom: 0;
  padding-right: 1px;
  border: none;
  background-color: transparent;
}
.paperIcon {
  color: var(--warning);
  flex: none;
}
.paperSelect {
  min-width: 110px;
}
.customSizeInput {
  width: 44px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background-color: var(--surface2);
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tp);
  padding: 0 4px;
  text-align: center;
}
.customSizeInput::-webkit-inner-spin-button,
.customSizeInput::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
.customSizeX,
.customSizeUnit {
  font-size: 11px;
  color: var(--ts);
}
.viewButton.active {
  background-color: var(--accent);
  border-color: var(--accent);
  color: var(--bg);
  opacity: 1;
}
.previewBar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  background-color: var(--surface);
  border-top: 1px solid var(--border);
}
.previewStep {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background-color: var(--surface2);
  color: var(--ts);
  flex: none;
}
.previewStep:hover:not(:disabled) {
  color: var(--tp);
  background-color: var(--surface);
}
.previewStep:disabled {
  opacity: 0.3;
  cursor: default;
}
.previewSlider {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
  height: 4px;
}
.previewCount {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--ts);
  min-width: 72px;
  text-align: right;
  flex: none;
}
.progressOverlay {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 6px 10px;
  opacity: 0.9;
}
.progressTrack {
  width: 120px;
  height: 3px;
  background-color: var(--border);
  border-radius: 2px;
  overflow: hidden;
}
.progressFill {
  height: 100%;
  background-color: var(--accent);
  border-radius: 2px;
  transition: width 0.2s ease;
}
.progressText {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--tp);
  min-width: 32px;
  text-align: right;
}
</style>

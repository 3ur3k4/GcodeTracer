<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/appStore'
import { useGcodeFileStore } from '@/stores/gcodeFileStore'
import { gcodeToPath } from '@/lib/gcodeToPath'

const store = useAppStore()
const gcodeFile = useGcodeFileStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

const toolPath = computed(() => gcodeToPath(gcodeFile.lines))
const view = ref({ scale: 1, offsetX: 0, offsetY: 0 })
const zoomPercent = computed(() => Math.round(view.value.scale * 100))

const MIN_GRID_PX = 40
const PADDING_PX = 24
let dragging = false
let lastPointer = { x: 0, y: 0 }
let resizeObserver: ResizeObserver | null = null

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
  if (toolPath.value.segments.length === 0) {
    view.value = { scale: 1, offsetX: canvas.width / 2, offsetY: canvas.height / 2 }
    return
  }
  const { bounds } = toolPath.value
  const width = bounds.maxX - bounds.minX || 1
  const height = bounds.maxY - bounds.minY || 1
  const scale = Math.min((canvas.width - PADDING_PX * 2) / width, (canvas.height - PADDING_PX * 2) / height)
  view.value = {
    scale,
    offsetX: canvas.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale,
    offsetY: canvas.height / 2 + ((bounds.minY + bounds.maxY) / 2) * scale,
  }
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
  const rightWorld = (canvas.width - offsetX) / scale
  const bottomWorld = (offsetY - canvas.height) / scale
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
      ctx.lineTo(screenX, canvas.height)
      ctx.stroke()
    })
    if (kind !== 'minor') {
      ctx.fillText(x.toFixed(step < 1 ? 1 : 0), screenX + 3, canvas.height - 14)
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
      ctx.lineTo(canvas.width, screenY)
      ctx.stroke()
    })
    if (kind !== 'minor') {
      ctx.fillText(y.toFixed(step < 1 ? 1 : 0), 3, screenY - 2)
    }
  }
}

function draw(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawGrid()

  const doneColor = token('--accent')
  const pendingColor = token('--ts')
  const markerColor = token('--danger')
  const currentLine = store.job.currentLine

  for (const seg of toolPath.value.segments) {
    const done = seg.sourceLine < currentLine
    const [x1, y1] = toCanvas(seg.x1, seg.y1)
    const [x2, y2] = toCanvas(seg.x2, seg.y2)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.globalAlpha = done ? 0.9 : 0.4
    ctx.strokeStyle = done ? doneColor : pendingColor
    ctx.lineWidth = 1.5
    ctx.stroke()
  }
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
}

function resizeCanvas(): void {
  const canvas = canvasRef.value
  const container = containerRef.value
  if (!canvas || !container) return
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
  draw()
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const zoomFactor = event.deltaY < 0 ? 1.1 : 1 / 1.1
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
  draw()
}

watch(toolPath, () => {
  fitToView()
  draw()
})

// wpos参照の差し替えではなく実際の値変化・進捗変化のみで再描画する
watch(
  () => `${store.grbl.wpos.x},${store.grbl.wpos.y},${store.job.currentLine}`,
  () => draw(),
)

onMounted(() => {
  resizeObserver = new ResizeObserver(resizeCanvas)
  if (containerRef.value) resizeObserver.observe(containerRef.value)
  resizeCanvas()
  fitToView()
  draw()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
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
      <span class="overlayValue">{{ store.grbl.wpos.x.toFixed(3) }}</span>
      <span class="overlayLabel">Y</span>
      <span class="overlayValue">{{ store.grbl.wpos.y.toFixed(3) }}</span>
      <span class="overlayLabel">Zoom</span>
      <span class="overlayValue">{{ zoomPercent }}%</span>
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
  cursor: grab;
}
.overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
  background-color: var(--surface);
  opacity: 0.88;
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 6px 10px;
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
</style>

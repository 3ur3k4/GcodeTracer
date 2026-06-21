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

function draw(): void {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const rapidColor = token('--color-text-secondary')
  const cutColor = token('--color-accent-text')
  const positionColor = token('--color-accent')

  for (const seg of toolPath.value.segments) {
    const [x1, y1] = toCanvas(seg.x1, seg.y1)
    const [x2, y2] = toCanvas(seg.x2, seg.y2)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = seg.rapid ? rapidColor : cutColor
    ctx.lineWidth = seg.rapid ? 1 : 1.5
    ctx.setLineDash(seg.rapid ? [4, 3] : [])
    ctx.stroke()
  }
  ctx.setLineDash([])

  const [px, py] = toCanvas(store.grbl.wpos.x, store.grbl.wpos.y)
  ctx.beginPath()
  ctx.arc(px, py, 4, 0, Math.PI * 2)
  ctx.fillStyle = positionColor
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

watch(toolPath, () => {
  fitToView()
  draw()
})

// wpos参照の差し替えではなく実際の値変化のみで再描画する
watch(
  () => `${store.grbl.wpos.x},${store.grbl.wpos.y}`,
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
  <section class="panel">
    <div class="header">
      <h2 class="title">ツールパス</h2>
      <button class="iconButton" @click="fitToView(); draw()">全体表示</button>
    </div>
    <div ref="containerRef" class="canvasContainer">
      <canvas
        ref="canvasRef"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      />
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
  grid-column: span 2;
  grid-row: span 2;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.iconButton {
  border-radius: var(--radius-sm);
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}
.canvasContainer {
  flex: 1;
  min-height: 320px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
  cursor: grab;
}
</style>

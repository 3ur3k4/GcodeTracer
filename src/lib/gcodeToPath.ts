/**
 * Visualizer表示専用のGコード→2D線分(XY平面)変換。
 * grbl/parser.ts(GRBLの応答パース)とは無関係であり、GRBL通信とは独立に動作する
 * (3章の失敗パターン1「ステータス文字列パースの重複」には抵触しない)。
 *
 * スコープ: G0/G1(直線)、G2/G3(IJK形式の円弧のみ。R形式・XY以外の平面選択は対象外)、
 * G90/G91(絶対/相対)、G20/G21(インチ/mm、内部表現はmmに統一)。
 */

export interface PathSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  rapid: boolean
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ToolPath {
  segments: PathSegment[]
  bounds: Bounds
}

const INCH_TO_MM = 25.4
const ARC_STEP_RADIANS = Math.PI / 32 // 約5.6度刻みで円弧を線分近似する

function stripComment(line: string): string {
  return line.replace(/\(.*?\)/g, '').split(';')[0].trim()
}

function tokenize(line: string): Partial<Record<string, number>> {
  const words: Partial<Record<string, number>> = {}
  const pattern = /([A-Za-z])\s*(-?\d+(?:\.\d+)?)/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(line))) {
    words[match[1].toUpperCase()] = Number(match[2])
  }
  return words
}

interface ParseState {
  absolute: boolean
  unitsScale: number
  motion: 0 | 1 | 2 | 3 | null
  x: number
  y: number
}

function resolveAxis(raw: number | undefined, current: number, state: ParseState): number {
  if (raw === undefined) return current
  const scaled = raw * state.unitsScale
  return state.absolute ? scaled : current + scaled
}

export function gcodeToPath(lines: string[]): ToolPath {
  const state: ParseState = { absolute: true, unitsScale: 1, motion: null, x: 0, y: 0 }
  const segments: PathSegment[] = []
  const bounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

  function visit(x: number, y: number): void {
    bounds.minX = Math.min(bounds.minX, x)
    bounds.maxX = Math.max(bounds.maxX, x)
    bounds.minY = Math.min(bounds.minY, y)
    bounds.maxY = Math.max(bounds.maxY, y)
  }

  function appendArc(endX: number, endY: number, centerX: number, centerY: number, clockwise: boolean): void {
    const startX = state.x
    const startY = state.y
    const radius = Math.hypot(startX - centerX, startY - centerY)
    const startAngle = Math.atan2(startY - centerY, startX - centerX)
    const endAngle = Math.atan2(endY - centerY, endX - centerX)

    let delta = endAngle - startAngle
    if (clockwise && delta >= 0) delta -= 2 * Math.PI
    if (!clockwise && delta <= 0) delta += 2 * Math.PI

    const steps = Math.max(1, Math.ceil(Math.abs(delta) / ARC_STEP_RADIANS))
    let prevX = startX
    let prevY = startY
    for (let i = 1; i <= steps; i++) {
      const angle = startAngle + delta * (i / steps)
      const x = centerX + radius * Math.cos(angle)
      const y = centerY + radius * Math.sin(angle)
      segments.push({ x1: prevX, y1: prevY, x2: x, y2: y, rapid: false })
      visit(x, y)
      prevX = x
      prevY = y
    }
  }

  for (const rawLine of lines) {
    const line = stripComment(rawLine)
    if (!line) continue
    const words = tokenize(line)

    if (words.G !== undefined) {
      const g = words.G
      if (g === 90) state.absolute = true
      else if (g === 91) state.absolute = false
      else if (g === 20) state.unitsScale = INCH_TO_MM
      else if (g === 21) state.unitsScale = 1
      else if (g === 0 || g === 1 || g === 2 || g === 3) state.motion = g
    }

    const hasAxisWord = words.X !== undefined || words.Y !== undefined
    if (!hasAxisWord || state.motion === null) continue

    const targetX = resolveAxis(words.X, state.x, state)
    const targetY = resolveAxis(words.Y, state.y, state)

    if (state.motion === 0 || state.motion === 1) {
      segments.push({ x1: state.x, y1: state.y, x2: targetX, y2: targetY, rapid: state.motion === 0 })
      visit(targetX, targetY)
    } else {
      // G2(時計回り)/G3(反時計回り): IJK形式の円弧中心オフセットのみ対応
      const centerX = state.x + (words.I ?? 0) * state.unitsScale
      const centerY = state.y + (words.J ?? 0) * state.unitsScale
      appendArc(targetX, targetY, centerX, centerY, state.motion === 2)
    }

    state.x = targetX
    state.y = targetY
  }

  return { segments, bounds }
}

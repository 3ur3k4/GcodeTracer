/**
 * Renderer ⇄ Main の唯一の契約。zodスキーマと、そこから導出したTS型のみを置く。
 * Node/Electron APIへの依存はゼロ(Renderer/Preload/Mainの全プロセスからimport可能)。
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Renderer -> Main: ユーザー操作のdispatch(push一本、要件定義6.4の「例」を実装範囲として確定)
// ---------------------------------------------------------------------------

export const rendererToMainMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('connect'), path: z.string().min(1), baudRate: z.number().int().positive() }),
  z.object({ type: z.literal('disconnect') }),
  z.object({ type: z.literal('send-command'), command: z.string().min(1) }),
  z.object({
    type: z.literal('jog'),
    x: z.number(),
    y: z.number(),
    z: z.number(),
    stepSize: z.number().positive(),
  }),
  z.object({ type: z.literal('zero'), axis: z.enum(['X', 'Y', 'Z']) }),
  z.object({ type: z.literal('goto-work-zero') }),
  z.object({ type: z.literal('home') }),
  z.object({ type: z.literal('unlock') }),
  z.object({ type: z.literal('soft-reset') }),
  z.object({ type: z.literal('run-file'), lines: z.array(z.string()), startLine: z.number().int().min(0).default(0) }),
  z.object({ type: z.literal('pause') }),
  z.object({ type: z.literal('resume') }),
  z.object({ type: z.literal('cancel') }),
  z.object({ type: z.literal('set-poll-interval'), ms: z.number().int().positive() }),
  z.object({
    type: z.literal('update-osc-settings'),
    ip: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    enabled: z.boolean(),
  }),
  z.object({ type: z.literal('reveal-file'), filePath: z.string().min(1) }),
])

export type RendererToMainMessage = z.infer<typeof rendererToMainMessageSchema>

// list-ports は機械状態のpushに乗らない単発の問い合わせ/応答(invoke)として、
// dispatch一覧とは別チャンネルで扱う(要件定義6.4のRendererToMainMessage一覧は「例」と明記されているための拡張)。
export const portInfoSchema = z.object({
  path: z.string(),
  manufacturer: z.string().optional(),
})
export type PortInfo = z.infer<typeof portInfoSchema>

export const listPortsResponseSchema = z.array(portInfoSchema)

// ---------------------------------------------------------------------------
// Main -> Renderer: 状態の単一push
// ---------------------------------------------------------------------------

export const machineStateSchema = z.enum([
  'Idle',
  'Run',
  'Hold',
  'Alarm',
  'Door',
  'Home',
  'Check',
  'Unknown',
])
export type MachineState = z.infer<typeof machineStateSchema>

const positionSchema = z.object({ x: z.number(), y: z.number(), z: z.number() })

export const consoleLineSchema = z.object({
  id: z.number().int(),
  direction: z.enum(['tx', 'rx', 'info']),
  text: z.string(),
  timestamp: z.number(),
})
export type ConsoleLine = z.infer<typeof consoleLineSchema>

export const appStateSchema = z.object({
  connection: z.object({
    connected: z.boolean(),
    port: z.string().nullable(),
    baudRate: z.number(),
  }),
  grbl: z.object({
    machineState: machineStateSchema,
    mpos: positionSchema,
    wpos: positionSchema,
  }),
  job: z.object({
    running: z.boolean(),
    paused: z.boolean(),
    currentLine: z.number().int(),
    totalLines: z.number().int(),
  }),
  osc: z.object({
    ip: z.string(),
    port: z.number(),
    enabled: z.boolean(),
  }),
  console: z.object({
    lines: z.array(consoleLineSchema),
  }),
})

export type AppState = z.infer<typeof appStateSchema>

export const initialAppState: AppState = {
  connection: { connected: false, port: null, baudRate: 115200 },
  grbl: {
    machineState: 'Unknown',
    mpos: { x: 0, y: 0, z: 0 },
    wpos: { x: 0, y: 0, z: 0 },
  },
  job: { running: false, paused: false, currentLine: 0, totalLines: 0 },
  osc: { ip: '127.0.0.1', port: 9000, enabled: false },
  console: { lines: [] },
}

// ---------------------------------------------------------------------------
// IPCチャンネル名(preload.ts / gateway.ts で共有)
// ---------------------------------------------------------------------------

export const IPC_CHANNELS = {
  dispatch: 'gcode-tracer:dispatch',
  stateChanged: 'gcode-tracer:state-changed',
  listPorts: 'gcode-tracer:list-ports',
  fullscreenChanged: 'gcode-tracer:fullscreen-changed',
} as const

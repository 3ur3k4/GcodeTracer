/**
 * GRBLからの生データ(改行区切り)を構造化イベントへ変換する唯一の箇所。
 * - ステートレスな変換のみを担う。複数レポートをまたぐ記憶(例: WCOのキャッシュ)はgrbl/state.tsの責務。
 * - 改行をまたいで届く生データのバッファリング(ストリームのフレーミング)のみ内部状態として持つ。
 */
import type { MachineState } from '../../shared/ipcContract'

export interface Position {
  x: number
  y: number
  z: number
}

export type GrblEvent =
  | { type: 'ok' }
  | { type: 'error'; code: number }
  | { type: 'alarm'; code: number }
  | { type: 'status'; machineState: MachineState; mpos?: Position; wpos?: Position; wco?: Position }
  | { type: 'feedback'; message: string }
  | { type: 'welcome'; raw: string }
  | { type: 'unknown'; raw: string }

// GRBL 1.1のステータス報告は Jog/Sleep を含むが、AppStateのmachineStateは要件定義6.4で
// 確定済みの固定enumのため、それ以外の文字列はすべて'Unknown'にマップする。
const KNOWN_MACHINE_STATES: ReadonlySet<string> = new Set([
  'Idle',
  'Run',
  'Hold',
  'Alarm',
  'Door',
  'Home',
  'Check',
])

function toMachineState(raw: string): MachineState {
  const base = raw.split(':')[0]
  return KNOWN_MACHINE_STATES.has(base) ? (base as MachineState) : 'Unknown'
}

function parsePositionField(statusBody: string, field: 'MPos' | 'WPos' | 'WCO'): Position | undefined {
  const match = statusBody.match(new RegExp(`${field}:(-?[\\d.]+),(-?[\\d.]+),(-?[\\d.]+)`))
  if (!match) return undefined
  return { x: Number(match[1]), y: Number(match[2]), z: Number(match[3]) }
}

function parseStatusLine(line: string): GrblEvent {
  const body = line.slice(1, -1) // 先頭'<'・末尾'>'を除去
  const [stateToken] = body.split('|')
  return {
    type: 'status',
    machineState: toMachineState(stateToken),
    mpos: parsePositionField(body, 'MPos'),
    wpos: parsePositionField(body, 'WPos'),
    wco: parsePositionField(body, 'WCO'),
  }
}

export function parseLine(rawLine: string): GrblEvent | null {
  const line = rawLine.trim()
  if (line.length === 0) return null

  if (line === 'ok') return { type: 'ok' }

  const errorMatch = line.match(/^error:(\d+)$/i)
  if (errorMatch) return { type: 'error', code: Number(errorMatch[1]) }

  const alarmMatch = line.match(/^ALARM:(\d+)$/i)
  if (alarmMatch) return { type: 'alarm', code: Number(alarmMatch[1]) }

  if (line.startsWith('<') && line.endsWith('>')) return parseStatusLine(line)

  if (line.startsWith('[') && line.endsWith(']')) return { type: 'feedback', message: line.slice(1, -1) }

  if (/^Grbl\s/i.test(line)) return { type: 'welcome', raw: line }

  return { type: 'unknown', raw: line }
}

export class GrblParser {
  private buffer = ''

  /** 任意の境界で届く生データを受け取り、完成した行の分だけイベントを返す */
  feed(chunk: string): GrblEvent[] {
    this.buffer += chunk
    const parts = this.buffer.split(/\r?\n/)
    this.buffer = parts.pop() ?? ''
    const events: GrblEvent[] = []
    for (const part of parts) {
      const event = parseLine(part)
      if (event) events.push(event)
    }
    return events
  }
}

import { describe, expect, it } from 'vitest'
import { GrblParser, parseLine } from './parser'

describe('parseLine', () => {
  it('parses ok', () => {
    expect(parseLine('ok')).toEqual({ type: 'ok' })
  })

  it('parses error:N', () => {
    expect(parseLine('error:9')).toEqual({ type: 'error', code: 9 })
  })

  it('parses ALARM:N', () => {
    expect(parseLine('ALARM:1')).toEqual({ type: 'alarm', code: 1 })
  })

  it('parses a status report with MPos only', () => {
    const event = parseLine('<Idle|MPos:1.000,2.000,-3.500|FS:0,0>')
    expect(event).toEqual({
      type: 'status',
      machineState: 'Idle',
      mpos: { x: 1, y: 2, z: -3.5 },
      wpos: undefined,
      wco: undefined,
    })
  })

  it('parses a status report with MPos and WCO', () => {
    const event = parseLine('<Run|MPos:10.000,0.000,0.000|WCO:1.000,1.000,0.000>')
    expect(event).toEqual({
      type: 'status',
      machineState: 'Run',
      mpos: { x: 10, y: 0, z: 0 },
      wpos: undefined,
      wco: { x: 1, y: 1, z: 0 },
    })
  })

  it('strips Hold/Door sub-state suffix', () => {
    const event = parseLine('<Hold:0|MPos:0.000,0.000,0.000>')
    expect(event).toMatchObject({ machineState: 'Hold' })
  })

  it('maps unlisted GRBL states (e.g. Jog) to Unknown', () => {
    const event = parseLine('<Jog|MPos:0.000,0.000,0.000>')
    expect(event).toMatchObject({ machineState: 'Unknown' })
  })

  it('parses feedback messages', () => {
    expect(parseLine('[MSG:Caution: Unlocked]')).toEqual({
      type: 'feedback',
      message: 'MSG:Caution: Unlocked',
    })
  })

  it('parses the welcome banner', () => {
    expect(parseLine("Grbl 1.1h ['$' for help]")).toEqual({
      type: 'welcome',
      raw: "Grbl 1.1h ['$' for help]",
    })
  })

  it('falls back to unknown for unrecognized lines', () => {
    expect(parseLine('$0=10')).toEqual({ type: 'unknown', raw: '$0=10' })
  })

  it('returns null for blank lines', () => {
    expect(parseLine('   ')).toBeNull()
  })
})

describe('GrblParser.feed', () => {
  it('buffers partial lines across multiple chunks', () => {
    const parser = new GrblParser()
    expect(parser.feed('o')).toEqual([])
    expect(parser.feed('k\r\n')).toEqual([{ type: 'ok' }])
  })

  it('emits multiple events from a single chunk', () => {
    const parser = new GrblParser()
    const events = parser.feed('ok\r\nok\r\nerror:1\r\n')
    expect(events).toEqual([{ type: 'ok' }, { type: 'ok' }, { type: 'error', code: 1 }])
  })

  it('retains an incomplete trailing line for the next feed', () => {
    const parser = new GrblParser()
    expect(parser.feed('ok\r\n<Idle|MPos:0.0')).toEqual([{ type: 'ok' }])
    expect(parser.feed('00,0.000,0.000>\r\n')).toEqual([
      { type: 'status', machineState: 'Idle', mpos: { x: 0, y: 0, z: 0 }, wpos: undefined, wco: undefined },
    ])
  })
})

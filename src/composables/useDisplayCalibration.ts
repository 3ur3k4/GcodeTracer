import { ref } from 'vue'

// CSS standard: 96 logical pixels per inch
export const BASE_PX_PER_MM = 96 / 25.4

const FACTOR_KEY = 'display.calibrationFactor'
const MEASURED_KEY = 'display.lastMeasuredMm'

function loadFactor(): number {
  const raw = localStorage.getItem(FACTOR_KEY)
  const n = raw !== null ? parseFloat(raw) : NaN
  return isFinite(n) && n > 0 ? n : 1.0
}

function loadMeasuredMm(refMm: number): number {
  const raw = localStorage.getItem(MEASURED_KEY)
  const n = raw !== null ? parseFloat(raw) : NaN
  return isFinite(n) && n > 0 ? n : refMm
}

// Module-level singletons so all consumers share the same reactive refs
const calibrationFactor = ref(loadFactor())
const lastMeasuredMm = ref(loadMeasuredMm(50))

export function useDisplayCalibration() {
  function save(factor: number, measuredMm: number): void {
    calibrationFactor.value = factor
    lastMeasuredMm.value = measuredMm
    localStorage.setItem(FACTOR_KEY, String(factor))
    localStorage.setItem(MEASURED_KEY, String(measuredMm))
  }

  function reset(refMm: number): void {
    calibrationFactor.value = 1.0
    lastMeasuredMm.value = refMm
    localStorage.removeItem(FACTOR_KEY)
    localStorage.removeItem(MEASURED_KEY)
  }

  return { calibrationFactor, lastMeasuredMm, save, reset }
}

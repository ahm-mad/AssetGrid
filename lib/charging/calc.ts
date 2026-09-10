/**
 * Pure charging math — a 1:1 port of the old Laravel
 * `App\Traits\CalculateChargingValuesTrait` (arithmetic only; the e-mail / SMS
 * side effects of that trait are NOT reproduced here — alerting is slice 5).
 *
 * Every formula, magic number and `floor`/`round` is kept exactly as the old
 * code so `devices/charging/detail` stays byte-comparable against the ddev
 * oracle. Statuses are the same English strings the old API returned.
 */

export interface ChargingParams {
  battery_voltage: number | null
  battery_capacity: number | null
  charger_amperes: number | null
}

/** `calculateChargingProgress` — percent full, floored, 0 when battery energy is 0. */
export function calculateChargingProgress(
  energyConsumptionMeterConsumed: number | null | undefined,
  batteryEnergy: number | null | undefined,
): number {
  const consumed = Number(energyConsumptionMeterConsumed ?? 0)
  const battery = Number(batteryEnergy ?? 0)
  if (battery === 0) return 0
  return Math.floor((consumed / battery) * 100)
}

/** `calculateConsumedEnergy` — active energy in the trait's units, floored. */
export function calculateConsumedEnergy(
  activePower: number | null | undefined,
  energyConsumptionMeterElapsed: number | null | undefined,
): number {
  const active = Number(activePower ?? 0) * 0.1 * (Number(energyConsumptionMeterElapsed ?? 0) / 3600)
  return Math.floor(active)
}

/** `checkPowerFactor` — the old code scales by 0.01 then range-checks 0..100. */
export function checkPowerFactorStatus(powerFactor: number | null | undefined): 'Good' | 'Low' {
  if (powerFactor == null) return 'Low'
  const pf = Number(powerFactor) * 0.01
  return pf >= 0 && pf <= 100 ? 'Good' : 'Low'
}

export function voltageCurrentStatus(
  voltage: number | null | undefined,
  current: number | null | undefined,
): 'Within Range' | 'No values found' | 'Out of Range' {
  if (voltage == null && current == null) return 'No values found'
  const v = Number(voltage ?? 0) * 0.1
  const c = Number(current ?? 0) * 0.1
  if (v > 0 && v <= 6553.4 && c > 0 && c <= 6553.4) return 'Within Range'
  return 'Out of Range'
}

export function overcurrentStatus(
  current: number | null | undefined,
): 'Overcurrent Detected!' | 'No Overcurrent' {
  return Number(current ?? 0) > 30 * 0.1 ? 'Overcurrent Detected!' : 'No Overcurrent'
}

export function overvoltageStatus(
  voltage: number | null | undefined,
): 'Overvoltage Detected!' | 'No Overvoltage' {
  return Number(voltage ?? 0) > 6553.4 * 0.1 ? 'Overvoltage Detected!' : 'No Overvoltage'
}

/** `chargingTime` — remaining-time estimate as the trait's "Hours: h, Minutes: m" string. */
export function chargingTimeEstimate(
  energyConsumptionMeterElapsed: number | null | undefined,
  params: ChargingParams,
): string {
  if (params.battery_capacity == null && params.charger_amperes == null) {
    return 'Can Not Calculate Charging Time'
  }
  const capacity = Number(params.battery_capacity ?? 0)
  const amperes = Number(params.charger_amperes ?? 0)
  const estimatedTimeToFull = amperes === 0 ? 0 : capacity / amperes
  const estimatedTime = estimatedTimeToFull - Number(energyConsumptionMeterElapsed ?? 0) / 60 / 60
  const hours = Math.floor(estimatedTime)
  const minutes = Math.round((estimatedTime - hours) * 60)
  return `Hours: ${hours}, Minutes: ${minutes}`
}

import { mulberry32, series } from "@/lib/mock/dashboard"
import { listMockDevices } from "@/lib/mock/devices"
import type { UserDeviceBundle } from "@/lib/devices/data"
import type { TelemetryPoint } from "@/lib/telemetry/data"

/** Full device bundle (device + parameters + charging state) for the device detail page, keyed by id. */
export function getMockDeviceBundle(id: number): UserDeviceBundle {
  const all = listMockDevices({ perPage: 1000 }).rows
  const base = all.find((d) => d.id === id) ?? all[0]
  const rand = mulberry32(id * 97 + 3)
  const isOnline = base.status !== "critical"

  return {
    device: {
      id,
      xnid: `XN-${String(id).padStart(4, "0")}`,
      deviceName: base.name,
      deviceLocation: `${base.company} — Dock ${1 + (id % 6)}`,
      status: isOnline ? "captured" : "decline",
      devEui: `EUI${(1000000000000000 + id).toString(16).toUpperCase()}`,
      toggleStatus: isOnline,
      activatedAt: new Date(Date.now() - id * 86_400_000).toISOString(),
      inventoryDeviceId: id,
      inventoryDeviceName: base.product,
      productName: base.product,
      deviceTypeId: 1 + (id % 12),
      ownerId: `mock-owner-${id}`,
      ownerName: base.owner,
      ownerXnid: null,
      isOn: isOnline,
      isCharging: base.isCharging,
      lastReadingAt: new Date(Date.now() - base.lastSeenMinutesAgo * 60_000).toISOString(),
      notificationEmail: "alerts@assetgrid.test",
      notificationPhoneNumber: null,
      activationCode: `ACT-${String(id).padStart(6, "0")}`,
    },
    parameters: {
      id,
      devEui: `EUI${(1000000000000000 + id).toString(16).toUpperCase()}`,
      batteryVoltage: Math.round((11.5 + rand() * 2) * 10) / 10,
      batteryCapacity: 100,
      desiredCharging: 80,
      chargingLimits: 90,
      chargerVoltage: 13,
      chargerAmperes: 20,
      overCurrentProtection: true,
      overVoltageProtection: true,
      smsAlert: false,
      emailAlert: true,
      isDefault: false,
    },
    schedules: [],
    sunsetRises: [],
    chargingTimers: [],
    chargingState: {
      isOn: isOnline,
      isCharging: base.isCharging,
      lastStatus: isOnline ? "ok" : "offline",
      lastCommand: base.isCharging ? "start_charging" : "stop_charging",
      lastCommandAt: new Date(Date.now() - 45 * 60_000).toISOString(),
      devEui: `EUI${(1000000000000000 + id).toString(16).toUpperCase()}`,
    },
    chargingDetail: {
      hasReading: isOnline,
      activeEnergy: isOnline ? Math.round(rand() * 4200) : null,
      chargingProgress: base.isCharging ? Math.round(20 + rand() * 70) : null,
      powerFactorStatus: isOnline ? "normal" : null,
      voltageCurrentStatus: isOnline ? "normal" : null,
      overcurrentStatus: isOnline ? "normal" : null,
      overvoltageStatus: isOnline ? "normal" : null,
      chargingTime: base.isCharging ? "1h 24m remaining" : null,
      state: {
        isOn: isOnline,
        isCharging: base.isCharging,
        lastStatus: isOnline ? "ok" : "offline",
        lastCommand: base.isCharging ? "start_charging" : "stop_charging",
        lastCommandAt: new Date(Date.now() - 45 * 60_000).toISOString(),
        devEui: `EUI${(1000000000000000 + id).toString(16).toUpperCase()}`,
      },
    },
  }
}

/** A week of hourly power-draw telemetry for the device detail chart. */
export function getMockTelemetrySeries(id: number): TelemetryPoint[] {
  const values = series(48, 380, 140, id * 13 + 1)
  const now = Date.now()
  return values.map((v, i) => ({
    createdAt: new Date(now - (values.length - i) * 3_600_000).toISOString(),
    temperature: 68 + Math.round((v % 20) * 10) / 10,
    humidity: null,
    voltage: null,
    current: null,
    activePower: v,
    externalInput: null,
    move: null,
    reedState: null,
  }))
}

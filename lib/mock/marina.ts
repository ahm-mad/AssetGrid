import { mulberry32 } from "@/lib/mock/dashboard"
import type { MarinaTree, BoatNode, DockNode, SlipNode } from "@/lib/marina/data"
import type { MarinaBatteryRow, MarinaSensorCounts, MarinaAlertRow } from "@/lib/marina/dashboard"
import type { OccupancyReport } from "@/lib/marina/pms/reports"
import type { FleetGroup } from "@/components/charts/network-map"

const MARINA_NAMES = ["Harborline Marina", "Northstar Yacht Basin", "BlueWater Cove", "Summit Point Marina", "Coastal Ops Dock"]
const BOAT_NAMES = ["Sea Breeze", "Wanderlust", "Blue Horizon", "Tidal Drift", "Anchor's Away", "Salt Runner", "Nimbus", "Windward", "Reef Runner", "Northern Star"]

export interface MockMarinaBundle {
  marina: MarinaTree
  battery: MarinaBatteryRow[]
  counts: MarinaSensorCounts
  alerts: MarinaAlertRow[]
  picker: { inventoryDevices: { id: number; label: string }[]; userDevices: { id: number; label: string }[] }
  users: { id: string; name: string; xnid: string | null }[]
  occupancy: OccupancyReport
}

export function listMockMarinas(): MarinaTree[] {
  return MARINA_NAMES.map((_, i) => getMockMarinaBundle(i + 1).marina)
}

/** Slip occupancy across every marina — the marina list page's own natural grouping. */
export function getMockMarinaOccupancy(): FleetGroup[] {
  return MARINA_NAMES.map((_, i) => {
    const { marina, counts } = getMockMarinaBundle(i + 1)
    const occupiedSlips = marina.docks.reduce((s, d) => s + d.slips.filter((sl) => sl.boats.length > 0).length, 0)
    const occupancyPct = Math.round((occupiedSlips / marina.slipCount) * 100)
    return {
      id: String(i + 1),
      label: marina.marinaName ?? marina.marinaCode,
      deviceCount: marina.slipCount,
      onlinePct: occupancyPct,
      status: counts.alarmActive > 0 ? "critical" : occupancyPct > 90 ? "warning" : "online",
    }
  })
}

export function getMockMarinaBundle(id: number): MockMarinaBundle {
  const rand = mulberry32(id * 41 + 6)
  const name = MARINA_NAMES[(id - 1) % MARINA_NAMES.length]
  const dockCount = 3

  let boatIdSeq = 1
  let slipIdSeq = 1
  const docks: DockNode[] = Array.from({ length: dockCount }, (_, di) => {
    const slipCount = 4 + Math.floor(rand() * 3)
    const slips: SlipNode[] = Array.from({ length: slipCount }, (_, si) => {
      const occupied = rand() > 0.35
      const slipId = slipIdSeq++
      const boats: BoatNode[] = occupied
        ? [
            {
              id: boatIdSeq++,
              xnid: `BOAT-${slipId}`,
              boatName: BOAT_NAMES[(slipId + di) % BOAT_NAMES.length],
              boatType: rand() > 0.5 ? "Sailboat" : "Motor yacht",
              slipId,
              dockId: di + 1,
              userId: `mock-owner-${slipId}`,
              isAssigned: true,
              deviceCount: rand() > 0.4 ? 1 : 0,
              storageStatus: "in_water",
            },
          ]
        : []
      return {
        id: slipId,
        name: `Slip ${di + 1}-${si + 1}`,
        slipNumber: `${di + 1}${String(si + 1).padStart(2, "0")}`,
        slipStatus: occupied ? "occupied" : "vacant",
        occupancyStatus: occupied ? "occupied" : "vacant",
        isActive: true,
        minLoa: 20,
        maxLoa: 45,
        boats,
      }
    })
    return { id: di + 1, name: `Dock ${String.fromCharCode(65 + di)}`, slips }
  })

  const totalSlips = docks.reduce((s, d) => s + d.slips.length, 0)
  const totalBoats = docks.reduce((s, d) => s + d.slips.reduce((s2, sl) => s2 + sl.boats.length, 0), 0)

  const marina: MarinaTree = {
    id,
    marinaName: name,
    marinaCode: `MAR-${String(id).padStart(3, "0")}`,
    companyId: id,
    companyName: name.replace(" Marina", "").replace(" Yacht Basin", "").replace(" Cove", "").replace(" Point Marina", "").replace(" Dock", ""),
    onNetType: "Marina",
    structureCategory: "waterfront",
    city: "Fort Lauderdale",
    stateProvince: "FL",
    country: "USA",
    hasSvg: false,
    dockCount,
    slipCount: totalSlips,
    boatCount: totalBoats,
    uploadedSvg: null,
    mapRotation: 0,
    zoomLevel: 1,
    docks,
    unassignedBoats: [],
  }

  const allBoats = docks.flatMap((d) => d.slips.flatMap((s) => s.boats))
  const battery: MarinaBatteryRow[] = allBoats
    .filter((b) => b.deviceCount > 0)
    .map((b) => ({
      boatName: b.boatName,
      deviceName: `Bilgemax-${b.id}`,
      devEui: `EUI${(2000000000000000 + b.id).toString(16).toUpperCase()}`,
      voltage: Math.round((11.8 + rand() * 1.6) * 10) / 10,
      readingAt: new Date(Date.now() - rand() * 6 * 3_600_000).toISOString(),
    }))

  const total = battery.length
  const reporting = Math.round(total * (0.75 + rand() * 0.2))
  const counts: MarinaSensorCounts = {
    total,
    reporting,
    silent: total - reporting,
    alarmActive: rand() > 0.7 ? 1 : 0,
  }

  const alerts: MarinaAlertRow[] = Array.from({ length: Math.min(5, total) }, (_, i) => ({
    id: i + 1,
    boatId: allBoats[i]?.id ?? null,
    payload: { subject: rand() > 0.5 ? "Low battery" : "Bilge pump activity", value: Math.round(rand() * 100) },
    createdAt: new Date(Date.now() - i * 40 * 60_000).toISOString(),
  }))

  const occupancy: OccupancyReport = {
    perDock: docks.map((d) => ({
      dockId: d.id,
      dockName: d.name,
      occupancyPercent: Math.round((d.slips.filter((s) => s.boats.length > 0).length / d.slips.length) * 100),
    })),
  }

  return {
    marina,
    battery,
    counts,
    alerts,
    picker: {
      inventoryDevices: Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: `Bilgemax-${i + 1} · EUI${1000 + i}` })),
      userDevices: [],
    },
    users: [
      { id: "u1", name: "Alicia Ferreira", xnid: null },
      { id: "u2", name: "Marcus Wei", xnid: null },
    ],
    occupancy,
  }
}

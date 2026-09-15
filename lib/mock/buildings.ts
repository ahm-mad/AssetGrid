import { mulberry32 } from "@/lib/mock/dashboard"
import type { BuildingRow, BuildingTree, FloorNode, UnitNode, AreaNode, SiteNode } from "@/lib/buildings/data"
import type { BatteryStatusRow, SensorCounts } from "@/lib/buildings/dashboard"
import type { SiteMarker } from "@/components/charts/site-map"

export interface MockBuildingRow {
  id: number
  buildingCode: string
  companyName: string
  onNetType: string
  city: string
  stateProvince: string
  country: string
  siteCount: number
  status: "online" | "warning" | "critical"
  latitude: number | null
  longitude: number | null
}

const COMPANIES = ["Harborline Marinas", "Northstar Facilities", "BlueWater Group", "Summit Property Co.", "Coastal Ops"]
// Real city coordinates — this dataset is entirely synthetic, but the
// locations themselves are genuine (see SiteMap, which plots them honestly).
const CITIES: [string, string, string, number, number][] = [
  ["Fort Lauderdale", "FL", "USA", 26.1224, -80.1373],
  ["Newport", "RI", "USA", 41.4901, -71.3128],
  ["San Diego", "CA", "USA", 32.7157, -117.1611],
  ["Annapolis", "MD", "USA", 38.9784, -76.4922],
  ["Seattle", "WA", "USA", 47.6062, -122.3321],
]
const TYPES = ["Residential", "Commercial", "Marina", "Mixed-use"]

export const MOCK_BUILDINGS: MockBuildingRow[] = buildRows()

function buildRows(): MockBuildingRow[] {
  const rand = mulberry32(909)
  return COMPANIES.map((companyName, i) => {
    const roll = rand()
    const [city, stateProvince, country, latitude, longitude] = CITIES[i]
    return {
      id: i + 1,
      buildingCode: `BLD-${String(i + 1).padStart(3, "0")}`,
      companyName,
      onNetType: TYPES[Math.floor(rand() * TYPES.length)],
      city,
      stateProvince,
      country,
      siteCount: Math.round(6 + rand() * 20),
      status: roll > 0.85 ? "critical" : roll > 0.65 ? "warning" : "online",
      latitude,
      longitude,
    }
  })
}

export function mapRealToView(buildings: BuildingRow[]): MockBuildingRow[] {
  return buildings.map((b) => ({
    id: b.id,
    buildingCode: b.buildingCode,
    companyName: b.companyName ?? "—",
    onNetType: b.onNetType || "—",
    city: b.city ?? "",
    stateProvince: b.stateProvince ?? "",
    country: b.country ?? "",
    siteCount: b.siteCount,
    status: "online",
    latitude: b.latitude,
    longitude: b.longitude,
  }))
}

/** Shared by both the mock and real branches — MockBuildingRow carries lat/lng either way. */
export function buildingSites(buildings: MockBuildingRow[]): SiteMarker[] {
  return buildings
    .filter((b): b is MockBuildingRow & { latitude: number; longitude: number } => b.latitude != null && b.longitude != null)
    .map((b) => ({
      id: String(b.id),
      label: b.buildingCode,
      sublabel: [b.city, b.stateProvince].filter(Boolean).join(", "),
      lat: b.latitude,
      lng: b.longitude,
      deviceCount: b.siteCount,
      status: b.status,
    }))
}

const ROOMS = [
  "Lobby",
  "Mechanical Room",
  "Roof Access",
  "Electrical Closet",
  "Parking Garage",
  "Utility Room",
  "Server Room",
  "Stairwell A",
  "Stairwell B",
  "Loading Dock",
]
const PRODUCTS = ["eMAX Duplex", "MAX Switch", "Bilgemax Monitoring Kit", "Command Charge Controller", "Sensor Node"]

export interface MockBuildingBundle {
  building: BuildingTree
  battery: BatteryStatusRow[]
  counts: SensorCounts
  picker: { inventoryDevices: { id: number; label: string }[]; userDevices: { id: number; label: string }[] }
  users: { id: string; name: string; xnid: string | null }[]
}

/** Full floors → units → areas → sites tree for the building detail page (`app/app/buildings/[id]/page.tsx`). */
export function getMockBuildingBundle(id: number): MockBuildingBundle | null {
  const base = MOCK_BUILDINGS.find((b) => b.id === id)
  if (!base) return null
  const rand = mulberry32(id * 53 + 11)

  let siteIdSeq = id * 1000 + 1
  let areaIdSeq = id * 100 + 1
  let unitIdSeq = id * 10 + 1
  let floorIdSeq = id * 10 + 1
  let roomIdx = 0

  const floors: FloorNode[] = Array.from({ length: 2 + Math.floor(rand() * 2) }, (_, fi) => {
    const floorId = floorIdSeq++
    const units: UnitNode[] = Array.from({ length: 1 + Math.floor(rand() * 2) }, (_, ui) => {
      const unitId = unitIdSeq++
      const areas: AreaNode[] = Array.from({ length: 1 + Math.floor(rand() * 2) }, (_, ai) => {
        const areaId = areaIdSeq++
        const siteCount = rand() > 0.3 ? 1 + Math.floor(rand() * 2) : 0
        const sites: SiteNode[] = Array.from({ length: siteCount }, () => {
          const siteId = siteIdSeq++
          const hasDevice = rand() > 0.15
          return {
            id: siteId,
            xnid: `SITE-${siteId}`,
            roomName: ROOMS[roomIdx++ % ROOMS.length],
            point: String(Math.floor(rand() * 8)),
            areaId,
            userId: hasDevice && rand() > 0.5 ? `mock-owner-${siteId}` : null,
            inventoryDeviceId: hasDevice ? siteId : null,
            inventoryDeviceName: hasDevice ? PRODUCTS[siteId % PRODUCTS.length] : null,
            devEui: hasDevice ? `EUI${(3_000_000_000_000_000 + siteId).toString(16).toUpperCase()}` : null,
          }
        })
        return { id: areaId, name: `Area ${String.fromCharCode(65 + ai)}`, unitId, sites }
      })
      return { id: unitId, name: `Unit ${ui + 1}`, floorId, areas }
    })
    return { id: floorId, name: `Floor ${fi + 1}`, buildingId: id, units }
  })

  const building: BuildingTree = {
    id,
    buildingCode: base.buildingCode,
    companyId: id,
    companyName: base.companyName,
    onNetType: base.onNetType,
    structureCategory: "commercial",
    locationCode: `LOC-${id}`,
    countyCode: "",
    buildingIdCode: base.buildingCode,
    cityCode: "",
    streetAddress: null,
    city: base.city,
    stateProvince: base.stateProvince,
    country: base.country,
    postalCode: null,
    latitude: base.latitude,
    longitude: base.longitude,
    siteCount: base.siteCount,
    floors,
  }

  const allSites = floors.flatMap((f) => f.units.flatMap((u) => u.areas.flatMap((a) => a.sites)))
  const withDevice = allSites.filter((s) => s.inventoryDeviceId != null)
  const battery: BatteryStatusRow[] = withDevice.map((s) => ({
    siteId: s.id,
    roomName: s.roomName,
    deviceName: s.inventoryDeviceName,
    devEui: s.devEui,
    voltage: Math.round((11.8 + rand() * 1.6) * 10) / 10,
    readingAt: new Date(Date.now() - rand() * 20 * 3_600_000).toISOString(),
  }))

  const reporting = Math.round(withDevice.length * (0.7 + rand() * 0.25))
  const counts: SensorCounts = {
    total: withDevice.length,
    reporting,
    silent: withDevice.length - reporting,
    alarmActive: rand() > 0.75 ? 1 : 0,
    motion: Math.round(withDevice.length * rand() * 0.3),
  }

  return {
    building,
    battery,
    counts,
    picker: {
      inventoryDevices: Array.from({ length: 8 }, (_, i) => ({
        id: 9000 + i,
        label: `${PRODUCTS[i % PRODUCTS.length]}-${i + 1} · EUI${4000 + i}`,
      })),
      userDevices: [],
    },
    users: [
      { id: "u1", name: "Alicia Ferreira", xnid: null },
      { id: "u2", name: "Marcus Wei", xnid: null },
    ],
  }
}

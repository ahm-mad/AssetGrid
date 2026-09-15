import { mulberry32 } from "@/lib/mock/dashboard"
import type { BuildingRow } from "@/lib/buildings/data"
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

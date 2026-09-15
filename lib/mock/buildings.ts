import { mulberry32 } from "@/lib/mock/dashboard"
import type { BuildingRow } from "@/lib/buildings/data"

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
}

const COMPANIES = ["Harborline Marinas", "Northstar Facilities", "BlueWater Group", "Summit Property Co.", "Coastal Ops"]
const CITIES: [string, string, string][] = [
  ["Fort Lauderdale", "FL", "USA"],
  ["Newport", "RI", "USA"],
  ["San Diego", "CA", "USA"],
  ["Annapolis", "MD", "USA"],
  ["Seattle", "WA", "USA"],
]
const TYPES = ["Residential", "Commercial", "Marina", "Mixed-use"]

export const MOCK_BUILDINGS: MockBuildingRow[] = buildRows()

function buildRows(): MockBuildingRow[] {
  const rand = mulberry32(909)
  return COMPANIES.map((companyName, i) => {
    const roll = rand()
    return {
      id: i + 1,
      buildingCode: `BLD-${String(i + 1).padStart(3, "0")}`,
      companyName,
      onNetType: TYPES[Math.floor(rand() * TYPES.length)],
      city: CITIES[i][0],
      stateProvince: CITIES[i][1],
      country: CITIES[i][2],
      siteCount: Math.round(6 + rand() * 20),
      status: roll > 0.85 ? "critical" : roll > 0.65 ? "warning" : "online",
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
  }))
}

import type { AttributeRow, XupRow, AppRow, NotifieRow, DeviceTypeRow, ProductRow } from "@/lib/catalog/data"

export const MOCK_DEVICE_TYPES: DeviceTypeRow[] = [
  { id: 1, name: "eMAX Duplex", description: "Dual-relay shore-power charge controller" },
  { id: 2, name: "MAX Switch", description: "Remote on/off relay switch" },
  { id: 3, name: "Bilgemax Monitoring Kit", description: "Bilge pump activity + water sensor" },
  { id: 4, name: "Command Charge Controller", description: "Multi-bank battery charge controller" },
  { id: 5, name: "Sensor Node", description: "General-purpose environmental sensor" },
  { id: 6, name: "Temperature Probe", description: "Ambient / fridge temperature monitor" },
  { id: 7, name: "Humidity Sensor", description: "Bilge / cabin humidity monitor" },
  { id: 8, name: "Door Contact", description: "Open/closed contact sensor" },
  { id: 9, name: "Battery Monitor", description: "House-bank voltage + current monitor" },
  { id: 10, name: "Shore Power Sentinel", description: "Shore-power presence + fault detector" },
  { id: 11, name: "GPS Tracker", description: "Location + geofence tracker" },
  { id: 12, name: "Water Level Sensor", description: "Freshwater / waste tank level sensor" },
]

export const MOCK_NOTIFIES: NotifieRow[] = [
  { id: 1, name: "SMS + Email" },
  { id: 2, name: "Email only" },
  { id: 3, name: "SMS only" },
  { id: 4, name: "Push notification" },
]

export const MOCK_XUPS: XupRow[] = [
  { id: 1, code: "VOLT", dataType: "float", version: "v2", description: "Battery voltage", format: "0.0V", units: "V", label: "Voltage" },
  { id: 2, code: "TEMP", dataType: "float", version: "v2", description: "Ambient temperature", format: "0.0F", units: "°F", label: "Temperature" },
  { id: 3, code: "HUM", dataType: "float", version: "v1", description: "Relative humidity", format: "0%", units: "%", label: "Humidity" },
  { id: 4, code: "EXT_IN", dataType: "boolean", version: "v1", description: "External input state", format: null, units: null, label: "External input" },
  { id: 5, code: "MOVE", dataType: "boolean", version: "v1", description: "Motion detected", format: null, units: null, label: "Motion" },
  { id: 6, code: "REED", dataType: "int", version: "v1", description: "Reed switch state", format: null, units: null, label: "Reed state" },
]

export const MOCK_APPS: AppRow[] = [
  { id: 1, appName: "Bilge Monitor", optionalParameters: null, xupIds: [4, 5] },
  { id: 2, appName: "Battery Watch", optionalParameters: null, xupIds: [1] },
  { id: 3, appName: "Climate Log", optionalParameters: null, xupIds: [2, 3] },
  { id: 4, appName: "Access Log", optionalParameters: null, xupIds: [6] },
]

export const MOCK_ATTRIBUTES: AttributeRow[] = [
  { id: 1, subject: "Low battery voltage", alertMessage: "Battery voltage below threshold", threshold: "11.5", comparison: "lt", checkin: true, notifieId: 1, notifieName: "SMS + Email", xupId: 1, xupCode: "VOLT", description: null, alertChannel: "push", neoEventCode: null },
  { id: 2, subject: "High temperature", alertMessage: "Temperature above threshold", threshold: "95", comparison: "gt", checkin: true, notifieId: 2, notifieName: "Email only", xupId: 2, xupCode: "TEMP", description: null, alertChannel: "push", neoEventCode: null },
  { id: 3, subject: "Bilge pump running", alertMessage: "Bilge pump activated", threshold: null, comparison: "eq", checkin: false, notifieId: 1, notifieName: "SMS + Email", xupId: 4, xupCode: "EXT_IN", description: null, alertChannel: "push", neoEventCode: null },
  { id: 4, subject: "Motion detected", alertMessage: "Motion sensor triggered", threshold: null, comparison: "eq", checkin: false, notifieId: 4, notifieName: "Push notification", xupId: 5, xupCode: "MOVE", description: null, alertChannel: "push", neoEventCode: null },
  { id: 5, subject: "Door opened", alertMessage: "Contact sensor opened", threshold: null, comparison: "eq", checkin: false, notifieId: 3, notifieName: "SMS only", xupId: 6, xupCode: "REED", description: null, alertChannel: "push", neoEventCode: null },
  { id: 6, subject: "High humidity", alertMessage: "Humidity above threshold", threshold: "70", comparison: "gt", checkin: true, notifieId: 2, notifieName: "Email only", xupId: 3, xupCode: "HUM", description: null, alertChannel: "push", neoEventCode: null },
]

const PRODUCT_NAMES: [string, string][] = [
  ["eMAX Duplex Kit", "EMAX-DPX-01"],
  ["MAX Switch Relay", "MAX-SW-01"],
  ["Bilgemax Monitoring Kit", "BMX-MON-01"],
  ["Command Charge Controller", "CMD-CC-01"],
  ["Sensor Node Basic", "SNS-NODE-01"],
  ["Temperature Probe Pro", "TEMP-PRO-01"],
  ["Battery Monitor Plus", "BAT-MON-01"],
  ["GPS Tracker Mini", "GPS-MINI-01"],
]

export const MOCK_PRODUCTS: ProductRow[] = PRODUCT_NAMES.map(([productName, sku], i) => ({
  id: i + 1,
  productName,
  sku,
  price: [199, 89, 149, 249, 59, 79, 129, 169][i] ?? 99,
  status: i !== 5,
  deviceTypeName: MOCK_DEVICE_TYPES[i % MOCK_DEVICE_TYPES.length].name,
  notifieName: MOCK_NOTIFIES[i % MOCK_NOTIFIES.length].name,
  companyName: null,
}))

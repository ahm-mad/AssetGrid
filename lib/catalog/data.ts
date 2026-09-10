import 'server-only'

import { createClient } from '@/utils/supabase/server'

export interface AttributeRow {
  id: number
  subject: string
  alertMessage: string | null
  threshold: string | null
  comparison: string
  checkin: boolean
  notifieId: number
  notifieName: string | null
  xupId: number | null
  xupCode: string | null
  description: string | null
  alertChannel: string
  neoEventCode: string | null
}

export interface XupRow {
  id: number
  code: string
  dataType: string
  version: string
  description: string | null
  format: string | null
  units: string | null
  label: string | null
}

export interface AppRow {
  id: number
  appName: string
  optionalParameters: unknown
  xupIds: number[]
}

export interface NotifieRow {
  id: number
  name: string | null
}

export interface DeviceTypeRow {
  id: number
  name: string
  description: string | null
}

export interface ProductRow {
  id: number
  productName: string | null
  sku: string | null
  price: number | null
  status: boolean
  deviceTypeName: string | null
  notifieName: string | null
  companyName: string | null
}

export async function listAttributes(): Promise<AttributeRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attributes')
    .select(
      'id, subject, alert_message, threshold, comparison, checkin, notifie_id, xup_id, description, alert_channel, neo_event_code, notifie:notifies(name), xup:xups(code)',
    )
    .order('id')
  return (data ?? []).map((a) => ({
    id: a.id,
    subject: a.subject,
    alertMessage: a.alert_message,
    threshold: a.threshold,
    comparison: a.comparison,
    checkin: a.checkin,
    notifieId: a.notifie_id,
    notifieName: (a.notifie as { name?: string } | null)?.name ?? null,
    xupId: a.xup_id,
    xupCode: (a.xup as { code?: string } | null)?.code ?? null,
    description: a.description,
    alertChannel: a.alert_channel,
    neoEventCode: a.neo_event_code,
  }))
}

export async function listXups(): Promise<XupRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('xups').select('*').order('id')
  return (data ?? []).map((x) => ({
    id: x.id,
    code: x.code,
    dataType: x.data_type,
    version: x.version,
    description: x.description,
    format: x.format,
    units: x.units,
    label: x.label,
  }))
}

export async function listApps(): Promise<AppRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('apps')
    .select('id, app_name, optional_parameters, app_xup(xup_id)')
    .order('id')
  return (data ?? []).map((a) => ({
    id: a.id,
    appName: a.app_name,
    optionalParameters: a.optional_parameters,
    xupIds: ((a.app_xup as { xup_id: number }[] | null) ?? []).map((r) => r.xup_id),
  }))
}

export async function listNotifies(): Promise<NotifieRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('notifies').select('id, name').order('id')
  return data ?? []
}

export async function listDeviceTypes(): Promise<DeviceTypeRow[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('device_types').select('id, name, description').order('id')
  return data ?? []
}

export async function listProducts(): Promise<ProductRow[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('products')
    .select(
      'id, product_name, sku, price, status, device_type:device_types(name), notifie:notifies(name), company:companies(company_name)',
    )
    .order('id')
    .limit(200)
  return (data ?? []).map((p) => ({
    id: p.id,
    productName: p.product_name,
    sku: p.sku,
    price: p.price,
    status: p.status,
    deviceTypeName: (p.device_type as { name?: string } | null)?.name ?? null,
    notifieName: (p.notifie as { name?: string } | null)?.name ?? null,
    companyName: (p.company as { company_name?: string } | null)?.company_name ?? null,
  }))
}

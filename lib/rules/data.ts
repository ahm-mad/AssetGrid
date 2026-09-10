import 'server-only'

import { createClient } from '@/utils/supabase/server'

/**
 * Customer Rule Builder reads — replaces `CustomerNotifieRuleBuilderController`
 * (whose `GET /rules` currently 500s — B39). RLS: a user sees their own
 * `alert_rules`; a `rulebuilder` reader sees all.
 */

export interface RuleDevice {
  product_id: number
  user_device_id: number
  inventory_device_id: number
}

export interface RuleConditionRow {
  selectedAttribute?: string
  selectedCondition?: string
  conditionValue?: unknown
  logicalOperator?: 'AND' | 'OR'
}

export interface RuleRow {
  id: number
  title: string | null
  isActive: boolean
  userId: string
  ownerName: string | null
  devices: RuleDevice[]
  conditions: RuleConditionRow[]
  conditionsCount: number
  notifie: string | null
  createdAt: string
}

const SELECT =
  'id, title, is_active, user_id, devices, conditions, notifie, created_at, owner:profiles(first_name, last_name, xnid)'

function toRule(r: {
  id: number
  title: string | null
  is_active: boolean
  user_id: string
  devices: unknown
  conditions: unknown
  notifie: string | null
  created_at: string
  owner: { first_name: string | null; last_name: string | null; xnid: string | null } | null
}): RuleRow {
  const conditions = (r.conditions as RuleConditionRow[] | null) ?? []
  const o = r.owner
  return {
    id: r.id,
    title: r.title,
    isActive: r.is_active,
    userId: r.user_id,
    ownerName: o ? [o.first_name, o.last_name].filter(Boolean).join(' ') || o.xnid || null : null,
    devices: (r.devices as RuleDevice[] | null) ?? [],
    conditions,
    conditionsCount: conditions.length,
    notifie: r.notifie,
    createdAt: r.created_at,
  }
}

export async function listRules(params: { userId?: string; search?: string } = {}): Promise<
  RuleRow[]
> {
  const supabase = await createClient()
  let query = supabase.from('alert_rules').select(SELECT).order('id', { ascending: false })
  if (params.userId) query = query.eq('user_id', params.userId)
  if (params.search?.trim()) query = query.ilike('title', `%${params.search.trim().replace(/[%,]/g, '')}%`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map((r) => toRule(r as never))
}

export async function getRule(id: number): Promise<RuleRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('alert_rules').select(SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toRule(data as never) : null
}

/**
 * Devices the user can build rules on (their captured `user_devices`) + the
 * attribute keys the rule DSL can reference.
 */
export async function getRuleFormOptions(userId: string): Promise<{
  devices: { userDeviceId: number; inventoryDeviceId: number; productId: number; label: string }[]
  attributes: string[]
}> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('user_devices')
    .select(
      'id, device_name, inventory_device_id, inventory_device:inventory_devices(product_id, dev_eui)',
    )
    .eq('user_id', userId)
    .eq('status', 'captured')
    .order('id')

  const devices = (data ?? [])
    .filter((d) => d.inventory_device_id)
    .map((d) => {
      const inv = d.inventory_device as { product_id?: number; dev_eui?: string | null } | null
      return {
        userDeviceId: d.id,
        inventoryDeviceId: d.inventory_device_id as number,
        productId: inv?.product_id ?? 0,
        label: `${d.device_name ?? `#${d.id}`}${inv?.dev_eui ? ` · ${inv.dev_eui}` : ''}`,
      }
    })

  // The five telemetry channels + the electrical fields the DSL can compare.
  const { data: xups } = await supabase.from('xups').select('data_type').order('id')
  const attributes = [
    ...new Set([
      ...(xups ?? []).map((x) => x.data_type),
      'voltage',
      'current',
      'active_power',
      'power_factor',
    ]),
  ]

  return { devices, attributes }
}

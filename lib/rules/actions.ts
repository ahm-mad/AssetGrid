'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth/guards'
import { can } from '@/lib/auth/permissions'

/**
 * Customer Rule Builder mutations — ports `CustomerNotifieRuleBuilderController`
 * `@store` / `@update` / `@destroy` / `@bulk*`. **Fixes B39** (the old list
 * endpoint 500s; the intent — scoped CRUD of `alert_rules` — is what we keep).
 *
 * Gate: a user manages their own rules; a `rulebuilder` writer manages any.
 */

export interface RuleResult {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string[]>
  id?: number
}

async function gate(action: 'create' | 'update' | 'delete') {
  const actor = await requireAuth()
  if (actor.isSuperAdmin || actor.isCustomer || can(actor.permissions, 'rulebuilder', action)) {
    return actor
  }
  throw new Error('Not authorised to manage alert rules.')
}

const conditionSchema = z.object({
  selectedAttribute: z.string().min(1),
  selectedCondition: z.enum(['>', '<', '>=', '<=', '==', '!=', '-']),
  conditionValue: z.union([z.string(), z.number(), z.boolean()]),
  logicalOperator: z.enum(['AND', 'OR']).default('AND'),
})

const deviceSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  user_device_id: z.coerce.number().int().positive(),
  inventory_device_id: z.coerce.number().int().positive(),
})

const ruleSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  title: z.string().trim().min(1).max(255),
  is_active: z.coerce.boolean().default(true),
  devices: z.array(deviceSchema).min(1),
  conditions: z.array(conditionSchema).min(1),
  notifie: z.string().trim().max(255).optional(),
})

function normalize(conditions: unknown[]): string {
  return JSON.stringify(
    [...conditions].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  )
}

export async function saveRule(input: unknown): Promise<RuleResult> {
  const hasId = !!(input && (input as { id?: unknown }).id)
  const actor = await gate(hasId ? 'update' : 'create')
  const parsed = ruleSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  const v = parsed.data
  const supabase = await createClient()

  // Conflict check — a device may not carry the same condition set in two rules.
  const norm = normalize(v.conditions)
  const { data: mine } = await supabase
    .from('alert_rules')
    .select('id, devices, conditions')
    .eq('user_id', actor.id)
  for (const existing of mine ?? []) {
    if (v.id && existing.id === v.id) continue
    const existingDevices = (existing.devices as { inventory_device_id?: number }[] | null) ?? []
    const clash = v.devices.some((d) =>
      existingDevices.some((e) => e.inventory_device_id === d.inventory_device_id),
    )
    if (clash && normalize((existing.conditions as unknown[]) ?? []) === norm) {
      return { ok: false, error: 'A device here already has the same conditions in another rule.' }
    }
  }

  const row = {
    title: v.title,
    is_active: v.is_active,
    devices: v.devices as never,
    conditions: v.conditions as never,
    notifie: v.notifie || null,
  }

  if (v.id) {
    const { error } = await supabase.from('alert_rules').update(row).eq('id', v.id)
    if (error) return { ok: false, error: 'Could not update the rule.' }
    revalidatePath('/app/rules')
    return { ok: true, id: v.id }
  }

  const { data, error } = await supabase
    .from('alert_rules')
    .insert({ ...row, user_id: actor.id })
    .select('id')
    .single()
  if (error || !data) return { ok: false, error: 'Could not create the rule.' }
  revalidatePath('/app/rules')
  return { ok: true, id: data.id }
}

export async function deleteRule(id: number): Promise<RuleResult> {
  await gate('delete')
  const supabase = await createClient()
  const { error } = await supabase.from('alert_rules').delete().eq('id', id)
  if (error) return { ok: false, error: 'Could not delete the rule.' }
  revalidatePath('/app/rules')
  return { ok: true }
}

export async function bulkSetRuleActive(ids: number[], active: boolean): Promise<RuleResult> {
  await gate('update')
  if (ids.length === 0) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase.from('alert_rules').update({ is_active: active }).in('id', ids)
  if (error) return { ok: false, error: 'Could not update the rules.' }
  revalidatePath('/app/rules')
  return { ok: true }
}

export async function bulkDeleteRules(ids: number[]): Promise<RuleResult> {
  await gate('delete')
  if (ids.length === 0) return { ok: true }
  const supabase = await createClient()
  const { error } = await supabase.from('alert_rules').delete().in('id', ids)
  if (error) return { ok: false, error: 'Could not delete the rules.' }
  revalidatePath('/app/rules')
  return { ok: true }
}

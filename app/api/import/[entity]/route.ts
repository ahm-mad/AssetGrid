import { handler, ok } from '@/lib/api/envelope'
import { ApiError } from '@/lib/api/errors'
import { requirePermission } from '@/lib/auth/guards'
import { importInventory } from '@/lib/import/inventory'
import { importBuilding } from '@/lib/import/building'
import { importMarina } from '@/lib/import/marina'
import { importCustomers } from '@/lib/import/customers'
import type { ImportOutcome } from '@/lib/import/parse'

/**
 * `POST /api/import/{inventory|building|marina|customers}` — 1:1 with the
 * Laravel `import/*` routes. Accepts `multipart/form-data` (the old field names
 * `inventory_csv` / `buildings_csv` / `marina_csv` / `customers_csv` all work,
 * as does any file field). Returns `{ inserted, updated, skipped, warnings,
 * errors, errorReportUrl }`.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENTITIES: Record<
  string,
  { module: string; run: (file: File) => Promise<ImportOutcome> }
> = {
  inventory: { module: 'inventory', run: importInventory },
  building: { module: 'buildings', run: importBuilding },
  marina: { module: 'marina', run: importMarina },
  customers: { module: 'systems', run: importCustomers },
}

export const POST = handler(async (req: Request, ctx: { params: Promise<{ entity: string }> }) => {
  const { entity } = await ctx.params
  const cfg = ENTITIES[entity]
  if (!cfg) throw new ApiError(404, `Unknown import entity: ${entity}`)

  await requirePermission(cfg.module, 'create')

  const form = await req.formData()
  let file: File | null = null
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0) {
      file = value
      break
    }
  }
  if (!file) throw new ApiError(422, 'No valid CSV file was uploaded.')

  const result = await cfg.run(file)
  return ok(result)
})

import 'server-only'

import { createClient } from '@/utils/supabase/server'

export interface CompanyOption {
  id: number
  name: string
}

export async function getCompanyOptions(): Promise<CompanyOption[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('companies')
    .select('id, company_name')
    .order('company_name')
  return (data ?? []).map((c) => ({ id: c.id, name: c.company_name }))
}

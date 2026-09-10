import 'server-only'

import { createClient } from '@/utils/supabase/server'
import { requireAuth } from '@/lib/auth/guards'

export interface MyProfile {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  roleTitle: string
  xnid: string | null
  details: {
    phoneNumber: string | null
    phoneType: string | null
    address1: string | null
    address2: string | null
    city: string | null
    state: string | null
    country: string | null
    postalCode: string | null
  } | null
}

/** The signed-in user's own profile + details. Shared by the page and the API. */
export async function getMyProfile(): Promise<MyProfile> {
  const user = await requireAuth()
  const supabase = await createClient()

  const { data: details } = await supabase
    .from('profile_details')
    .select(
      'phone_number, phone_type, address_1, address_2, city, state, country, postal_code',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roleTitle: user.roleTitle,
    xnid: null,
    details: details
      ? {
          phoneNumber: details.phone_number,
          phoneType: details.phone_type,
          address1: details.address_1,
          address2: details.address_2,
          city: details.city,
          state: details.state,
          country: details.country,
          postalCode: details.postal_code,
        }
      : null,
  }
}

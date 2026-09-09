export type RoleTitle =
  | 'Super Admin'
  | 'Admin'
  | 'Customer'
  | 'Manager'
  | 'Dealer'
  | 'Partner'

export type PermissionAction = 'read' | 'create' | 'update' | 'delete'

export interface ModulePermission {
  module_id: number
  code: string
  can_read: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
}

/** The identity DTO returned by the DAL. Only fields the app needs — never a whole row. */
export interface CurrentUser {
  id: string
  email: string | null
  legacyId: number | null
  firstName: string | null
  lastName: string | null
  roleTypeId: number
  roleTitle: RoleTitle | string
  companyId: number | null
  domainId: number | null
  isSuperAdmin: boolean
  isCustomer: boolean
  permissions: ModulePermission[]
  /** The real actor's uuid while impersonating, else null. */
  impersonatorId: string | null
}

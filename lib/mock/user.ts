import type { CurrentUser } from '@/lib/auth/types'

/** Full-access Super Admin identity for UI_MOCK_MODE — see lib/mock/enabled.ts. */
export const MOCK_USER: CurrentUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'devadmin@assetgrid.test',
  legacyId: null,
  firstName: 'Dev',
  lastName: 'Admin',
  roleTypeId: 1,
  roleTitle: 'Super Admin',
  companyId: null,
  domainId: null,
  isSuperAdmin: true,
  isCustomer: false,
  permissions: [
    { module_id: 1, code: 'dashboard', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 2, code: 'inventory', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 3, code: 'catalog', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 4, code: 'buildings', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 5, code: 'marina', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 6, code: 'messaging', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 7, code: 'rulebuilder', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 8, code: 'commerce', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 9, code: 'roles_permissions', can_read: true, can_create: true, can_update: true, can_delete: true },
    { module_id: 10, code: 'systems', can_read: true, can_create: true, can_update: true, can_delete: true },
  ],
  impersonatorId: null,
}

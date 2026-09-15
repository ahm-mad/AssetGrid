import { requirePagePermission } from "@/lib/auth/page-guards";
import { can } from "@/lib/auth/permissions";
import {
  listAttributes,
  listXups,
  listApps,
  listNotifies,
  listDeviceTypes,
  listProducts,
} from "@/lib/catalog/data";
import { UI_MOCK } from "@/lib/mock/enabled";
import {
  MOCK_ATTRIBUTES,
  MOCK_XUPS,
  MOCK_APPS,
  MOCK_NOTIFIES,
  MOCK_DEVICE_TYPES,
  MOCK_PRODUCTS,
} from "@/lib/mock/catalog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatTile } from "@/components/charts/stat-tile";

import { AttributesTab } from "./attributes-tab";
import { XupsTab } from "./xups-tab";
import { NotifiesTab, DeviceTypesTab, AppsTab, ProductsTab } from "./misc-tabs";

export const metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const user = await requirePagePermission("catalog", "read");

  const [attributes, xups, apps, notifies, deviceTypes, products] = UI_MOCK
    ? [MOCK_ATTRIBUTES, MOCK_XUPS, MOCK_APPS, MOCK_NOTIFIES, MOCK_DEVICE_TYPES, MOCK_PRODUCTS]
    : await Promise.all([
        listAttributes(),
        listXups(),
        listApps(),
        listNotifies(),
        listDeviceTypes(),
        listProducts(),
      ]);

  const canEdit = user.isSuperAdmin || can(user.permissions, "catalog", "update");
  const canCreate = user.isSuperAdmin || can(user.permissions, "catalog", "create");
  const canDelete = user.isSuperAdmin || can(user.permissions, "catalog", "delete");
  const canEditNotifies =
    user.isSuperAdmin || user.isCustomer || can(user.permissions, "messaging", "update");

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Catalog</h1>
        <p className="text-muted-foreground text-sm">
          Products, alert attributes, telemetry channels (xUP), app profiles, device types.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatTile label="Products" value={products.length} status="online" />
        <StatTile label="Device types" value={deviceTypes.length} status="info" />
        <StatTile label="Attributes" value={attributes.length} status="info" />
        <StatTile label="xUPs" value={xups.length} status="info" />
        <StatTile label="Apps" value={apps.length} status="info" />
        <StatTile label="Notifies" value={notifies.length} status="info" />
      </div>

      <Tabs defaultValue="attributes">
        <TabsList className="flex-wrap">
          <TabsTrigger value="attributes">Attributes</TabsTrigger>
          <TabsTrigger value="xups">xUPs</TabsTrigger>
          <TabsTrigger value="apps">Apps</TabsTrigger>
          <TabsTrigger value="notifies">Notifies</TabsTrigger>
          <TabsTrigger value="device-types">Device types</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes">
          <AttributesTab
            rows={attributes}
            notifies={notifies}
            xups={xups}
            canEdit={canCreate || canEdit}
            canDelete={canDelete}
          />
        </TabsContent>
        <TabsContent value="xups">
          <XupsTab rows={xups} canEdit={canCreate || canEdit} canDelete={canDelete} />
        </TabsContent>
        <TabsContent value="apps">
          <AppsTab rows={apps} xups={xups} />
        </TabsContent>
        <TabsContent value="notifies">
          <NotifiesTab rows={notifies} canEdit={canEditNotifies} />
        </TabsContent>
        <TabsContent value="device-types">
          <DeviceTypesTab rows={deviceTypes} canEdit={canCreate || canEdit} />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab rows={products} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

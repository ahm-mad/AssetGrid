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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatTile } from "@/components/charts/stat-tile";

import { AttributesTab } from "./attributes-tab";
import { XupsTab } from "./xups-tab";
import { NotifiesTab, DeviceTypesTab, AppsTab, ProductsTab } from "./misc-tabs";

export const metadata = { title: "Catalog" };

export default async function CatalogPage() {
  const user = await requirePagePermission("catalog", "read");

  const [attributes, xups, apps, notifies, deviceTypes, products] = await Promise.all([
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
        <h1 className="text-lg font-semibold">Catalog</h1>
        <p className="text-muted-foreground text-sm">
          Products, alert attributes, telemetry channels (xUP), app profiles, device types.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatTile label="Products" value={products.length} />
        <StatTile label="Device types" value={deviceTypes.length} />
        <StatTile label="Attributes" value={attributes.length} />
        <StatTile label="xUPs" value={xups.length} />
        <StatTile label="Apps" value={apps.length} />
        <StatTile label="Notifies" value={notifies.length} />
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

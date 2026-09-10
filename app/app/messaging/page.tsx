import { requireUser } from "@/lib/auth/dal";
import { notFound } from "next/navigation";
import { can } from "@/lib/auth/permissions";
import {
  getMyNotificationPrefs,
  listAlertWindows,
  listDeviceRecipients,
} from "@/lib/messaging/data";
import { getDevicePickerOptions } from "@/lib/inventory/data";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { NotificationPrefsForm } from "./notification-prefs-form";
import { AlertWindowsTab } from "./alert-windows-tab";
import { DeviceRecipientsTab } from "./device-recipients-tab";

export const metadata = { title: "Messaging" };

export default async function MessagingPage() {
  const viewer = await requireUser();
  const allowed =
    viewer.isSuperAdmin || viewer.isCustomer || can(viewer.permissions, "messaging", "read");
  if (!allowed) notFound();

  const canWindows =
    viewer.isSuperAdmin || can(viewer.permissions, "rulebuilder", "read");

  const [prefs, windows, recipients, options] = await Promise.all([
    getMyNotificationPrefs(viewer.id),
    canWindows ? listAlertWindows() : Promise.resolve([]),
    listDeviceRecipients(),
    getDevicePickerOptions(),
  ]);

  const canWindowsWrite = viewer.isSuperAdmin || can(viewer.permissions, "rulebuilder", "create");

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-lg font-semibold">Messaging</h1>
        <p className="text-muted-foreground text-sm">
          Notification channel preferences, quiet-hours windows, and per-device alert recipients.
        </p>
      </div>

      <Tabs defaultValue="prefs">
        <TabsList className="flex-wrap">
          <TabsTrigger value="prefs">My notifications</TabsTrigger>
          {canWindows ? <TabsTrigger value="windows">Alert windows</TabsTrigger> : null}
          <TabsTrigger value="recipients">Device recipients</TabsTrigger>
        </TabsList>

        <TabsContent value="prefs">
          <NotificationPrefsForm prefs={prefs} />
        </TabsContent>
        {canWindows ? (
          <TabsContent value="windows">
            <AlertWindowsTab
              rows={windows}
              inventoryDevices={options.inventoryDevices}
              canWrite={canWindowsWrite}
            />
          </TabsContent>
        ) : null}
        <TabsContent value="recipients">
          <DeviceRecipientsTab rows={recipients} userDevices={options.userDevices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

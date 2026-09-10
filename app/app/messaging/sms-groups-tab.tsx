"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createSmsGroup,
  updateSmsGroup,
  deleteSmsGroup,
  adminBroadcast,
} from "@/lib/sms/groups-actions";
import type { SmsGroupRow } from "@/lib/sms/groups-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SmsGroupsTab({
  groups,
  admins,
  canWrite,
  canDelete,
}: {
  groups: SmsGroupRow[];
  admins: { id: string; name: string }[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();

  // create form
  const [name, setName] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [adminId, setAdminId] = React.useState("");
  const [adminPhone, setAdminPhone] = React.useState("");
  const [members, setMembers] = React.useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, okMsg = "Done.") {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Action failed.");
      else {
        toast.success(okMsg);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4">
      <p className="text-muted-foreground text-sm">
        Twilio is not configured — messages are logged to the audit outbox, not actually sent.
      </p>

      {canWrite ? (
        <div className="grid gap-3 rounded-lg border p-4">
          <h2 className="text-sm font-semibold">New group</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Group name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Group number (Twilio)">
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="+1..." />
            </Field>
            <Field label="Admin">
              <Select value={adminId} onValueChange={(v) => setAdminId(v ?? "")}>
                <SelectTrigger><SelectValue placeholder="Select an admin" /></SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Admin phone">
              <Input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="+1..." />
            </Field>
          </div>
          <Field label="Member numbers (comma-separated, optional)">
            <Input value={members} onChange={(e) => setMembers(e.target.value)} placeholder="+1..., +1..." />
          </Field>
          <Button
            size="sm"
            disabled={pending || !name || !number || !adminId || !adminPhone}
            onClick={() =>
              run(
                async () => {
                  const res = await createSmsGroup({
                    group_name: name,
                    group_number: number,
                    admin_id: adminId,
                    admin_phone: adminPhone,
                    user_numbers: members || null,
                  });
                  if (res.ok) {
                    setName("");
                    setNumber("");
                    setMembers("");
                  }
                  return res;
                },
                "Group created.",
              )
            }
          >
            Create group
          </Button>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p className="text-muted-foreground text-sm">No SMS groups yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Admin</TableHead>
              <TableHead>Members</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                canWrite={canWrite}
                canDelete={canDelete}
                pending={pending}
                run={run}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function GroupRow({
  group,
  canWrite,
  canDelete,
  pending,
  run,
}: {
  group: SmsGroupRow;
  canWrite: boolean;
  canDelete: boolean;
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => void;
}) {
  const [broadcast, setBroadcast] = React.useState("");
  const [editMembers, setEditMembers] = React.useState("");
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <TableRow>
        <TableCell>{group.groupName}</TableCell>
        <TableCell className="font-mono text-xs">{group.groupAssignedNum}</TableCell>
        <TableCell className="text-xs">{group.adminName ?? group.adminNumber ?? "—"}</TableCell>
        <TableCell>
          <Badge variant="secondary">{group.memberCount}</Badge>
        </TableCell>
        <TableCell className="flex gap-1">
          {canWrite ? (
            <Button size="sm" variant="ghost" onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : "Manage"}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => run(() => deleteSmsGroup(group.id), "Group deleted.")}
            >
              Delete
            </Button>
          ) : null}
        </TableCell>
      </TableRow>
      {open && canWrite ? (
        <TableRow>
          <TableCell colSpan={5}>
            <div className="grid gap-3 py-2">
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Broadcast to members">
                  <Input
                    value={broadcast}
                    onChange={(e) => setBroadcast(e.target.value)}
                    placeholder="Message…"
                    className="w-72"
                  />
                </Field>
                <Button
                  size="sm"
                  disabled={pending || !broadcast}
                  onClick={() =>
                    run(async () => {
                      const res = await adminBroadcast({ groupId: group.id, message: broadcast });
                      if (res.ok) setBroadcast("");
                      return res;
                    }, "Broadcast sent (mocked).")
                  }
                >
                  Broadcast
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Replace members (comma-separated numbers)">
                  <Input
                    value={editMembers}
                    onChange={(e) => setEditMembers(e.target.value)}
                    placeholder="+1..., +1..."
                    className="w-72"
                  />
                </Field>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    run(async () => {
                      const res = await updateSmsGroup({ id: group.id, user_numbers: editMembers });
                      if (res.ok) setEditMembers("");
                      return res;
                    }, "Members updated.")
                  }
                >
                  Save members
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

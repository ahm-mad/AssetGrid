"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { saveContainer, deleteContainer } from "@/lib/inventory/actions";
import type { ContainerRow } from "@/lib/inventory/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ContainersTable({
  rows,
  canCreate,
  canEdit,
  canDelete,
}: {
  rows: ContainerRow[];
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [code, setCode] = React.useState("");
  const [editing, setEditing] = React.useState<number | null>(null);
  const [editCode, setEditCode] = React.useState("");

  function create() {
    start(async () => {
      const r = await saveContainer({ code });
      if (r.ok) {
        setCode("");
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  }

  function saveEdit(id: number) {
    start(async () => {
      const r = await saveContainer({ id, code: editCode });
      if (r.ok) {
        setEditing(null);
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  }

  return (
    <div className="grid gap-3">
      {canCreate ? (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="New container code"
            className="max-w-xs font-mono"
          />
          <Button size="sm" disabled={pending || !code.trim()} onClick={create}>
            Add
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Devices</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  No containers yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono">
                    {editing === c.id ? (
                      <Input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        className="max-w-xs font-mono"
                      />
                    ) : (
                      c.code
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.deviceCount}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {editing === c.id ? (
                      <>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => saveEdit(c.id)}>
                          Save
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        {canEdit ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setEditing(c.id);
                              setEditCode(c.code);
                            }}
                          >
                            Edit
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending || c.deviceCount > 0}
                            onClick={() =>
                              start(async () => {
                                const r = await deleteContainer(c.id);
                                if (r.ok) router.refresh();
                                else toast.error(r.error ?? "Failed");
                              })
                            }
                          >
                            Delete
                          </Button>
                        ) : null}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

"use client";

import { Copy, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import {
  deleteSavedList,
  duplicateSavedList,
  loadSavedListAndOpen,
  renameSavedList,
} from "@/app/cart/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useAction } from "./status";

export interface SavedListView {
  id: string;
  name: string;
  updatedAt: string;
  itemCount: number;
  suppliers: string[];
  preview: { name: string; amount: string }[];
}

export function SavedListCard({ list }: { list: SavedListView }) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(list.name);
  const { pending, run } = useAction();

  return (
    <Card aria-busy={pending}>
      <CardContent className="space-y-4 pt-5 sm:pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          {renaming ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => renameSavedList(list.id, name),
                  (r) => r.ok && setRenaming(false),
                );
              }}
            >
              <label htmlFor={`rename-${list.id}`} className="sr-only">
                New name for {list.name}
              </label>
              <input
                id={`rename-${list.id}`}
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setRenaming(false)}
                className="border-input bg-card h-9 w-60 rounded-lg border px-3 text-sm"
              />
              <Button type="submit" size="sm" disabled={pending}>
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <div>
              <h2 className="font-semibold">{list.name}</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {list.itemCount} items
                {list.suppliers.length ? ` · usually from ${list.suppliers.join(", ")}` : ""}
              </p>
            </div>
          )}
          <form action={loadSavedListAndOpen}>
            <input type="hidden" name="listId" value={list.id} />
            <Button type="submit">Load into cart</Button>
          </form>
        </div>

        <p className="text-muted-foreground text-sm">
          {list.preview.map((p) => `${p.name} (${p.amount})`).join(" · ")}
          {list.itemCount > list.preview.length
            ? ` · +${list.itemCount - list.preview.length} more`
            : ""}
        </p>

        <div className="flex flex-wrap gap-1 border-t pt-3">
          <Button variant="ghost" size="sm" onClick={() => run(() => duplicateSavedList(list.id))}>
            <Copy aria-hidden /> Duplicate
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setRenaming(true)}>
            <Pencil aria-hidden /> Rename
          </Button>
          {confirmDelete ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => run(() => deleteSavedList(list.id))}
              >
                Yes, delete “{list.name}”
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

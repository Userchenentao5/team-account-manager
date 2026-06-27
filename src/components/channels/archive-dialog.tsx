"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { archiveChannel } from "@/actions/channels";
import type { ChannelRow } from "@/db/channels";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ArchiveDialogProps = {
  /** The channel pending archive, or null when the dialog is closed. */
  channel: Pick<ChannelRow, "id" | "name"> | null;
  onOpenChange: (open: boolean) => void;
};

export function ArchiveDialog({ channel, onOpenChange }: ArchiveDialogProps) {
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    if (!channel) return;
    startTransition(async () => {
      try {
        const res = await archiveChannel(channel.id);
        if (res.ok) {
          toast.success("已归档渠道");
          onOpenChange(false);
        } else {
          toast.error("保存失败,请重试。");
        }
      } catch {
        toast.error("保存失败,请重试。");
      }
    });
  }

  return (
    <AlertDialog open={channel !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>归档此渠道?</AlertDialogTitle>
          <AlertDialogDescription>
            归档后,该渠道不会出现在新建空间的选择列表中;已使用它的空间不受影响。你可以随时恢复。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          {/* Reversible soft-delete (D-06) → NEUTRAL confirm, not destructive/red. */}
          <Button variant="secondary" onClick={onConfirm} disabled={isPending}>
            {isPending ? "归档中…" : "归档"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteSpace } from "@/actions/spaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SpaceDeleteDialogProps = {
  open: boolean;
  space: {
    id: number;
    name: string;
  };
  childCount: number;
  onOpenChange: (open: boolean) => void;
};

export function SpaceDeleteDialog({
  open,
  space,
  childCount,
  onOpenChange,
}: SpaceDeleteDialogProps) {
  const router = useRouter();
  const [confirmationName, setConfirmationName] = useState("");
  const [isPending, startTransition] = useTransition();
  const canDelete = confirmationName === space.name;

  function onConfirm() {
    startTransition(async () => {
      try {
        const res = await deleteSpace({
          id: space.id,
          confirmationName,
        });
        if (res.ok) {
          toast.success("已删除空间");
          onOpenChange(false);
          router.push("/spaces");
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("保存失败，请重试。");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setConfirmationName("");
        onOpenChange(nextOpen);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除空间</AlertDialogTitle>
          <AlertDialogDescription>
            将删除空间「{space.name}」、母账号以及该空间下的所有子账号。
            当前共有 {childCount} 个子账号。此操作不可撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-2">
          <label htmlFor="space-delete-confirmation" className="text-sm">
            输入空间名称「{space.name}」以确认删除。
          </label>
          <Input
            id="space-delete-confirmation"
            value={confirmationName}
            onChange={(event) => setConfirmationName(event.target.value)}
            disabled={isPending}
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canDelete || isPending}
          >
            {isPending ? "删除中..." : "删除空间"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

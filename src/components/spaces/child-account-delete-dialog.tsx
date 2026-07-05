"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteChildAccount } from "@/actions/childAccounts";
import type { ChildAccountRow } from "@/db/childAccounts";
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

type ChildAccountDeleteDialogProps = {
  child: Pick<ChildAccountRow, "id" | "email"> | null;
  onOpenChange: (open: boolean) => void;
};

export function ChildAccountDeleteDialog({
  child,
  onOpenChange,
}: ChildAccountDeleteDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    if (!child) return;
    startTransition(async () => {
      try {
        const res = await deleteChildAccount(child.id);
        if (res.ok) {
          toast.success("已删除子账号");
          onOpenChange(false);
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
    <AlertDialog open={child !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除子账号</AlertDialogTitle>
          <AlertDialogDescription>
            将删除子账号 {child?.email ?? ""}。此操作不会删除空间或母账号。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? "删除中..." : "删除子账号"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

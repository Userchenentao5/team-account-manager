"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteCurrency } from "@/actions/currencies";
import type { CurrencyRow } from "@/db/currencies";
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

type CurrencyDeleteDialogProps = {
  currency: CurrencyRow | null;
  onOpenChange: (open: boolean) => void;
};

export function CurrencyDeleteDialog({
  currency,
  onOpenChange,
}: CurrencyDeleteDialogProps) {
  const [isPending, startTransition] = useTransition();

  function onConfirm() {
    if (!currency) return;
    startTransition(async () => {
      try {
        const res = await deleteCurrency(currency.code);
        if (res.ok) {
          toast.success("已删除币种");
          onOpenChange(false);
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("删除失败,请重试。");
      }
    });
  }

  return (
    <AlertDialog open={currency !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除此币种?</AlertDialogTitle>
          <AlertDialogDescription>
            删除会同时移除该币种的缓存汇率。若已有空间或子账号使用它,系统会阻止删除以保留历史金额口径。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? "删除中..." : "删除"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

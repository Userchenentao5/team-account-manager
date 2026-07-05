"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCcw, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { renewSpace } from "@/actions/spaces";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SpaceDeleteDialog } from "./space-delete-dialog";
import type { SpaceFormValue } from "./space-form";

type SpaceDetailActionsProps = {
  space: SpaceFormValue;
  childCount: number;
  isEditing?: boolean;
  editFormId?: string;
};

export function SpaceDetailActions({
  space,
  childCount,
  isEditing = false,
  editFormId,
}: SpaceDetailActionsProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [isRenewing, startRenewTransition] = useTransition();

  function onRenew() {
    if (!space.id) return;

    startRenewTransition(async () => {
      try {
        const res = await renewSpace(space.id!);
        if (res.ok) {
          toast.success("已续费并更新到期日");
          setRenewOpen(false);
          router.refresh();
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("续费失败，请重试。");
      }
    });
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={() => setRenewOpen(true)}
            disabled={isRenewing || isEditing || !space.id}
          >
            <RefreshCcw className="size-4" />
            {isRenewing ? "续费中" : "续费"}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isEditing ? "编辑时暂不可续费" : "按当前周期推进到期日"}
        </TooltipContent>
      </Tooltip>
      <AlertDialog open={renewOpen} onOpenChange={setRenewOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认续费空间</AlertDialogTitle>
            <AlertDialogDescription>
              将为「{space.name}」按当前订阅周期推进到期日，并刷新本期冻结成本。请确认不是误触。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRenewing}>取消</AlertDialogCancel>
            <Button onClick={onRenew} disabled={isRenewing || !space.id}>
              {isRenewing ? "续费中..." : "确认续费"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {isEditing ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="submit" form={editFormId}>
              保存
            </Button>
          </TooltipTrigger>
          <TooltipContent>保存空间修改</TooltipContent>
        </Tooltip>
      ) : null}
      <Tooltip>
        <TooltipTrigger asChild>
          {isEditing ? (
            <Button asChild variant="outline">
              <Link href={`/spaces/${space.id}`}>
                <X className="size-4" />
                取消编辑
              </Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={`/spaces/${space.id}?edit=1`}>
                <Pencil className="size-4" />
                编辑
              </Link>
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isEditing ? "返回只读详情" : "在页面内编辑空间"}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="destructive"
            size="icon"
            className="size-11"
            aria-label={`删除 ${space.name}`}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>删除空间</TooltipContent>
      </Tooltip>
      {space.id ? (
        <SpaceDeleteDialog
          open={deleteOpen}
          space={{ id: space.id, name: space.name }}
          childCount={childCount}
          onOpenChange={setDeleteOpen}
        />
      ) : null}
    </>
  );
}

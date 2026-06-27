"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Archive, RotateCcw } from "lucide-react";
import { reactivateChannel } from "@/actions/channels";
import type { ChannelRow } from "@/db/channels";
import { ChannelDialog } from "./channel-dialog";
import { ArchiveDialog } from "./archive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DialogState =
  | { mode: "add" }
  | { mode: "rename"; channel: Pick<ChannelRow, "id" | "name"> }
  | null;

type ChannelTableProps = {
  channels: ChannelRow[];
  showArchived: boolean;
};

export function ChannelTable({ channels, showArchived }: ChannelTableProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<Pick<ChannelRow, "id" | "name"> | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggleArchived(next: boolean) {
    // Drive the RSC query via the URL so the server re-renders the filtered list.
    router.push(next ? "/reference-data/channels?archived=1" : "/reference-data/channels");
  }

  function onReactivate(channel: Pick<ChannelRow, "id">) {
    startTransition(async () => {
      try {
        const res = await reactivateChannel(channel.id);
        if (res.ok) {
          toast.success("已恢复渠道");
        } else {
          toast.error("保存失败,请重试。");
        }
      } catch {
        toast.error("保存失败,请重试。");
      }
    });
  }

  const showEmptyState = channels.length === 0 && !showArchived;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold leading-tight">支付渠道</h1>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              id="show-archived"
              checked={showArchived}
              onCheckedChange={toggleArchived}
            />
            <Label htmlFor="show-archived" className="text-sm">
              显示已归档
            </Label>
          </div>
          <Button onClick={() => setDialog({ mode: "add" })}>
            <Plus className="size-4" />
            新增渠道
          </Button>
        </div>
      </div>

      {showEmptyState ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed py-12 text-center">
          <h2 className="text-lg font-semibold">还没有支付渠道</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            添加你的第一个支付渠道,之后创建空间时就能选择它。
          </p>
          <Button onClick={() => setDialog({ mode: "add" })}>
            <Plus className="size-4" />
            新增渠道
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">名称</TableHead>
              <TableHead scope="col">状态</TableHead>
              <TableHead scope="col" className="text-right">
                操作
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {channels.map((channel) => {
              const archived = !channel.isActive;
              return (
                <TableRow
                  key={channel.id}
                  className={archived ? "bg-muted/50" : undefined}
                >
                  <TableCell className="font-medium">{channel.name}</TableCell>
                  <TableCell>
                    {archived ? (
                      <Badge variant="secondary">已归档</Badge>
                    ) : (
                      <Badge variant="outline">有效</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {archived ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11"
                              aria-label={`恢复 ${channel.name}`}
                              disabled={isPending}
                              onClick={() => onReactivate(channel)}
                            >
                              <RotateCcw className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>恢复</TooltipContent>
                        </Tooltip>
                      ) : (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-11"
                                aria-label={`重命名 ${channel.name}`}
                                onClick={() =>
                                  setDialog({ mode: "rename", channel })
                                }
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>重命名</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-11"
                                aria-label={`归档 ${channel.name}`}
                                onClick={() => setArchiveTarget(channel)}
                              >
                                <Archive className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>归档</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <ChannelDialog
        open={dialog !== null}
        mode={dialog?.mode ?? "add"}
        channel={dialog?.mode === "rename" ? dialog.channel : undefined}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />
      <ArchiveDialog
        channel={archiveTarget}
        onOpenChange={(open) => {
          if (!open) setArchiveTarget(null);
        }}
      />
    </div>
  );
}

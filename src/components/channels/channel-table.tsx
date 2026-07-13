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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
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

type ChannelStatusFilter = "all" | "active" | "archived";

export function ChannelTable({ channels, showArchived }: ChannelTableProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<DialogState>(null);
  const [archiveTarget, setArchiveTarget] =
    useState<Pick<ChannelRow, "id" | "name"> | null>(null);
  const [includeArchived, setIncludeArchived] = useState(showArchived);
  const [nameQuery, setNameQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ChannelStatusFilter>(
    showArchived ? "all" : "active",
  );
  const [isPending, startTransition] = useTransition();

  function toggleArchived(next: boolean) {
    setIncludeArchived(next);
    setStatusFilter(next ? "all" : "active");
    router.push(
      next ? "/reference-data/channels?archived=1" : "/reference-data/channels",
    );
  }

  function onStatusChange(value: ChannelStatusFilter) {
    setStatusFilter(value);
    if (value !== "active" && !includeArchived) {
      setIncludeArchived(true);
      router.push("/reference-data/channels?archived=1");
    }
  }

  function onReactivate(channel: Pick<ChannelRow, "id">) {
    startTransition(async () => {
      try {
        const res = await reactivateChannel(channel.id);
        if (res.ok) {
          toast.success("已恢复渠道");
        } else {
          toast.error("保存失败，请重试。");
        }
      } catch {
        toast.error("保存失败，请重试。");
      }
    });
  }

  const normalizedNameQuery = nameQuery.trim().toLowerCase();
  const visibleChannels = channels.filter((channel) => {
    const archived = !channel.isActive;
    if (!includeArchived && archived) return false;
    if (statusFilter === "active" && archived) return false;
    if (statusFilter === "archived" && !archived) return false;
    return normalizedNameQuery
      ? channel.name.toLowerCase().includes(normalizedNameQuery)
      : true;
  });
  const showEmptyState = channels.length === 0 && !includeArchived;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 border-b bg-background/95 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">支付渠道</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              管理创建空间时可选的支付渠道；归档后不会在新空间表单中出现，历史记录仍保留原渠道名称。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={includeArchived}
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

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-full max-w-sm">
            <Label htmlFor="channel-name-filter" className="mb-2">
              名称
            </Label>
            <Input
              id="channel-name-filter"
              value={nameQuery}
              onChange={(event) => setNameQuery(event.target.value)}
              placeholder="按名称筛选"
            />
          </div>
          <div>
            <Label htmlFor="channel-status-filter" className="mb-2">
              状态
            </Label>
            <Select value={statusFilter} onValueChange={onStatusChange}>
              <SelectTrigger id="channel-status-filter" className="w-36">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="active">有效</SelectItem>
                <SelectItem value="archived">已归档</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {showEmptyState ? (
        <div className="m-4 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 py-12 text-center sm:m-6">
          <h2 className="text-lg font-semibold">还没有支付渠道</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            添加你的第一个支付渠道，之后创建空间时就能选择它。
          </p>
          <Button onClick={() => setDialog({ mode: "add" })}>
            <Plus className="size-4" />
            新增渠道
          </Button>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-4 sm:px-6 lg:px-8">
          <table data-slot="table" className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-20 bg-background shadow-sm [&_th]:bg-background">
              <TableRow>
                <TableHead scope="col">名称</TableHead>
                <TableHead scope="col">状态</TableHead>
                <TableHead scope="col" className="text-right">
                  操作
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleChannels.map((channel) => {
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
              {visibleChannels.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    没有匹配的支付渠道
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </table>
        </div>
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

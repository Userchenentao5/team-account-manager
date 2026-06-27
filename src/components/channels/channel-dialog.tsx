"use client";

import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  channelSchema,
  type ChannelInput,
} from "@/lib/validation/channel";
import { addChannel, renameChannel } from "@/actions/channels";
import type { ChannelRow } from "@/db/channels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type ChannelDialogProps = {
  open: boolean;
  mode: "add" | "rename";
  /** Present when renaming; absent when adding. */
  channel?: Pick<ChannelRow, "id" | "name">;
  onOpenChange: (open: boolean) => void;
};

export function ChannelDialog({
  open,
  mode,
  channel,
  onOpenChange,
}: ChannelDialogProps) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<ChannelInput>({
    resolver: zodResolver(channelSchema),
    defaultValues: { name: "" },
  });

  // Reset the field whenever the dialog (re)opens for a different target.
  useEffect(() => {
    if (open) {
      form.reset({ name: mode === "rename" ? (channel?.name ?? "") : "" });
    }
  }, [open, mode, channel?.name, form]);

  function onSubmit(values: ChannelInput) {
    startTransition(async () => {
      try {
        const res =
          mode === "add"
            ? await addChannel(values.name)
            : await renameChannel(channel!.id, values.name);

        if (res.ok) {
          toast.success(mode === "add" ? "已添加渠道" : "已重命名");
          onOpenChange(false);
        } else {
          // Validation / duplicate errors surface inline on the field.
          form.setError("name", { message: res.error });
        }
      } catch {
        toast.error("保存失败,请重试。");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "新增渠道" : "重命名渠道"}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "为支付渠道起一个名称,之后创建空间时就能选择它。"
              : "修改渠道名称;它的引用关系(id)不会改变。"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>渠道名称</FormLabel>
                  <FormControl>
                    <Input
                      autoFocus
                      placeholder="例如:支付宝"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

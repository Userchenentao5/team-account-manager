"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateMotherSeat } from "@/actions/childAccounts";
import type { MotherAccountRow } from "@/db/schema";
import {
  motherSeatFormSchema,
  type MotherSeatFormInput,
} from "@/lib/validation/motherAccount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type MotherSeatCardProps = {
  motherAccount: MotherAccountRow;
  isEditing?: boolean;
  formId?: string;
  editHref: string;
  cancelHref: string;
};

export function MotherSeatCard({
  motherAccount,
  isEditing = false,
  formId,
  editHref,
  cancelHref,
}: MotherSeatCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<MotherSeatFormInput>({
    resolver: zodResolver(motherSeatFormSchema),
    defaultValues: {
      seatType: motherAccount.seatType as MotherSeatFormInput["seatType"],
      canChangeSeatType: motherAccount.canChangeSeatType,
    },
  });

  useEffect(() => {
    form.reset({
      seatType: motherAccount.seatType as MotherSeatFormInput["seatType"],
      canChangeSeatType: motherAccount.canChangeSeatType,
    });
  }, [
    form,
    motherAccount.canChangeSeatType,
    motherAccount.seatType,
    isEditing,
  ]);

  function onSubmit(values: MotherSeatFormInput) {
    startTransition(async () => {
      try {
        const res = await updateMotherSeat(motherAccount.spaceId, values);
        if (res.ok) {
          toast.success("已保存修改");
          router.push(cancelHref);
          router.refresh();
        } else {
          form.setError("root", { message: res.error });
          toast.error(res.error);
        }
      } catch {
        toast.error("保存失败，请重试。");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>{isEditing ? "编辑母账号席位" : "母账号席位"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "修改母账号席位类型和是否可变更席位类型。"
            : "母账号也作为一个席位记录。只能编辑席位类型和是否可变更席位类型。"}
        </CardDescription>
        <CardAction className="flex flex-wrap items-center gap-2">
          {isEditing ? (
            <>
              <Button type="submit" form={formId} disabled={isPending}>
                {isPending ? "保存中…" : "保存"}
              </Button>
              <Button asChild variant="outline">
                <Link href={cancelHref}>
                  <X className="size-4" />
                  取消编辑
                </Link>
              </Button>
            </>
          ) : (
            <Button asChild variant="outline">
              <Link href={editHref}>
                <Pencil className="size-4" />
                编辑
              </Link>
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="p-6">
        {isEditing ? (
          <Form {...form}>
            <form
              id={formId}
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid gap-4 md:grid-cols-3"
            >
              <div className="min-h-[92px] rounded-md border bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">邮箱/登录名</p>
                <p className="mt-1 min-h-6 font-mono font-medium">
                  {motherAccount.email}
                </p>
              </div>
              <FormField
                control={form.control}
                name="seatType"
                render={({ field }) => (
                  <FormItem className="min-h-[92px] rounded-md border bg-muted/20 p-3">
                    <FormLabel>席位类型</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="codex">codex</SelectItem>
                        <SelectItem value="chatgpt">chatgpt</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="canChangeSeatType"
                render={({ field }) => (
                  <FormItem className="flex min-h-[92px] items-center justify-between gap-4 space-y-0 rounded-md border bg-muted/20 p-3">
                    <div>
                      <FormLabel>可变更席位类型</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        仅母账号有此标记，子账号不包含该字段。
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root ? (
                <p className="text-sm text-destructive md:col-span-3">
                  {form.formState.errors.root.message}
                </p>
              ) : null}
            </form>
          </Form>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">邮箱/登录名</p>
            <p className="font-mono">{motherAccount.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">席位类型</p>
            <Badge
              variant={
                motherAccount.seatType === "codex" ? "secondary" : "outline"
              }
            >
              {motherAccount.seatType}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">可变更席位类型</p>
            <p className="font-medium">
              {motherAccount.canChangeSeatType ? "是" : "否"}
            </p>
          </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { updateStatusThresholds } from "@/actions/settings";
import type { StatusThresholds } from "@/db/settings";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StatusThresholdFormProps = {
  thresholds: StatusThresholds;
};

export function StatusThresholdForm({
  thresholds,
}: StatusThresholdFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    spaceSoonDays: String(thresholds.spaceSoonDays),
    childAccountSoonDays: String(thresholds.childAccountSoonDays),
  });

  function updateDraft(key: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.spaceSoonDays.trim() || !draft.childAccountSoonDays.trim()) {
      setError("请输入状态阈值。");
      return;
    }

    startTransition(async () => {
      const res = await updateStatusThresholds({
        spaceSoonDays: Number(draft.spaceSoonDays),
        childAccountSoonDays: Number(draft.childAccountSoonDays),
      });

      if (res.ok) {
        toast.success("已保存状态阈值");
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="border-b">
        <CardTitle>状态阈值</CardTitle>
        <CardDescription>空间和子账号分别计算即将到期状态。</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="spaceSoonDays">空间阈值</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="spaceSoonDays"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={draft.spaceSoonDays}
                  onChange={(event) =>
                    updateDraft("spaceSoonDays", event.target.value)
                  }
                  disabled={isPending}
                  className="font-mono"
                />
                <span className="shrink-0 text-sm text-muted-foreground">天</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="childAccountSoonDays">子账号阈值</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="childAccountSoonDays"
                  type="number"
                  min={0}
                  max={365}
                  step={1}
                  value={draft.childAccountSoonDays}
                  onChange={(event) =>
                    updateDraft("childAccountSoonDays", event.target.value)
                  }
                  disabled={isPending}
                  className="font-mono"
                />
                <span className="shrink-0 text-sm text-muted-foreground">天</span>
              </div>
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button type="submit" disabled={isPending}>
            <Save className="size-4" />
            保存设置
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import type { FormEvent } from "react";
import { useState, useTransition } from "react";
import { Clock, Eye, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import {
  updateSpaceEmailReminderSettings,
  updateStatusThresholds,
} from "@/actions/settings";
import type {
  SpaceEmailReminderSettings,
  StatusThresholds,
} from "@/db/settings";
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
import { Switch } from "@/components/ui/switch";

type StatusThresholdFormProps = {
  thresholds: StatusThresholds;
  emailReminder: SpaceEmailReminderSettings;
};

export function StatusThresholdForm({
  thresholds,
  emailReminder,
}: StatusThresholdFormProps) {
  const [isThresholdPending, startThresholdTransition] = useTransition();
  const [isEmailPending, startEmailTransition] = useTransition();
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [thresholdDraft, setThresholdDraft] = useState({
    spaceSoonDays: String(thresholds.spaceSoonDays),
    childAccountSoonDays: String(thresholds.childAccountSoonDays),
  });
  const [emailDraft, setEmailDraft] = useState({
    enabled: emailReminder.enabled,
    recipientEmail: emailReminder.recipientEmail,
    sendTime: emailReminder.sendTime,
    smtpUrl: emailReminder.smtpUrl,
    smtpFrom: emailReminder.smtpFrom,
    templateSubject: emailReminder.templateSubject,
    templateBody: emailReminder.templateBody,
  });

  function updateThresholdDraft(
    key: keyof typeof thresholdDraft,
    value: string,
  ) {
    setThresholdDraft((current) => ({ ...current, [key]: value }));
    setThresholdError(null);
  }

  function updateEmailDraft(key: keyof typeof emailDraft, value: boolean | string) {
    setEmailDraft((current) => ({ ...current, [key]: value }));
    setEmailError(null);
  }

  function onThresholdSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !thresholdDraft.spaceSoonDays.trim() ||
      !thresholdDraft.childAccountSoonDays.trim()
    ) {
      setThresholdError("请输入状态阈值。");
      return;
    }

    startThresholdTransition(async () => {
      const res = await updateStatusThresholds({
        spaceSoonDays: Number(thresholdDraft.spaceSoonDays),
        childAccountSoonDays: Number(thresholdDraft.childAccountSoonDays),
      });

      if (res.ok) {
        toast.success("已保存状态阈值");
      } else {
        setThresholdError(res.error);
        toast.error(res.error);
      }
    });
  }

  function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startEmailTransition(async () => {
      const res = await updateSpaceEmailReminderSettings(emailDraft);

      if (res.ok) {
        toast.success("已保存空间邮件提醒");
      } else {
        setEmailError(res.error);
        toast.error(res.error);
      }
    });
  }

  const preview = renderPreview(emailDraft, thresholdDraft.spaceSoonDays);

  return (
    <div className="grid max-w-2xl gap-4">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>状态阈值</CardTitle>
          <CardDescription>空间和子账号分别计算即将到期状态。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onThresholdSubmit} className="space-y-5">
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
                    value={thresholdDraft.spaceSoonDays}
                    onChange={(event) =>
                      updateThresholdDraft("spaceSoonDays", event.target.value)
                    }
                    disabled={isThresholdPending}
                    className="font-mono"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    天
                  </span>
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
                    value={thresholdDraft.childAccountSoonDays}
                    onChange={(event) =>
                      updateThresholdDraft(
                        "childAccountSoonDays",
                        event.target.value,
                      )
                    }
                    disabled={isThresholdPending}
                    className="font-mono"
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">
                    天
                  </span>
                </div>
              </div>
            </div>

            {thresholdError ? (
              <p className="text-sm text-destructive">{thresholdError}</p>
            ) : null}

            <Button type="submit" disabled={isThresholdPending}>
              <Save className="size-4" />
              保存设置
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>空间邮件提醒</CardTitle>
          <CardDescription>到达空间阈值当天按指定时间自动发送。</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onEmailSubmit} className="space-y-5">
            <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="spaceEmailReminderEnabled">
                  开启空间邮件提醒
                </Label>
                <p className="text-sm text-muted-foreground">
                  仅在空间剩余天数等于空间阈值当天发送一次。
                </p>
              </div>
              <Switch
                id="spaceEmailReminderEnabled"
                checked={emailDraft.enabled}
                onCheckedChange={(checked) =>
                  updateEmailDraft("enabled", checked)
                }
                disabled={isEmailPending}
              />
            </div>

            {emailDraft.enabled ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="spaceEmailRecipient">接收邮箱</Label>
                  <Input
                    id="spaceEmailRecipient"
                    type="email"
                    value={emailDraft.recipientEmail}
                    onChange={(event) =>
                      updateEmailDraft("recipientEmail", event.target.value)
                    }
                    disabled={isEmailPending}
                    placeholder="name@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="spaceEmailSendTime">发送时间</Label>
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-muted-foreground" />
                    <Input
                      id="spaceEmailSendTime"
                      type="time"
                      value={emailDraft.sendTime}
                      onChange={(event) =>
                        updateEmailDraft("sendTime", event.target.value)
                      }
                      disabled={isEmailPending}
                      className="max-w-40 font-mono"
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="spaceEmailSmtpUrl">SMTP URL</Label>
                    <Input
                      id="spaceEmailSmtpUrl"
                      type="password"
                      value={emailDraft.smtpUrl}
                      onChange={(event) =>
                        updateEmailDraft("smtpUrl", event.target.value)
                      }
                      disabled={isEmailPending}
                      placeholder="smtp://user:pass@smtp.example.com:587"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="spaceEmailSmtpFrom">发件邮箱</Label>
                    <Input
                      id="spaceEmailSmtpFrom"
                      type="email"
                      value={emailDraft.smtpFrom}
                      onChange={(event) =>
                        updateEmailDraft("smtpFrom", event.target.value)
                      }
                      disabled={isEmailPending}
                      placeholder="billing@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-md border px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <Label>空间提醒邮件模板</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setIsEditingTemplate((current) => !current)
                        }
                      >
                        <Pencil className="size-4" />
                        {isEditingTemplate ? "收起编辑" : "编辑模板"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPreview((current) => !current)}
                      >
                        <Eye className="size-4" />
                        {showPreview ? "收起预览" : "预览模板"}
                      </Button>
                    </div>
                  </div>

                  {isEditingTemplate ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label htmlFor="spaceEmailTemplateSubject">
                          邮件标题模板
                        </Label>
                        <Input
                          id="spaceEmailTemplateSubject"
                          value={emailDraft.templateSubject}
                          onChange={(event) =>
                            updateEmailDraft(
                              "templateSubject",
                              event.target.value,
                            )
                          }
                          disabled={isEmailPending}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="spaceEmailTemplateBody">
                          邮件正文模板
                        </Label>
                        <textarea
                          id="spaceEmailTemplateBody"
                          value={emailDraft.templateBody}
                          onChange={(event) =>
                            updateEmailDraft(
                              "templateBody",
                              event.target.value,
                            )
                          }
                          disabled={isEmailPending}
                          rows={5}
                          className="min-h-28 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>

                      <p className="text-xs text-muted-foreground">
                        占位符：{"{spaceName}"} {"{daysUntilExpiry}"}{" "}
                        {"{paymentChannelName}"} {"{amountUsd}"}{" "}
                        {"{expiryDate}"}
                      </p>
                    </div>
                  ) : null}

                  {showPreview ? (
                    <div className="rounded-md bg-muted/60 p-3 text-sm">
                      <p className="font-medium">{preview.subject}</p>
                      <p className="mt-2 whitespace-pre-wrap text-muted-foreground">
                        {preview.body}
                      </p>
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}

            {emailError ? (
              <p className="text-sm text-destructive">{emailError}</p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isEmailPending}>
                <Save className="size-4" />
                保存提醒设置
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function renderPreview(
  draft: {
    templateSubject: string;
    templateBody: string;
  },
  thresholdDays: string,
) {
  const values: Record<string, string> = {
    amountUsd: "25.99",
    daysUntilExpiry: thresholdDays.trim() || "7",
    expiryDate: "2026-07-14",
    paymentChannelName: "Visa",
    spaceName: "US Team",
  };
  const replaceToken = (_match: string, key: string) => values[key] ?? `{${key}}`;

  return {
    subject: draft.templateSubject.replace(/\{(\w+)\}/g, replaceToken),
    body: draft.templateBody.replace(/\{(\w+)\}/g, replaceToken),
  };
}

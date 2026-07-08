"use client";

import type { ClipboardEvent } from "react";
import { useRef, useState, useTransition } from "react";
import {
  Bold,
  Clock,
  Eye,
  EyeOff,
  Italic,
  List,
  ListOrdered,
  Pencil,
  Save,
  Trash2,
  Underline,
} from "lucide-react";
import { toast } from "sonner";
import {
  removeChildAccountReminderSubscription,
  saveChildAccountReminderSubscription,
  updateChildAccountEmailReminderSettings,
} from "@/actions/settings";
import type {
  ChildAccountReminderOption,
  ChildAccountReminderSubscription,
} from "@/db/childAccountReminders";
import type { ChildAccountEmailReminderSettings } from "@/db/settings";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  renderRichTextTemplateBody,
  renderTemplateText,
  sanitizeRichTextHtml,
} from "@/lib/email/rich-text";

type ChildAccountReminderFormProps = {
  settings: ChildAccountEmailReminderSettings;
  options: ChildAccountReminderOption[];
  subscriptions: ChildAccountReminderSubscription[];
};

export function ChildAccountReminderForm({
  settings,
  options,
  subscriptions,
}: ChildAccountReminderFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showSmtpUrl, setShowSmtpUrl] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const templateBodyRef = useRef<HTMLDivElement>(null);
  const firstOption = options[0];
  const [draft, setDraft] = useState({
    enabled: settings.enabled,
    recipientEmail: settings.recipientEmail,
    sendTime: settings.sendTime,
    smtpUrl: settings.smtpUrl,
    smtpFrom: settings.smtpFrom,
    templateSubject: settings.templateSubject,
    templateBody: settings.templateBody,
  });
  const [subscriptionDraft, setSubscriptionDraft] = useState({
    childAccountId: firstOption ? String(firstOption.childAccountId) : "",
    email: firstOption?.childAccountEmail ?? "",
  });

  function updateDraft(key: keyof typeof draft, value: boolean | string) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function selectedOption(id = subscriptionDraft.childAccountId) {
    return options.find((option) => String(option.childAccountId) === id);
  }

  function optionText(option: ChildAccountReminderOption) {
    const label = option.childAccountLabel
      ? ` · ${option.childAccountLabel}`
      : "";
    return `${option.spaceName} · ${option.childAccountEmail}${label}`;
  }

  function onTemplateBodyInput() {
    updateDraft("templateBody", templateBodyRef.current?.innerHTML ?? "");
  }

  function runTemplateCommand(command: string) {
    templateBodyRef.current?.focus();
    document.execCommand(command);
    onTemplateBodyInput();
  }

  function onTemplatePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData.getData("text/plain"),
    );
    onTemplateBodyInput();
  }

  function onSaveSettings() {
    startTransition(async () => {
      const res = await updateChildAccountEmailReminderSettings(draft);

      if (res.ok) {
        toast.success("已保存子账号邮件提醒");
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  function onSaveSubscription() {
    const childAccountId = Number(subscriptionDraft.childAccountId);
    startTransition(async () => {
      const res = await saveChildAccountReminderSubscription({
        childAccountId,
        email: subscriptionDraft.email,
      });

      if (res.ok) {
        toast.success("已保存订阅提醒邮箱");
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  function onRemoveSubscription(childAccountId: number) {
    startTransition(async () => {
      const res = await removeChildAccountReminderSubscription(childAccountId);

      if (res.ok) {
        toast.success("已移除订阅提醒邮箱");
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  const preview = renderPreview(draft);

  return (
    <Card className="max-w-2xl">
      <CardHeader className="border-b">
        <CardTitle>子账号邮件提醒</CardTitle>
        <CardDescription>
          非自用子账号到期当天，先发送给自己的必填接收邮箱；可额外给该子账号对应的订阅邮箱发送一份。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="childAccountEmailReminderEnabled">
              开启子账号邮件提醒
            </Label>
            <p className="text-sm text-muted-foreground">
              仅在子账号下一付款日当天按指定时间发送一次。
            </p>
          </div>
          <Switch
            id="childAccountEmailReminderEnabled"
            checked={draft.enabled}
            onCheckedChange={(checked) => updateDraft("enabled", checked)}
            disabled={isPending}
          />
        </div>

        {draft.enabled ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="childAccountEmailRecipient">
                自己的接收邮箱
              </Label>
              <Input
                id="childAccountEmailRecipient"
                type="email"
                value={draft.recipientEmail}
                onChange={(event) =>
                  updateDraft("recipientEmail", event.target.value)
                }
                disabled={isPending}
                placeholder="owner@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="childAccountEmailSendTime">发送时间</Label>
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <Input
                  id="childAccountEmailSendTime"
                  type="time"
                  value={draft.sendTime}
                  onChange={(event) =>
                    updateDraft("sendTime", event.target.value)
                  }
                  disabled={isPending}
                  className="max-w-40 font-mono"
                />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="childAccountEmailSmtpUrl">SMTP URL</Label>
                <div className="relative">
                  <Input
                    id="childAccountEmailSmtpUrl"
                    type={showSmtpUrl ? "text" : "password"}
                    value={draft.smtpUrl}
                    onChange={(event) =>
                      updateDraft("smtpUrl", event.target.value)
                    }
                    disabled={isPending}
                    placeholder="smtp://user:pass@smtp.example.com:587"
                    className="pr-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-0.5 top-0.5"
                    onClick={() => setShowSmtpUrl((current) => !current)}
                    disabled={isPending}
                    aria-label={showSmtpUrl ? "隐藏 SMTP URL" : "查看 SMTP URL"}
                    title={showSmtpUrl ? "隐藏 SMTP URL" : "查看 SMTP URL"}
                  >
                    {showSmtpUrl ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="childAccountEmailSmtpFrom">发件邮箱</Label>
                <Input
                  id="childAccountEmailSmtpFrom"
                  type="email"
                  value={draft.smtpFrom}
                  onChange={(event) =>
                    updateDraft("smtpFrom", event.target.value)
                  }
                  disabled={isPending}
                  placeholder="billing@example.com"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-md border px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>子账号提醒邮件模板</Label>
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
                    <Label htmlFor="childAccountEmailTemplateSubject">
                      邮件标题模板
                    </Label>
                    <Input
                      id="childAccountEmailTemplateSubject"
                      value={draft.templateSubject}
                      onChange={(event) =>
                        updateDraft("templateSubject", event.target.value)
                      }
                      disabled={isPending}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="childAccountEmailTemplateBody">
                      邮件正文模板
                    </Label>
                    <div className="rounded-md border border-input">
                      <div className="flex flex-wrap gap-1 border-b p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => runTemplateCommand("bold")}
                          disabled={isPending}
                          title="加粗"
                          aria-label="加粗"
                        >
                          <Bold className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => runTemplateCommand("italic")}
                          disabled={isPending}
                          title="斜体"
                          aria-label="斜体"
                        >
                          <Italic className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => runTemplateCommand("underline")}
                          disabled={isPending}
                          title="下划线"
                          aria-label="下划线"
                        >
                          <Underline className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            runTemplateCommand("insertUnorderedList")
                          }
                          disabled={isPending}
                          title="项目列表"
                          aria-label="项目列表"
                        >
                          <List className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() =>
                            runTemplateCommand("insertOrderedList")
                          }
                          disabled={isPending}
                          title="编号列表"
                          aria-label="编号列表"
                        >
                          <ListOrdered className="size-4" />
                        </Button>
                      </div>
                      <div
                        ref={templateBodyRef}
                        id="childAccountEmailTemplateBody"
                        role="textbox"
                        aria-multiline="true"
                        contentEditable={!isPending}
                        suppressContentEditableWarning
                        onInput={onTemplateBodyInput}
                        onPaste={onTemplatePaste}
                        className="min-h-28 w-full rounded-b-md bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50"
                        data-disabled={isPending}
                        dangerouslySetInnerHTML={{
                          __html: sanitizeRichTextHtml(draft.templateBody),
                        }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    占位符：{"{spaceName}"} {"{childAccountEmail}"}{" "}
                    {"{childAccountLabel}"} {"{daysUntilPayment}"}{" "}
                    {"{amount}"} {"{currencyCode}"} {"{nextPaymentDate}"}
                  </p>
                </div>
              ) : null}

              {showPreview ? (
                <div className="rounded-md bg-muted/60 p-3 text-sm">
                  <p className="font-medium">{preview.subject}</p>
                  <div
                    className="mt-2 text-muted-foreground [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:list-disc"
                    dangerouslySetInnerHTML={{ __html: preview.html }}
                  />
                </div>
              ) : null}
            </div>

            <div className="space-y-3 rounded-md border px-4 py-3">
              <div className="space-y-1">
                <Label>接受订阅提醒用户列表</Label>
                <p className="text-sm text-muted-foreground">
                  每个子账号最多保存一个订阅邮箱，可使用该子账号邮箱或用户提供的其他邮箱。
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Select
                  value={subscriptionDraft.childAccountId}
                  onValueChange={(value) => {
                    const option = selectedOption(value);
                    setSubscriptionDraft({
                      childAccountId: value,
                      email: option?.childAccountEmail ?? "",
                    });
                    setError(null);
                  }}
                  disabled={isPending || options.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="选择子账号" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((option) => (
                      <SelectItem
                        key={option.childAccountId}
                        value={String(option.childAccountId)}
                      >
                        {optionText(option)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="email"
                  value={subscriptionDraft.email}
                  onChange={(event) =>
                    setSubscriptionDraft((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  disabled={isPending || options.length === 0}
                  placeholder="subscriber@example.com"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSaveSubscription}
                  disabled={isPending || options.length === 0}
                >
                  <Save className="size-4" />
                  保存订阅
                </Button>
              </div>

              <div className="space-y-2">
                {subscriptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    暂无订阅提醒邮箱。
                  </p>
                ) : (
                  subscriptions.map((subscription) => (
                    <div
                      key={subscription.childAccountId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {optionText(subscription)}
                        </p>
                        <p className="truncate text-muted-foreground">
                          {subscription.email}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          onRemoveSubscription(subscription.childAccountId)
                        }
                        disabled={isPending}
                        aria-label="移除订阅邮箱"
                        title="移除订阅邮箱"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="button" onClick={onSaveSettings} disabled={isPending}>
          <Save className="size-4" />
          保存子账号提醒设置
        </Button>
      </CardContent>
    </Card>
  );
}

function renderPreview(draft: { templateSubject: string; templateBody: string }) {
  const values: Record<string, string> = {
    amount: "12.99",
    amountUsd: "12.99",
    childAccountEmail: "member@example.com",
    childAccountLabel: "Team seat",
    currencyCode: "CNY",
    daysUntilPayment: "0",
    nextPaymentDate: "2026-07-08",
    spaceName: "US Team",
  };
  const body = renderRichTextTemplateBody(draft.templateBody, values);

  return {
    subject: renderTemplateText(draft.templateSubject, values),
    html: body.html,
  };
}

"use client";

import type { ClipboardEvent, FormEvent } from "react";
import { useRef, useState, useTransition } from "react";
import {
  Bold,
  Eye,
  EyeOff,
  Italic,
  List,
  ListOrdered,
  Mail,
  Pencil,
  Save,
  Underline,
} from "lucide-react";
import { toast } from "sonner";
import {
  sendSpaceEmailReminderTest,
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
import { TimePicker } from "@/components/ui/time-picker";
import { Switch } from "@/components/ui/switch";
import { TemplatePlaceholderList } from "@/components/settings/template-placeholder-list";
import {
  renderRichTextTemplateBody,
  renderTemplateText,
  sanitizeRichTextHtml,
} from "@/lib/email/rich-text";
import { SPACE_REMINDER_TEMPLATE_PLACEHOLDERS } from "@/lib/email/reminder-template-placeholders";

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
  const templateSubjectRef = useRef<HTMLInputElement>(null);
  const templateBodyRef = useRef<HTMLDivElement>(null);
  const templateBodyDraftRef = useRef(emailReminder.templateBody);
  const lastTemplateFieldRef = useRef<"subject" | "body">("body");
  const previewSubjectRef = useRef<HTMLParagraphElement>(null);
  const previewBodyRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSmtpUrl, setShowSmtpUrl] = useState(false);
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
    if (key === "templateSubject") {
      syncPreview({ ...currentEmailDraft(), templateSubject: String(value) });
    }
    setEmailError(null);
  }

  function onTemplateBodyInput() {
    templateBodyDraftRef.current = templateBodyRef.current?.innerHTML ?? "";
    syncPreview();
    setEmailError(null);
  }

  function runTemplateCommand(command: string) {
    templateBodyRef.current?.focus();
    document.execCommand(command);
    onTemplateBodyInput();
  }

  function insertPlaceholder(placeholder: string) {
    if (lastTemplateFieldRef.current === "subject") {
      const input = templateSubjectRef.current;
      const value = input?.value ?? emailDraft.templateSubject;
      const start = input?.selectionStart ?? value.length;
      const end = input?.selectionEnd ?? start;
      const nextValue = `${value.slice(0, start)}${placeholder}${value.slice(end)}`;
      updateEmailDraft("templateSubject", nextValue);
      requestAnimationFrame(() => {
        input?.focus();
        input?.setSelectionRange(start + placeholder.length, start + placeholder.length);
      });
      return;
    }

    const editor = templateBodyRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    const hasEditorSelection =
      Boolean(selection?.rangeCount) && editor.contains(selection?.anchorNode ?? null);
    editor.focus();
    if (!hasEditorSelection && selection) {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    document.execCommand("insertText", false, placeholder);
    onTemplateBodyInput();
  }

  function onTemplatePaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData.getData("text/plain"));
    onTemplateBodyInput();
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
      const res = await updateSpaceEmailReminderSettings(currentEmailDraft());

      if (res.ok) {
        toast.success("已保存空间邮件提醒");
      } else {
        setEmailError(res.error);
        toast.error(res.error);
      }
    });
  }

  function onTestEmail() {
    startEmailTransition(async () => {
      const res = await sendSpaceEmailReminderTest(currentEmailDraft());

      if (res.ok) {
        toast.success("测试邮件已发送");
      } else {
        setEmailError(res.error);
        toast.error(res.error);
      }
    });
  }

  function onTogglePreview() {
    setShowPreview((current) => !current);
  }

  function currentEmailDraft() {
    return { ...emailDraft, templateBody: templateBodyDraftRef.current };
  }

  function syncPreview(
    draft = currentEmailDraft(),
    thresholdDays = thresholdDraft.spaceSoonDays,
  ) {
    if (!previewSubjectRef.current || !previewBodyRef.current) return;
    const preview = renderPreview(draft, thresholdDays);
    previewSubjectRef.current.textContent = preview.subject;
    previewBodyRef.current.innerHTML = preview.html;
  }

  return (
    <div className="grid gap-4">
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
                  <TimePicker
                    id="spaceEmailSendTime"
                    value={emailDraft.sendTime}
                    onValueChange={(value) =>
                      updateEmailDraft("sendTime", value)
                    }
                    disabled={isEmailPending}
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="spaceEmailSmtpUrl">SMTP URL</Label>
                    <div className="relative">
                      <Input
                        id="spaceEmailSmtpUrl"
                        type={showSmtpUrl ? "text" : "password"}
                        value={emailDraft.smtpUrl}
                        onChange={(event) =>
                          updateEmailDraft("smtpUrl", event.target.value)
                        }
                        disabled={isEmailPending}
                        placeholder="smtp://user:pass@smtp.example.com:587"
                        className="pr-9"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-0.5 top-0.5"
                        onClick={() => setShowSmtpUrl((current) => !current)}
                        disabled={isEmailPending}
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
                        onClick={onTogglePreview}
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
                          ref={templateSubjectRef}
                          id="spaceEmailTemplateSubject"
                          value={emailDraft.templateSubject}
                          onChange={(event) =>
                            updateEmailDraft(
                              "templateSubject",
                              event.target.value,
                            )
                          }
                          disabled={isEmailPending}
                          onFocus={() => {
                            lastTemplateFieldRef.current = "subject";
                          }}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="spaceEmailTemplateBody">
                          邮件正文模板
                        </Label>
                        <div className="rounded-md border border-input">
                          <div className="flex flex-wrap gap-1 border-b p-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => runTemplateCommand("bold")}
                              disabled={isEmailPending}
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
                              disabled={isEmailPending}
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
                              disabled={isEmailPending}
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
                              disabled={isEmailPending}
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
                              disabled={isEmailPending}
                              title="编号列表"
                              aria-label="编号列表"
                            >
                              <ListOrdered className="size-4" />
                            </Button>
                          </div>
                          <div
                            ref={templateBodyRef}
                            id="spaceEmailTemplateBody"
                            role="textbox"
                            aria-multiline="true"
                            contentEditable={!isEmailPending}
                            suppressContentEditableWarning
                            onInput={onTemplateBodyInput}
                            onPaste={onTemplatePaste}
                            onFocus={() => {
                              lastTemplateFieldRef.current = "body";
                            }}
                            className="min-h-28 w-full rounded-b-md bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50"
                            data-disabled={isEmailPending}
                            dangerouslySetInnerHTML={{
                              __html: sanitizeRichTextHtml(
                                emailDraft.templateBody,
                              ),
                            }}
                          />
                        </div>
                      </div>

                      <TemplatePlaceholderList
                        placeholders={SPACE_REMINDER_TEMPLATE_PLACEHOLDERS}
                        onInsert={insertPlaceholder}
                      />
                    </div>
                  ) : null}

                  {showPreview ? (
                    <div className="rounded-md bg-muted/60 p-3 text-sm">
                      <p ref={previewSubjectRef} className="font-medium" />
                      <div
                        ref={(node) => {
                          previewBodyRef.current = node;
                          if (node) syncPreview();
                        }}
                        className="mt-2 text-muted-foreground [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:list-disc"
                      />
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
                保存设置
              </Button>
              {emailDraft.enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onTestEmail}
                  disabled={isEmailPending}
                >
                  <Mail className="size-4" />
                  发送测试邮件
                </Button>
              ) : null}
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
  const body = renderRichTextTemplateBody(draft.templateBody, values);

  return {
    subject: renderTemplateText(draft.templateSubject, values),
    html: body.html,
  };
}

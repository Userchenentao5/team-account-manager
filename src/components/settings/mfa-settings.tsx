"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  Check,
  CircleDashed,
  Copy,
  KeyRound,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  beginMfaEnrollment,
  disableMfa,
  enableMfa,
} from "@/actions/mfa";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MfaStatus } from "@/db/mfa";

type Enrollment = { qrCodeDataUrl: string; manualKey: string };

export function MfaSettings({ status }: { status: MfaStatus }) {
  const [enabled, setEnabled] = useState(status.enabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function beginEnrollment() {
    setError(null);
    startTransition(async () => {
      const result = await beginMfaEnrollment();
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setEnrollment(result.enrollment);
      setCode("");
    });
  }

  function confirmEnrollment() {
    setError(null);
    startTransition(async () => {
      const result = await enableMfa(code);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setEnabled(true);
      setEnrollment(null);
      setCode("");
      toast.success("MFA 已启用");
    });
  }

  function turnOffMfa() {
    setError(null);
    startTransition(async () => {
      const result = await disableMfa(code);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setEnabled(false);
      setShowDisableConfirm(false);
      setCode("");
      toast.success("MFA 已关闭");
    });
  }

  function updateCode(value: string) {
    setCode(value.replace(/\D/gu, "").slice(0, 6));
    setError(null);
  }

  function cancelEnrollment() {
    setEnrollment(null);
    setCode("");
    setError(null);
  }

  function changeMfaEnabled(checked: boolean) {
    if (checked) {
      if (!enabled && !enrollment) beginEnrollment();
      return;
    }

    if (enrollment) {
      cancelEnrollment();
      return;
    }

    if (enabled) {
      setCode("");
      setError(null);
      setShowDisableConfirm(true);
    }
  }

  async function copyManualKey() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.manualKey);
      toast.success("密钥已复制");
    } catch {
      toast.error("复制失败，请手动选择密钥。");
    }
  }

  return (
    <Card className="gap-0 py-0">
      <div className="grid sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                多重身份验证
              </h2>
              <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
                登录时同时验证访问密钥和 Authenticator 动态安全码。
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <KeyRound className="size-3.5" aria-hidden="true" />
              访问密钥
            </span>
            <Plus className="size-3.5 text-border" aria-hidden="true" />
            <span className="flex items-center gap-1.5">
              <Smartphone className="size-3.5" aria-hidden="true" />
              6 位动态安全码
            </span>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5 border-t bg-muted/30 p-5 sm:border-l sm:border-t-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="mfaEnabled" className="text-xs text-muted-foreground">
                开启 MFA
              </Label>
            <div
              className={
                enabled
                  ? "mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"
                  : "mt-2 flex items-center gap-2 text-sm font-semibold text-foreground"
              }
            >
              {enabled ? (
                <Check className="size-4" aria-hidden="true" />
              ) : enrollment ? (
                <CircleDashed className="size-4" aria-hidden="true" />
              ) : (
                <LockKeyhole className="size-4 text-muted-foreground" aria-hidden="true" />
              )}
              {enabled ? "已启用" : enrollment ? "正在设置" : "未启用"}
            </div>
            </div>
            <Switch
              id="mfaEnabled"
              checked={enabled || Boolean(enrollment)}
              onCheckedChange={changeMfaEnabled}
              disabled={isPending}
              aria-label="开启多重身份验证"
            />
          </div>
          {!enabled && !enrollment ? (
            <p className="text-xs leading-5 text-muted-foreground">
              开启后需要扫描二维码并验证动态安全码。
            </p>
          ) : null}
        </div>
      </div>

      {enrollment ? (
        <div className="grid border-t md:grid-cols-[16rem_minmax(0,1fr)]">
          <div className="bg-muted/20 p-5 sm:p-6 md:border-r">
            <p className="text-sm font-semibold">扫描二维码</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              使用 Authenticator App 添加账号。
            </p>
            <div className="mt-4 overflow-hidden rounded-lg bg-white p-3 ring-1 ring-border">
              <Image
                src={enrollment.qrCodeDataUrl}
                width={224}
                height={224}
                alt="Authenticator 绑定二维码"
                unoptimized
                className="aspect-square w-full"
              />
            </div>
            <div className="mt-4 space-y-2">
              <Label>手动设置密钥</Label>
              <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                <code className="min-w-0 flex-1 break-all text-xs font-semibold tracking-wider">
                  {enrollment.manualKey}
                </code>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  onClick={copyManualKey}
                  aria-label="复制手动设置密钥"
                >
                  <Copy className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center p-5 sm:p-6 md:p-8">
            <div className="max-w-md">
              <p className="text-base font-semibold">验证动态安全码</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                输入 App 当前显示的 6 位数字，验证通过后 MFA 才会启用。
              </p>
              <div className="mt-5 space-y-2">
                <Label htmlFor="enableMfaCode">动态安全码</Label>
                <CodeInput
                  id="enableMfaCode"
                  value={code}
                  onChange={updateCode}
                  disabled={isPending}
                  autoFocus
                />
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  onClick={confirmEnrollment}
                  disabled={isPending || code.length !== 6}
                >
                  {isPending ? "正在验证..." : "验证并启用"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={cancelEnrollment}
                  disabled={isPending}
                >
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {enabled ? (
        <div className="border-t">
          <div className="p-5 sm:p-6">
            <p className="text-base font-semibold">Authenticator 保护已生效</p>
            <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
              下次登录必须输入 App 中显示的 6 位动态安全码。
            </p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">验证方式</dt>
                <dd className="mt-1 text-sm font-medium">访问密钥 + 动态码</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">更新周期</dt>
                <dd className="mt-1 text-sm font-medium">每 30 秒</dd>
              </div>
            </dl>
          </div>

          {showDisableConfirm ? (
            <div className="border-t bg-muted/20 p-5 sm:p-6">
              <div className="max-w-sm">
                <Label htmlFor="disableMfaCode">确认关闭 MFA</Label>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  输入一个最新且未使用的安全码确认操作。
                </p>
                <CodeInput
                  id="disableMfaCode"
                  value={code}
                  onChange={updateCode}
                  disabled={isPending}
                  className="mt-4"
                  autoFocus
                />
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={turnOffMfa}
                    disabled={isPending || code.length !== 6}
                  >
                    {isPending ? "正在关闭..." : "确认关闭"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowDisableConfirm(false);
                      setCode("");
                      setError(null);
                    }}
                    disabled={isPending}
                  >
                    取消
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="border-t px-5 py-3 text-sm text-destructive sm:px-6">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2.5 border-t bg-muted/15 px-5 py-3.5 text-xs leading-5 text-muted-foreground sm:px-6">
        <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <p>请妥善保管绑定设备；设备丢失后需要由服务器管理员重置 MFA。</p>
      </div>
    </Card>
  );
}

function CodeInput({
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "onChange"> & {
  onChange(value: string): void;
}) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      placeholder="000000"
      onChange={(event) => onChange(event.target.value)}
      className={`w-full font-mono text-base tracking-[0.24em] sm:w-40 ${className ?? ""}`}
    />
  );
}

"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { Copy, LockKeyhole, ShieldCheck, Smartphone } from "lucide-react";
import { toast } from "sonner";
import {
  beginMfaEnrollment,
  disableMfa,
  enableMfa,
} from "@/actions/mfa";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MfaStatus } from "@/db/mfa";

type Enrollment = { qrCodeDataUrl: string; manualKey: string };

export function MfaSettings({ status }: { status: MfaStatus }) {
  const [enabled, setEnabled] = useState(status.enabled);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [code, setCode] = useState<string[]>(() => Array(6).fill(""));
  const [loginKey, setLoginKey] = useState("");
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
      setCode(Array(6).fill(""));
    });
  }

  function confirmEnrollment() {
    setError(null);
    startTransition(async () => {
      const result = await enableMfa(code.join(""));
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setEnabled(true);
      setEnrollment(null);
      setCode(Array(6).fill(""));
      toast.success("MFA 已启用");
    });
  }

  function turnOffMfa() {
    setError(null);
    startTransition(async () => {
      const result = await disableMfa(loginKey);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setEnabled(false);
      setShowDisableConfirm(false);
      setLoginKey("");
      toast.success("MFA 已关闭");
    });
  }

  function cancelEnrollment() {
    setEnrollment(null);
    setCode(Array(6).fill(""));
    setError(null);
  }

  function closeDisableConfirm() {
    setShowDisableConfirm(false);
    setLoginKey("");
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
      setLoginKey("");
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

  const statusLabel = isPending && !enrollment && !enabled
    ? "正在准备"
    : enabled
      ? "已启用"
      : enrollment
        ? "正在设置"
        : "未启用";

  return (
    <>
      <Card className="gap-0 py-0">
        <section aria-labelledby="mfa-title">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="mfa-title" className="font-heading text-base font-semibold">
                  多重身份验证
                </h2>
                <p id="mfa-description" className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">
                  使用身份验证器 App 生成动态安全码，为登录增加一道验证。
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 pl-14 sm:pl-0">
              <Label
                htmlFor="mfaEnabled"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
              >
                <span
                  className={`size-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/35"}`}
                  aria-hidden="true"
                />
                {statusLabel}
              </Label>
              <Switch
                id="mfaEnabled"
                checked={enabled || Boolean(enrollment)}
                onCheckedChange={changeMfaEnabled}
                disabled={isPending}
                aria-label="开启多重身份验证"
                aria-describedby="mfa-description"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t bg-muted/15 px-5 py-3.5 text-xs leading-5 text-muted-foreground sm:px-6">
            {enabled ? (
              <Smartphone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <LockKeyhole className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            )}
            <p>
              {enabled
                ? "Authenticator 已连接。下次登录需要输入 App 中的 6 位动态安全码。"
                : "开启后需要扫描二维码并验证动态安全码；设备丢失后需由服务器管理员重置。"}
            </p>
          </div>

          {error && !enrollment && !showDisableConfirm ? (
            <p role="alert" className="border-t px-5 py-3 text-sm text-destructive sm:px-6">
              {error}
            </p>
          ) : null}
        </section>
      </Card>

      <Dialog
        open={Boolean(enrollment)}
        onOpenChange={(open) => {
          if (!open && !isPending) cancelEnrollment();
        }}
      >
        <DialogContent
          className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <div className="px-5 pb-5 pt-7 sm:px-7 sm:pb-7">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </div>
            <DialogHeader className="mt-4 items-center text-center">
              <DialogTitle className="text-xl font-semibold leading-tight">
                设置多重身份验证
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                扫描二维码，然后输入身份验证器 App 显示的 6 位验证码。
              </DialogDescription>
            </DialogHeader>

            {enrollment ? (
              <div className="mt-6 space-y-5">
                <div className="flex justify-center">
                  <div className="overflow-hidden rounded-xl bg-white p-3 ring-1 ring-border">
                    <Image
                      src={enrollment.qrCodeDataUrl}
                      width={160}
                      height={160}
                      alt="Authenticator 绑定二维码"
                      unoptimized
                      className="size-40"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>无法扫描？手动输入密钥</Label>
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2.5">
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

                <div className="space-y-3">
                  <Label className="block text-center">6 位动态安全码</Label>
                  <CodeInput
                    value={code}
                    onChange={(value) => {
                      setCode(value);
                      setError(null);
                    }}
                    disabled={isPending}
                    autoFocus
                  />
                </div>

                {error ? (
                  <p role="alert" className="text-center text-sm text-destructive">
                    {error}
                  </p>
                ) : null}

                <div className="grid gap-2 pt-1">
                  <Button
                    type="button"
                    size="lg"
                    onClick={confirmEnrollment}
                    disabled={isPending || code.some((digit) => !digit)}
                  >
                    {isPending ? "正在验证..." : "验证并启用"}
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    onClick={cancelEnrollment}
                    disabled={isPending}
                  >
                    取消
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showDisableConfirm}
        onOpenChange={(open) => {
          if (!open && !isPending) closeDisableConfirm();
        }}
      >
        <DialogContent
          className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <div className="px-5 pb-5 pt-7 sm:px-7 sm:pb-7">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <LockKeyhole className="size-5" aria-hidden="true" />
            </div>
            <DialogHeader className="mt-4 items-center text-center">
              <DialogTitle className="text-xl font-semibold leading-tight">
                关闭多重身份验证？
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                关闭后，登录将只验证访问密钥。请输入当前访问密钥核验身份。
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-2">
              <Label htmlFor="disableMfaLoginKey">访问密钥</Label>
              <Input
                id="disableMfaLoginKey"
                type="password"
                value={loginKey}
                onChange={(event) => {
                  setLoginKey(event.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                placeholder="输入访问密钥"
                disabled={isPending}
                autoFocus
                className="h-11"
              />
              {error ? (
                <p role="alert" className="pt-1 text-center text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="mt-6 grid gap-2">
              <Button
                type="button"
                size="lg"
                variant="destructive"
                onClick={turnOffMfa}
                disabled={isPending || loginKey.length === 0}
              >
                {isPending ? "正在关闭..." : "确认关闭"}
              </Button>
              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={closeDisableConfirm}
                disabled={isPending}
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CodeInput({
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  value: string[];
  onChange(value: string[]): void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function updateDigit(index: number, rawValue: string) {
    const digit = rawValue.replace(/\D/gu, "").slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !value[index] && index > 0) {
      event.preventDefault();
      const next = [...value];
      next[index - 1] = "";
      onChange(next);
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLDivElement>) {
    const digits = event.clipboardData
      .getData("text")
      .replace(/\D/gu, "")
      .slice(0, 6)
      .split("");
    if (digits.length === 0) return;
    event.preventDefault();
    const next = Array(6).fill("");
    digits.forEach((digit, index) => {
      next[index] = digit;
    });
    onChange(next);
    inputRefs.current[Math.min(digits.length, 5)]?.focus();
  }

  return (
    <div
      role="group"
      aria-label="6 位动态安全码"
      className="flex justify-center gap-2"
      onPaste={handlePaste}
    >
      {value.map((digit, index) => (
        <Input
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          pattern="[0-9]"
          maxLength={1}
          value={digit}
          onChange={(event) => updateDigit(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`验证码第 ${index + 1} 位`}
          className="size-11 rounded-lg px-0 text-center font-mono text-lg font-semibold tracking-normal shadow-none"
        />
      ))}
    </div>
  );
}

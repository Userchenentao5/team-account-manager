"use client";

import { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { login, loginWithMfa, type LoginResult } from "@/actions/auth";
import { MfaCodeInput } from "@/components/auth/mfa-code-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const errorText: Record<Extract<LoginResult, { ok: false }>["error"], string> = {
  config: "登录安全配置无效，请联系管理员。",
  invalid: "访问密钥不正确。",
  locked: "失败次数过多，请稍后再试。",
  expired: "登录验证已过期，请重新输入访问密钥。",
};

export function LoginForm() {
  const [mfaOpen, setMfaOpen] = useState(false);
  const [code, setCode] = useState<string[]>(() => Array(6).fill(""));
  const [keyError, setKeyError] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeyError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await login(formData);
      if (!result.ok) {
        setKeyError(errorText[result.error]);
        return;
      }
      setCode(Array(6).fill(""));
      setMfaError(null);
      setMfaOpen(true);
    });
  }

  function verifyCode(nextCode: string[]) {
    setCode(nextCode);
    setMfaError(null);
    if (nextCode.some((digit) => !digit) || isPending) return;

    startTransition(async () => {
      const result = await loginWithMfa(nextCode.join(""));
      if (!result.ok) {
        setMfaError(
          result.error === "invalid"
            ? "安全码不正确，请重试。"
            : errorText[result.error],
        );
        setCode(Array(6).fill(""));
      }
    });
  }

  function closeMfa() {
    if (isPending) return;
    setMfaOpen(false);
    setCode(Array(6).fill(""));
    setMfaError(null);
  }

  return (
    <>
      <form onSubmit={submitKey} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="key">访问密钥</Label>
          <Input
            id="key"
            name="key"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            disabled={isPending}
          />
          {keyError ? (
            <p role="alert" className="text-sm text-destructive">
              {keyError}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "正在验证..." : "登录"}
        </Button>
      </form>

      <Dialog
        open={mfaOpen}
        onOpenChange={(open) => {
          if (!open) closeMfa();
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
                双因素认证
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                请输入身份验证器应用显示的 6 位安全码
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-5">
              <MfaCodeInput
                value={code}
                onChange={verifyCode}
                disabled={isPending}
                autoFocus
              />

              {isPending || mfaError ? (
                <div aria-live="polite" className="text-center text-sm">
                  {isPending ? (
                    <p className="text-muted-foreground">正在验证安全码...</p>
                  ) : (
                    <p role="alert" className="text-destructive">
                      {mfaError}
                    </p>
                  )}
                </div>
              ) : null}

              <Button
                type="button"
                size="lg"
                variant="outline"
                onClick={closeMfa}
                disabled={isPending}
                className="w-full"
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

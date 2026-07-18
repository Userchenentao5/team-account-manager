import { KeyRound, Layers3, ShieldCheck } from "lucide-react";
import { login } from "@/actions/auth";
import { db } from "@/db";
import { getMfaStatus } from "@/db/mfa";
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

const errorText = {
  config: "登录安全配置无效，请联系管理员。",
  invalid: "访问密钥或动态安全码不正确。",
  locked: "失败次数过多，请稍后再试。",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: keyof typeof errorText }>;
}) {
  const { error } = searchParams ? await searchParams : {};
  const mfaEnabled = getMfaStatus(db).enabled;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_30rem]">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary-foreground/12 ring-1 ring-primary-foreground/20">
            <Layers3 aria-hidden="true" className="size-5" />
          </div>
          <span className="text-sm font-semibold">团队空间管理</span>
        </div>
        <div className="max-w-xl">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            让成本、席位与到期状态保持清晰。
          </h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-primary-foreground/72">
            用一个安静的工作台处理空间订阅、子账号收款和续费风险。
          </p>
        </div>
        <p className="text-xs text-primary-foreground/55">个人运营工作台</p>
      </section>

      <section className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Layers3 aria-hidden="true" className="size-4" />
            </div>
            <span className="text-sm font-semibold">团队空间管理</span>
          </div>
          <Card className="w-full">
            <CardHeader>
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <KeyRound aria-hidden="true" className="size-4" />
              </div>
              <CardTitle as="h1" className="text-xl">
                访问验证
              </CardTitle>
              <CardDescription className="leading-6">
                {mfaEnabled
                  ? "输入访问密钥和 Authenticator 动态安全码。"
                  : "输入个人访问密钥后继续使用系统。"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={login} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="key">访问密钥</Label>
                  <Input
                    id="key"
                    name="key"
                    type="password"
                    autoComplete="current-password"
                    autoFocus
                    required
                  />
                </div>
                {mfaEnabled ? (
                  <div className="space-y-2">
                    <Label htmlFor="mfaCode" className="flex items-center gap-1.5">
                      <ShieldCheck
                        className="size-3.5 text-muted-foreground"
                        aria-hidden="true"
                      />
                      Authenticator 安全码
                    </Label>
                    <Input
                      id="mfaCode"
                      name="mfaCode"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      required
                      className="font-mono text-base tracking-[0.24em]"
                    />
                    <p className="text-xs leading-5 text-muted-foreground">
                      输入 Authenticator App 当前显示的 6 位数字。
                    </p>
                  </div>
                ) : null}
                {error ? (
                  <p className="text-sm text-destructive">
                    {errorText[error] ?? errorText.invalid}
                  </p>
                ) : null}
                <Button type="submit" className="w-full">
                  登录
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

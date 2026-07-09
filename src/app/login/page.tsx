import { KeyRound } from "lucide-react";
import { login } from "@/actions/auth";
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
  config: "登录密钥尚未配置。",
  invalid: "访问密钥不正确。",
  locked: "失败次数过多，请稍后再试。",
} as const;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: keyof typeof errorText }>;
}) {
  const { error } = searchParams ? await searchParams : {};

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm rounded-lg">
        <CardHeader>
          <div className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-muted/50 text-primary">
            <KeyRound aria-hidden="true" className="size-4" />
          </div>
          <CardTitle>访问验证</CardTitle>
          <CardDescription>输入个人访问密钥后继续使用系统。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-4">
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
              {error ? (
                <p className="text-sm text-destructive">
                  {errorText[error] ?? errorText.invalid}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

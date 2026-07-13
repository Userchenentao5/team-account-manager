import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <SearchX aria-hidden="true" className="size-5" />
        </div>
        <p className="mt-6 font-mono text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">页面不存在</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          当前地址无效，或对应内容已经被移除。
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft aria-hidden="true" className="size-4" />
            返回仪表盘
          </Link>
        </Button>
      </div>
    </div>
  );
}

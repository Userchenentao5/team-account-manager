import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  variant?: "default" | "detail";
  className?: string;
};

export function PageHeader({
  title,
  description,
  leading,
  actions,
  children,
  sticky = true,
  variant = "default",
  className,
}: PageHeaderProps) {
  if (variant === "detail") {
    return (
      <header
        data-slot="page-header"
        className={cn(
          "-mx-4 -mt-7 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 border-b bg-background px-4 py-4 backdrop-blur-lg",
          sticky && "sticky top-14 z-30",
          "sm:mx-0 sm:mt-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:rounded-lg sm:border sm:bg-card",
          className,
        )}
      >
        {leading}
        <h1 className="col-span-2 row-start-2 min-w-0 truncate text-center text-xl font-semibold tracking-tight sm:absolute sm:left-1/2 sm:col-span-1 sm:row-start-1 sm:max-w-[52vw] sm:-translate-x-1/2 sm:text-2xl">
          {title}
        </h1>
        {actions ? (
          <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end sm:col-start-3">
            {actions}
          </div>
        ) : null}
      </header>
    );
  }

  return (
    <header
      data-slot="page-header"
      className={cn(
        "shrink-0 border-b bg-background/95 px-4 py-5 backdrop-blur-lg sm:px-6 lg:px-8",
        sticky && "sticky top-14 z-30 -mx-4 -mt-7 sm:-mx-6 lg:-mx-8",
        className,
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </header>
  );
}

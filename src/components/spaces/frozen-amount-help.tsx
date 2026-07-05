"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type FrozenAmountHelpProps = {
  className?: string;
};

export function FrozenAmountHelp({ className }: FrozenAmountHelpProps) {
  return (
    <Dialog>
      <Tooltip>
        <TooltipTrigger asChild>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className={className}
              aria-label="查看冻结金额说明"
            >
              <Info className="size-3.5" />
            </Button>
          </DialogTrigger>
        </TooltipTrigger>
        <TooltipContent>查看说明</TooltipContent>
      </Tooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>冻结金额说明</DialogTitle>
          <DialogDescription>
            冻结金额用于保留保存当刻的 USD 成本，不会被之后的汇率刷新改写。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            保存空间或子账号时，系统会按当时缓存的汇率把原币金额折算为 USD，并把结果固定下来。
          </p>
          <p>
            之后刷新汇率只会影响当前参考值和后续保存，不会回写已经冻结的历史成本。
          </p>
          <p>
            只有修改金额或币种并保存时，冻结金额才会按保存时的汇率重新计算。
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

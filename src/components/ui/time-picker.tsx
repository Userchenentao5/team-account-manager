"use client";

import { useRef } from "react";
import { ChevronDown, Clock } from "lucide-react";
import { Popover as PopoverPrimitive, ToggleGroup } from "radix-ui";

const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);

type TimePickerProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
};

const listClassName =
  "h-48 overflow-y-auto rounded-md bg-muted/55 p-1 [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent";

const optionClassName =
  "flex h-8 w-full items-center justify-center rounded-md font-mono text-sm tabular-nums outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/40 data-[state=on]:bg-primary data-[state=on]:font-semibold data-[state=on]:text-primary-foreground";

export function TimePicker({
  id,
  value,
  onValueChange,
  disabled,
}: TimePickerProps) {
  const [hour = "00", minute = "00"] = value.split(":");
  const selectedHourRef = useRef<HTMLButtonElement>(null);
  const selectedMinuteRef = useRef<HTMLButtonElement>(null);

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={`发送时间 ${hour}:${minute}`}
          className="group flex h-9 w-40 items-center gap-2 rounded-lg border border-input bg-card px-3 text-sm shadow-[0_1px_1px_oklch(0.2_0.02_205_/_0.03)] transition-[border-color,box-shadow,background-color] outline-none hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/20"
        >
          <Clock className="size-4 text-muted-foreground" />
          <span className="font-mono font-medium tabular-nums">
            {hour}:{minute}
          </span>
          <ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-180" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={16}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() => {
              selectedHourRef.current?.focus();
              selectedHourRef.current?.scrollIntoView({ block: "center" });
              selectedMinuteRef.current?.scrollIntoView({ block: "center" });
            });
          }}
          className="z-50 w-64 origin-(--radix-popover-content-transform-origin) rounded-lg bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              选择发送时间
            </span>
            <span className="font-mono text-sm font-semibold tabular-nums">
              {hour}:{minute}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="px-1 text-xs text-muted-foreground">小时</div>
              <ToggleGroup.Root
                type="single"
                value={hour}
                orientation="vertical"
                loop
                aria-label="小时"
                className={listClassName}
                onValueChange={(nextHour) => {
                  if (nextHour) onValueChange(`${nextHour}:${minute}`);
                }}
              >
                {HOURS.map((option) => (
                  <ToggleGroup.Item
                    key={option}
                    ref={option === hour ? selectedHourRef : undefined}
                    value={option}
                    aria-label={`${option} 时`}
                    className={optionClassName}
                  >
                    {option}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            </div>

            <div className="space-y-1">
              <div className="px-1 text-xs text-muted-foreground">分钟</div>
              <ToggleGroup.Root
                type="single"
                value={minute}
                orientation="vertical"
                loop
                aria-label="分钟"
                className={listClassName}
                onValueChange={(nextMinute) => {
                  if (nextMinute) onValueChange(`${hour}:${nextMinute}`);
                }}
              >
                {MINUTES.map((option) => (
                  <ToggleGroup.Item
                    key={option}
                    ref={option === minute ? selectedMinuteRef : undefined}
                    value={option}
                    aria-label={`${option} 分`}
                    className={optionClassName}
                  >
                    {option}
                  </ToggleGroup.Item>
                ))}
              </ToggleGroup.Root>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

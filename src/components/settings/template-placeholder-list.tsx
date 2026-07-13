import { Plus } from "lucide-react";
import type { ReminderTemplatePlaceholder } from "@/lib/email/reminder-template-placeholders";

type TemplatePlaceholderListProps = {
  placeholders: readonly ReminderTemplatePlaceholder[];
  onInsert: (placeholder: string) => void;
};

export function TemplatePlaceholderList({
  placeholders,
  onInsert,
}: TemplatePlaceholderListProps) {
  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs font-medium text-foreground">可用占位符</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {placeholders.map(({ key, label, example }) => {
          const placeholder = `{${key}}`;
          return (
            <button
              key={key}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onInsert(placeholder)}
              className="flex min-w-0 items-center gap-2 rounded-md border bg-background px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              title={`插入 ${placeholder}`}
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <code className="text-xs font-medium text-primary">
                    {placeholder}
                  </code>
                  <span className="text-xs text-foreground">{label}</span>
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  示例：{example}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

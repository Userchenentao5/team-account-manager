import { db } from "@/db";
import { getStatusThresholds } from "@/db/settings";
import { StatusThresholdForm } from "@/components/settings/status-threshold-form";

// better-sqlite3 is a native module - keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const thresholds = getStatusThresholds(db);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold leading-tight">设置</h1>
        <p className="text-sm text-muted-foreground">配置空间和子账号状态规则。</p>
      </div>

      <StatusThresholdForm thresholds={thresholds} />
    </div>
  );
}

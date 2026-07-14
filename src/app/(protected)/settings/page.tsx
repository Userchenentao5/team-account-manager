import { db } from "@/db";
import {
  getChildAccountEmailReminderSettings,
  getSpaceEmailReminderSettings,
  getStatusThresholds,
} from "@/db/settings";
import { ChildAccountReminderForm } from "@/components/settings/child-account-reminder-form";
import { StatusThresholdForm } from "@/components/settings/status-threshold-form";

// better-sqlite3 is a native module - keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const thresholds = getStatusThresholds(db);
  const emailReminder = getSpaceEmailReminderSettings(db);
  const childAccountEmailReminder = getChildAccountEmailReminderSettings(db);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-7 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">设置</h1>
        <p className="text-sm leading-6 text-muted-foreground">配置空间和子账号状态规则。</p>
      </div>

      <StatusThresholdForm
        thresholds={thresholds}
        emailReminder={emailReminder}
      />
      <ChildAccountReminderForm
        settings={childAccountEmailReminder}
      />
    </div>
  );
}

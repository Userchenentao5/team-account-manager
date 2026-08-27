import { db } from "@/db";
import {
  getChildAccountEmailReminderSettings,
  getSpaceEmailReminderSettings,
  getStatusThresholds,
} from "@/db/settings";
import { getMfaStatus } from "@/db/mfa";
import { ChildAccountReminderForm } from "@/components/settings/child-account-reminder-form";
import { MfaSettings } from "@/components/settings/mfa-settings";
import { StatusThresholdForm } from "@/components/settings/status-threshold-form";
import { PageHeader } from "@/components/layout/page-header";

// better-sqlite3 is a native module - keep this RSC on the Node runtime.
export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const thresholds = getStatusThresholds(db);
  const emailReminder = getSpaceEmailReminderSettings(db);
  const childAccountEmailReminder = getChildAccountEmailReminderSettings(db);
  const mfaStatus = getMfaStatus(db);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 py-7 sm:px-6 lg:px-8">
      <PageHeader
        title="设置"
        description="配置登录安全、空间和子账号状态规则。"
      />

      <StatusThresholdForm
        thresholds={thresholds}
        emailReminder={emailReminder}
      />
      <ChildAccountReminderForm
        settings={childAccountEmailReminder}
      />
      <MfaSettings status={mfaStatus} />
    </div>
  );
}

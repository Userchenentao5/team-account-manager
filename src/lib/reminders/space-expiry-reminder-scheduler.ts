import { runChildAccountPaymentReminderJob } from "@/lib/reminders/child-account-payment-reminder-job";
import { runSpaceExpiryReminderJob } from "@/lib/reminders/space-expiry-reminder-job";

const CHECK_INTERVAL_MS = 60_000;

const globalForReminderScheduler = globalThis as unknown as {
  spaceExpiryReminderScheduler?: NodeJS.Timeout;
};

function shouldStartScheduler() {
  return (
    typeof window === "undefined" &&
    process.env.NODE_ENV !== "test" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.npm_lifecycle_event !== "build"
  );
}

export function startSpaceExpiryReminderScheduler(): void {
  if (!shouldStartScheduler()) return;
  if (globalForReminderScheduler.spaceExpiryReminderScheduler) return;

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { db } = await import("@/db");
      // Wait for both jobs even if one fails: releasing the guard early could
      // resend a reminder whose SMTP request is still in flight.
      const results = await Promise.allSettled([
        runSpaceExpiryReminderJob(db),
        runChildAccountPaymentReminderJob(db),
      ]);
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("reminder scheduler failed", result.reason);
        }
      }
    } catch (error) {
      console.error("reminder scheduler failed", error);
    } finally {
      running = false;
    }
  };

  tick();
  const timer = setInterval(tick, CHECK_INTERVAL_MS);
  timer.unref?.();
  globalForReminderScheduler.spaceExpiryReminderScheduler = timer;
}
